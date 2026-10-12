import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatDate } from './domain'
import type { LifeEvent, LifeEventDraft } from './types'

type Props = {
  events: LifeEvent[]
  today: string
  loading: boolean
  error: string
  onSave: (draft: LifeEventDraft, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function UpcomingEvents({ events, today, loading, error, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<LifeEvent | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const upcoming = events.filter((event) => event.event_date >= today)
  const [nextEvent, ...laterEvents] = upcoming
  const previous = events.filter((event) => event.event_date < today).sort((a, b) => b.event_date.localeCompare(a.event_date))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editing === undefined) return
    const form = new FormData(event.currentTarget)
    const draft: LifeEventDraft = {
      title: String(form.get('title') ?? ''),
      event_date: String(form.get('event_date') ?? ''),
      description: String(form.get('description') ?? '') || null,
    }
    setSaving(true)
    setFormError('')
    try {
      await onSave(draft, editing?.id)
      setEditing(undefined)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Não foi possível salvar o evento.')
    } finally {
      setSaving(false)
    }
  }

  return <section aria-labelledby="upcoming-events-heading" className="mt-5 rounded-[1.4rem] border border-[#e4eae4] bg-white p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><div><h2 id="upcoming-events-heading" className="text-base font-semibold">Próximos eventos</h2><p className="mt-1 text-xs text-muted">Provas e outras datas importantes.</p></div><button onClick={() => { setFormError(''); setEditing(null) }} className="shrink-0 rounded-full border border-[#dce5dd] px-3 py-2 text-xs font-medium text-[#4e6b57] hover:bg-moss">+ Evento</button></div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-800">{error}</p>}
    {loading ? <p role="status" className="mt-4 text-sm text-muted">Carregando eventos…</p> : upcoming.length === 0 ? <p className="mt-4 rounded-xl bg-[#f6f8f5] p-3 text-sm text-muted">Nenhum evento próximo. Adicione uma prova ou outra data importante.</p> : <div className="mt-4 space-y-2"><div className="rounded-2xl bg-[#eef4ec] p-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#58735d]">Próximo evento</p><EventRow item={nextEvent} today={today} onEdit={(event) => { setFormError(''); setEditing(event) }} onDelete={onDelete} highlighted /> </div>{laterEvents.length > 0 && <ul className="divide-y divide-[#edf1ed] pl-1">{laterEvents.map((item) => <EventRow key={item.id} item={item} today={today} onEdit={(event) => { setFormError(''); setEditing(event) }} onDelete={onDelete} />)}</ul>}</div>}
    {previous.length > 0 && <details className="mt-3 border-t border-[#edf1ed] pt-3"><summary className="cursor-pointer text-xs font-medium text-muted">Eventos anteriores ({previous.length})</summary><ul className="mt-1 divide-y divide-[#edf1ed]">{previous.map((item) => <EventRow key={item.id} item={item} today={today} onEdit={(event) => { setFormError(''); setEditing(event) }} onDelete={onDelete} />)}</ul></details>}

    {editing !== undefined && <div className="fixed inset-0 z-40 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"><form onSubmit={(event) => void submit(event)} className="w-full max-w-lg rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{editing ? 'Editar evento' : 'Novo evento'}</h3><button type="button" onClick={() => setEditing(undefined)} aria-label="Fechar" className="h-10 w-10 rounded-full hover:bg-moss">×</button></div>{formError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{formError}</p>}<label className="mt-4 block text-sm font-medium">Nome do evento<input name="title" required maxLength={120} defaultValue={editing?.title ?? ''} autoFocus placeholder="Ex.: Prova de Cálculo I" className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3" /></label><label className="mt-4 block text-sm font-medium">Data<input name="event_date" required type="date" min={editing ? undefined : today} defaultValue={editing?.event_date ?? today} className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3" /></label><label className="mt-4 block text-sm font-medium">Detalhes (opcional)<textarea name="description" maxLength={1000} rows={3} defaultValue={editing?.description ?? ''} placeholder="Matéria, conteúdo ou observações" className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3" /></label><button disabled={saving} className="mt-5 w-full rounded-full bg-ink px-5 py-3 font-medium text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar evento'}</button></form></div>}
  </section>
}

function EventRow({ item, today, onEdit, onDelete, highlighted = false }: { item: LifeEvent; today: string; onEdit: (event: LifeEvent) => void; onDelete: (id: string) => Promise<void>; highlighted?: boolean }) {
  const daysLeft = Math.round((Date.parse(`${item.event_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  const relative = daysLeft === 0 ? 'Hoje' : daysLeft === 1 ? 'Amanhã' : daysLeft < 0 ? `Há ${Math.abs(daysLeft)} dias` : `Em ${daysLeft} dias`
  return <li className={`flex items-start gap-3 ${highlighted ? '' : 'py-3'}`}><div className="min-w-0 flex-1"><p className={`text-sm font-medium ${highlighted ? 'text-[#203b31]' : ''}`}>{item.title}</p><p className={`mt-1 text-xs ${highlighted ? 'text-[#58735d]' : 'text-muted'}`}><time dateTime={item.event_date}>{formatDate(item.event_date, { weekday: 'short', day: 'numeric', month: 'short' })}</time><span className="mx-1.5">·</span><span className={`font-semibold ${highlighted ? 'text-[#294b39]' : 'text-[#4e6b57]'}`}>{relative}</span></p>{item.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.description}</p>}</div><div className="flex shrink-0"><button aria-label={`Editar ${item.title}`} onClick={() => onEdit(item)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-moss"><PencilIcon /></button><button aria-label={`Excluir ${item.title}`} onClick={() => { if (window.confirm(`Excluir o evento “${item.title}”?`)) void onDelete(item.id).catch(() => undefined) }} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700"><TrashIcon /></button></div></li>
}

function PencilIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d="m15 5 4 4M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /></svg>
}

function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
}
