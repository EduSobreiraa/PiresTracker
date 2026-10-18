import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

type Message = { id: string; role: 'user' | 'assistant'; content: string; created_at: string }
type Proposal = { id: string; version: string; kind: 'create_project_task'; project_id: string; stage_id: string; project_name: string; stage_title: string; title: string; planned_week: string | null; status: 'pending' | 'approved' | 'rejected'; expires_at: string; created_at: string }

async function invoke(client: SupabaseClient<Database>, body: object): Promise<unknown> {
  const { data, error } = await client.functions.invoke('pires-tracker-ai', { body })
  if (error) {
    const response = 'context' in error && error.context instanceof Response ? error.context : null
    const payload: unknown = response ? await response.json().catch(() => null) : null
    if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
      const messages: Record<string, string> = { RATE_LIMITED: 'Limite de 20 perguntas por hora atingido.', PROPOSAL_EXPIRED: 'A proposta expirou. Peça uma nova.', PROPOSAL_CHANGED: 'A proposta mudou. Confira a nova versão.', PROPOSAL_ALREADY_DECIDED: 'Esta proposta já foi decidida.', PROPOSAL_TARGET_UNAVAILABLE: 'A etapa do projeto não está mais disponível.' }
      throw new Error(messages[payload.error] ?? 'Não foi possível consultar o copiloto agora.')
    }
    throw new Error('Não foi possível consultar o copiloto agora. Verifique a conexão e tente novamente.')
  }
  return data
}

function isMessage(value: unknown): value is Message {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'role' in value && (value.role === 'user' || value.role === 'assistant') && 'content' in value && typeof value.content === 'string' && 'created_at' in value && typeof value.created_at === 'string'
}

function isProposal(value: unknown): value is Proposal {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'version' in value && typeof value.version === 'string' && 'title' in value && typeof value.title === 'string' && 'kind' in value && value.kind === 'create_project_task' && 'status' in value && (value.status === 'pending' || value.status === 'approved' || value.status === 'rejected') && 'project_id' in value && typeof value.project_id === 'string' && 'stage_id' in value && typeof value.stage_id === 'string' && 'project_name' in value && typeof value.project_name === 'string' && 'stage_title' in value && typeof value.stage_title === 'string' && 'planned_week' in value && (value.planned_week === null || typeof value.planned_week === 'string') && 'expires_at' in value && typeof value.expires_at === 'string' && 'created_at' in value && typeof value.created_at === 'string'
}

