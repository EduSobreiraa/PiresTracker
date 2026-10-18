import { createClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, authenticatedUser } from '../_shared/auth.ts'
import { copilotMetrics } from '../_shared/copilot-metrics.ts'
import { geminiProvider } from '../_shared/copilot-provider.ts'
import { financialAdviceStartDate } from '../_shared/finance-advice.ts'
import { handleOptions, jsonResponse } from '../_shared/http.ts'

function todayInBahia(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function daysBefore(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - count)
  return value.toISOString().slice(0, 10)
}

function validWeek(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1
}

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const user = await authenticatedUser(request)
    if (Number(request.headers.get('content-length') ?? 0) > 5000) throw new Error('INVALID_REQUEST')
    const raw = await request.text()
    if (raw.length > 5000) throw new Error('INVALID_REQUEST')
    const body: unknown = (() => { try { return JSON.parse(raw) } catch { return null } })()
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('action' in body) || typeof body.action !== 'string') throw new Error('INVALID_REQUEST')
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
    if (!url || !key) throw new Error('CONFIG_MISSING')
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: request.headers.get('Authorization')! } } })
    if (body.action === 'decide') {
      if (!('proposalId' in body) || typeof body.proposalId !== 'string' || !('version' in body) || typeof body.version !== 'string' || !('decision' in body) || (body.decision !== 'approve' && body.decision !== 'reject')) throw new Error('INVALID_REQUEST')
      const { data, error } = await client.rpc('decide_ai_proposal', { proposal_id: body.proposalId, proposal_version: body.version, decision: body.decision })
      if (error) throw new Error(error.message)
      return jsonResponse({ status: data })
    }
    if (body.action !== 'history' && body.action !== 'chat') throw new Error('INVALID_REQUEST')
    const admin = adminClient()
    const { data: conversation, error: conversationError } = await admin.from('ai_conversations').upsert({ user_id: user.id }, { onConflict: 'user_id' }).select('id').single()
    if (conversationError || !conversation) throw new Error('STORAGE_UNAVAILABLE')
    const [messageResult, proposalResult] = await Promise.all([
      client.from('ai_messages').select('id,role,content,created_at').eq('user_id', user.id).eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(30),
      client.from('ai_proposals').select('id,version,kind,project_id,stage_id,project_name,stage_title,title,planned_week,status,expires_at,created_at').eq('user_id', user.id).eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(15),
    ])
    if (messageResult.error || proposalResult.error) throw new Error('STORAGE_UNAVAILABLE')
    const messages = [...(messageResult.data ?? [])].reverse()
    const proposals = proposalResult.data ?? []
    if (body.action === 'history') return jsonResponse({ messages, proposals })
    if (!('question' in body) || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 1200) throw new Error('INVALID_REQUEST')
    const question = body.question.trim()
    // shortcut: simultaneous requests can exceed the hourly limit; use an atomic quota if parallel clients become common.
    const { count: recentCount, error: rateError } = await client.from('ai_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('conversation_id', conversation.id).eq('role', 'user').gte('created_at', new Date(Date.now() - 3_600_000).toISOString())
    if (rateError) throw new Error('STORAGE_UNAVAILABLE')
    if ((recentCount ?? 0) >= 20) throw new Error('RATE_LIMITED')
    const today = todayInBahia()
    const [items, completions, projects, stages, tasks, events, transactions] = await Promise.all([
      client.from('routine_items').select('id,weekday,starts_at,ends_at,title,category,is_trackable,active').eq('user_id', user.id).eq('active', true).limit(200),
      client.from('completions').select('routine_item_id,local_date,completed_at').eq('user_id', user.id).gte('local_date', daysBefore(today, 29)).lte('local_date', today).limit(1000),
      client.from('projects').select('id,name,description').eq('user_id', user.id).limit(50),
      client.from('project_stages').select('id,project_id,title,completed_at').eq('user_id', user.id).limit(150),
      client.from('project_tasks').select('id,project_id,stage_id,title,planned_week,completed_at,waived_at').eq('user_id', user.id).limit(300),
      client.from('life_events').select('title,event_date').eq('user_id', user.id).gte('event_date', today).order('event_date').limit(50),
      client.from('financial_transactions').select('transaction_date,amount,manual_category,ai_category,is_necessary,installment_number,total_installments').eq('user_id', user.id).gte('transaction_date', financialAdviceStartDate(today)).lte('transaction_date', today).order('transaction_date', { ascending: false }).limit(5000),
    ])
    if ([items, completions, projects, stages, tasks, events, transactions].some((result) => result.error)) throw new Error('CONTEXT_UNAVAILABLE')
    const activeStages = (stages.data ?? []).filter((stage) => !stage.completed_at)
    const context = {
      today, timeZone: 'America/Bahia',
      metrics: copilotMetrics(items.data ?? [], completions.data ?? [], transactions.data ?? [], today),
      schedule: { recurring: items.data ?? [], upcomingEvents: events.data ?? [] },
      projects: { projects: projects.data ?? [], stages: activeStages, tasks: tasks.data ?? [] },
      dataLimits: { transactionsTruncated: (transactions.data?.length ?? 0) === 5000, tasksTruncated: (tasks.data?.length ?? 0) === 300, completionsTruncated: (completions.data?.length ?? 0) === 1000, routineTruncated: (items.data?.length ?? 0) === 200, projectsTruncated: (projects.data?.length ?? 0) === 50, stagesTruncated: (stages.data?.length ?? 0) === 150, eventsTruncated: (events.data?.length ?? 0) === 50 },
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING')
    const { data: userMessage, error: userMessageError } = await admin.from('ai_messages').insert({ conversation_id: conversation.id, user_id: user.id, role: 'user', content: question }).select('id,role,content,created_at').single()
    if (userMessageError || !userMessage) throw new Error('STORAGE_UNAVAILABLE')
    const reply = await geminiProvider(apiKey).reply(question, messages.slice(-8), context)
    let proposal = null
    if (reply.proposal && /\b(criar|crie|adicionar|adicione|incluir|inclua|propor|proponha)\b/i.test(question) && /tarefa/i.test(question)) {
      const candidate = reply.proposal
      const stage = activeStages.find((item) => item.id === candidate.stageId && item.project_id === candidate.projectId)
      const project = (projects.data ?? []).find((item) => item.id === candidate.projectId)
      if (stage && project && (!candidate.plannedWeek || validWeek(candidate.plannedWeek))) {
        const { data, error } = await admin.from('ai_proposals').insert({ conversation_id: conversation.id, user_id: user.id, kind: candidate.kind, project_id: candidate.projectId, stage_id: candidate.stageId, project_name: project.name, stage_title: stage.title, title: candidate.title, planned_week: candidate.plannedWeek }).select('id,version,kind,project_id,stage_id,project_name,stage_title,title,planned_week,status,expires_at,created_at').single()
        if (error) throw new Error('STORAGE_UNAVAILABLE')
        proposal = data
      }
    }
    const { data: assistantMessage, error: assistantMessageError } = await admin.from('ai_messages').insert({ conversation_id: conversation.id, user_id: user.id, role: 'assistant', content: reply.answer }).select('id,role,content,created_at').single()
    if (assistantMessageError || !assistantMessage) throw new Error('STORAGE_UNAVAILABLE')
    return jsonResponse({ messages: [userMessage, assistantMessage], proposal })
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'COPILOT_UNAVAILABLE'
    const status = code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID' ? 401 : code === 'INVALID_REQUEST' ? 400 : code === 'RATE_LIMITED' ? 429 : code.startsWith('PROPOSAL_') ? 409 : 503
    return jsonResponse({ error: status === 503 ? 'COPILOT_UNAVAILABLE' : code }, status)
  }
})
