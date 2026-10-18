import { useState, type FormEvent } from 'react'
import type { FinancialCounselorMessage } from './data'

type Message = FinancialCounselorMessage & { id: number }

export default function FinancialCounselor({ ask }: { ask: (question: string, history: FinancialCounselorMessage[]) => Promise<string> }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const prompt = question.trim()
    if (!prompt || sending) return
    setSending(true)
    setError('')
    try {
      const history = messages.slice(-8).map(({ role, content }) => ({ role, content }))
      const answer = await ask(prompt, history)
      const pair: Message[] = [{ id: Date.now(), role: 'user', content: prompt }, { id: Date.now() + 1, role: 'assistant', content: answer }]
      setMessages((current) => [...current, ...pair].slice(-12))
      setQuestion('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o conselheiro agora.')
    } finally {
      setSending(false)
    }
  }

  return <section className="mt-8 rounded-[1.4rem] border border-[#e4eae4] bg-white p-5 sm:p-6" aria-labelledby="financial-counselor-heading">
    <div><h2 id="financial-counselor-heading" className="text-lg font-semibold">Conselheiro pessoal</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Pergunte sobre seus gastos ou peça uma leitura do seu ritmo de estudos e academia. As respostas usam os ciclos financeiros e registros da rotina disponíveis.</p></div>
    <div className="mt-5 space-y-3" aria-live="polite">
      {messages.length === 0 && <p className="rounded-xl bg-[#f8faf8] p-4 text-sm leading-6 text-muted">Experimente: “Quanto gastei com alimentação neste ciclo?” ou “Como foi minha frequência de estudos nas últimas quatro semanas?”</p>}
      {messages.map((message) => <article key={message.id} className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-ink text-white' : 'bg-[#f0f4ef] text-ink'}`}><p className="whitespace-pre-wrap">{message.content}</p></article>)}
      {sending && <p role="status" className="text-sm text-muted">Analisando seus dados…</p>}
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="sr-only" htmlFor="financial-counselor-question">Sua pergunta</label>
      <textarea id="financial-counselor-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} rows={2} placeholder="Escreva sua pergunta…" className="min-h-14 min-w-0 flex-1 resize-y rounded-xl border border-[#dbe4dc] px-4 py-3 text-sm outline-none focus:border-[#52745d] focus:ring-2 focus:ring-[#52745d]/20" />
      <button type="submit" disabled={sending || !question.trim()} className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white hover:bg-[#244b3f] disabled:cursor-not-allowed disabled:opacity-50">{sending ? 'Consultando…' : 'Perguntar'}</button>
    </form>
    <p className="mt-2 text-xs text-muted">O orçamento financeiro ainda não está cadastrado. A conversa não fica salva ao sair da página.</p>
  </section>
}