export default function PiresTrackerAI({ client, onApplied }: { client: SupabaseClient<Database>; onApplied: () => void }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)
  const launchRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    void invoke(client, { action: 'history' }).then((data) => {
      if (!active) return
      if (!data || typeof data !== 'object' || !('messages' in data) || !Array.isArray(data.messages) || !data.messages.every(isMessage) || !('proposals' in data) || !Array.isArray(data.proposals) || !data.proposals.every(isProposal)) throw new Error('Histórico inválido.')
      setMessages(data.messages)
      setProposals(data.proposals)
      setError('')
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [client, open])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); launchRef.current?.focus() }
      if (event.key !== 'Tab') return
      const focusable = document.querySelectorAll<HTMLElement>('#pires-tracker-ai-panel button:not(:disabled), #pires-tracker-ai-panel textarea:not(:disabled)')
      if (!focusable.length) return
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus() }
      else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [messages, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = question.trim()
    if (!text || busy) return
    setBusy(true)
    setError('')
    try {
      const data = await invoke(client, { action: 'chat', question: text })
      if (!data || typeof data !== 'object' || !('messages' in data) || !Array.isArray(data.messages) || !data.messages.every(isMessage)) throw new Error('Resposta inválida do copiloto.')
      const incoming = data.messages.filter(isMessage)
      setMessages((current) => [...current, ...incoming].slice(-30))
      const proposal = 'proposal' in data ? data.proposal : null
      if (isProposal(proposal)) setProposals((current) => [proposal, ...current])
      setQuestion('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a pergunta.') }
    finally { setBusy(false) }
  }

  async function decide(proposal: Proposal, decision: 'approve' | 'reject') {
    setBusy(true)
    setError('')
    try {
      const data = await invoke(client, { action: 'decide', proposalId: proposal.id, version: proposal.version, decision })
      if (!data || typeof data !== 'object' || !('status' in data) || data.status !== (decision === 'approve' ? 'approved' : 'rejected')) throw new Error('A decisão não foi confirmada.')
      const status = decision === 'approve' ? 'approved' : 'rejected'
      setProposals((current) => current.map((item) => item.id === proposal.id ? { ...item, status } : item))
      if (decision === 'approve') onApplied()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível decidir esta proposta.') }
    finally { setBusy(false) }
  }

  return <>
    <button ref={launchRef} type="button" onClick={() => setOpen(true)} aria-label="Abrir PiresTracker AI" aria-expanded={open} className="fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-lime"><img src="/pires-tracker-ai.png" alt="" className="h-full w-full object-contain" /></button>
    {open && <div className="fixed inset-0 z-50 bg-ink/40 sm:flex sm:justify-end" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); launchRef.current?.focus() } }}>
      <section id="pires-tracker-ai-panel" role="dialog" aria-modal="true" aria-labelledby="pires-tracker-ai-title" className="flex h-full w-full flex-col bg-[#f6f8f5] shadow-2xl sm:max-w-[400px]">
        <header className="flex items-center gap-3 border-b border-[#dce5dd] bg-ink px-4 py-3 text-white"><img src="/pires-tracker-ai.png" alt="" className="h-11 w-11 object-contain" /><div className="min-w-0 flex-1"><h2 id="pires-tracker-ai-title" className="font-semibold">PiresTracker AI</h2><p className="text-xs text-white/75">Copiloto de rotina, projetos e finanças</p></div><button ref={closeRef} type="button" onClick={() => { setOpen(false); launchRef.current?.focus() }} aria-label="Fechar chat" className="rounded-full px-3 py-2 text-xl hover:bg-white/10">×</button></header>
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5" aria-live="polite">
          {loading && <p role="status" className="text-sm text-muted">Carregando conversa…</p>}
          {!loading && messages.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm leading-6 text-muted">Pergunte sobre sua rotina, projetos ou finanças. Para criar uma tarefa, peça uma proposta e aprove a prévia antes de salvar.</p>}
          {messages.map((message) => <article key={message.id} className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-ink text-white' : 'bg-white text-ink'}`}><p className="whitespace-pre-wrap">{message.content}</p></article>)}
          {proposals.filter((proposal) => proposal.status === 'pending').map((proposal) => <article key={proposal.id} className="rounded-2xl border border-[#c9d6c9] bg-white p-4 text-sm"><h3 className="font-semibold">Proposta para aprovação</h3><p className="mt-2">Criar tarefa: {proposal.title}</p><p className="mt-1 text-muted">Projeto: {proposal.project_name} · Etapa: {proposal.stage_title}</p><p className="mt-1 text-muted">Semana: {proposal.planned_week ?? 'sem data definida'}</p><p className="mt-1 text-xs text-muted">Nenhuma alteração foi aplicada. Expira em {new Date(proposal.expires_at).toLocaleString('pt-BR')}.</p>{new Date(proposal.expires_at).getTime() <= Date.now() ? <p className="mt-2 text-red-800">Proposta expirada. Peça uma nova.</p> : <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void decide(proposal, 'approve')} className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-50">Aprovar</button><button type="button" disabled={busy} onClick={() => void decide(proposal, 'reject')} className="rounded-full border px-4 py-2 disabled:opacity-50">Rejeitar</button></div>}</article>)}
          {busy && <p role="status" className="text-sm text-muted">Processando…</p>}
        </div>
        <div className="border-t border-[#dce5dd] bg-white p-4">{error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<form onSubmit={(event) => void submit(event)} className="flex gap-2"><label htmlFor="pires-tracker-ai-question" className="sr-only">Sua pergunta</label><textarea id="pires-tracker-ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} maxLength={1200} disabled={busy || loading} placeholder="Pergunte ao PiresTracker AI…" className="min-w-0 flex-1 resize-none rounded-xl border border-[#dce5dd] px-3 py-2 text-sm" /><button type="submit" disabled={busy || loading || !question.trim()} className="self-end rounded-full bg-lime px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">Enviar</button></form><p className="mt-2 text-xs text-muted">Sugestões financeiras são estimativas. O copiloto não faz pagamentos.</p></div>
      </section>
    </div>}
  </>
}
