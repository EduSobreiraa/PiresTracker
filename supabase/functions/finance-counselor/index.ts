import { adminClient, authenticatedUser } from '../_shared/auth.ts'
import { buildFinancialAdviceContext, financialAdvicePrompt, financialAdviceStartDate } from '../_shared/finance-advice.ts'
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/http.ts'

type Message = { role: 'user' | 'assistant'; content: string }
const model = 'gemini-3.5-flash-lite'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseHistory(value: unknown): Message[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 8) throw new Error('INVALID_REQUEST')
  return value.map((entry): Message => {
    if (!isRecord(entry) || Object.keys(entry).length !== 2 || (entry.role !== 'user' && entry.role !== 'assistant') || typeof entry.content !== 'string' || !entry.content.trim() || entry.content.length > 1200) {
      throw new Error('INVALID_REQUEST')
    }
    return { role: entry.role, content: entry.content.trim() }
  })
}

function bahiaToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const user = await authenticatedUser(request)
    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > 12_000) throw new Error('INVALID_REQUEST')
    let body: unknown
    try { body = await request.json() } catch { throw new Error('INVALID_REQUEST') }
    if (!isRecord(body) || Object.keys(body).some((key) => key !== 'question' && key !== 'history') || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 1200) {
      throw new Error('INVALID_REQUEST')
    }
    const question = body.question.trim()
    const history = parseHistory(body.history)
    const today = bahiaToday()
    const admin = adminClient()
    const [transactions, routineItems, completions] = await Promise.all([
      admin.from('financial_transactions').select('transaction_date, amount, manual_category, ai_category, is_necessary, installment_number, total_installments').eq('user_id', user.id).gte('transaction_date', financialAdviceStartDate(today)).lte('transaction_date', today).limit(1000),
      admin.from('routine_items').select('id, weekday, category, is_trackable, active').eq('user_id', user.id).eq('active', true).limit(200),
      admin.from('completions').select('routine_item_id, local_date, completed_at').eq('user_id', user.id).gte('local_date', addDays(today, -27)).lte('local_date', today).limit(500),
    ])
    if (transactions.error || routineItems.error || completions.error) throw new Error('ADVISOR_CONTEXT_READ_FAILED')
    const context = buildFinancialAdviceContext(transactions.data, routineItems.data, completions.data, today)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING')
    const contents = [...history.map(({ role, content }) => ({ role: role === 'assistant' ? 'model' : 'user', parts: [{ text: content }] })), { role: 'user', parts: [{ text: JSON.stringify({ question, context }) }] }]
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: financialAdvicePrompt }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
      }),
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`GEMINI_HTTP_${response.status}`)
    }
    const result: unknown = await response.json()
    const candidates = isRecord(result) ? result.candidates : null
    const candidate = Array.isArray(candidates) ? candidates[0] : null
    const content = isRecord(candidate) ? candidate.content : null
    const parts = isRecord(content) ? content.parts : null
    const answer = Array.isArray(parts) && isRecord(parts[0]) ? parts[0].text : null
    if (typeof answer !== 'string' || !answer.trim() || answer.length > 10000) throw new Error('GEMINI_INVALID_RESPONSE')
    return jsonResponse({ answer: answer.trim() })
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'FINANCIAL_ADVISOR_FAILED'
    const status = code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID' ? 401
      : code === 'INVALID_REQUEST' ? 400
      : code === 'GEMINI_API_KEY_MISSING' ? 503
      : code === 'ADVISOR_CONTEXT_READ_FAILED' ? 500
      : 502
    return new Response(JSON.stringify({ error: status === 400 || status === 401 ? code : 'FINANCIAL_ADVISOR_UNAVAILABLE' }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
