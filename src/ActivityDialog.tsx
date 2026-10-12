import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { isValidDraft, weekdayNames } from './domain'
import { categories, type RoutineDraft, type RoutineItem } from './types'

type Props = { item: RoutineItem | null; weekday: number; onClose: () => void; onSave: (draft: RoutineDraft, id?: string) => Promise<void>; onArchive: (id: string) => Promise<void> }
const emptyDraft = (weekday: number): RoutineDraft => ({ weekday, starts_at: '09:00', ends_at: '10:00', title: '', category: 'commitment' })

export default function ActivityDialog({ item, weekday, onClose, onSave, onArchive }: Props) {
  const [draft, setDraft] = useState<RoutineDraft>(item ? { weekday: item.weekday, starts_at: item.starts_at.slice(0, 5), ends_at: item.ends_at.slice(0, 5), title: item.title, category: item.category } : emptyDraft(weekday))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidDraft(draft)) { setError('Informe um título e um horário final depois do início.'); return }
    setSaving(true)
    setError('')
    try { await onSave(draft, item?.id) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a atividade.') } finally { setSaving(false) }
  }

  async function archive() {
    if (!item || !window.confirm('Remover esta atividade da rotina? O histórico de conclusões será preservado.')) return
    setArchiving(true)
    setError('')
    try { await onArchive(item.id) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível remover a atividade.') } finally { setArchiving(false) }
  }

  function onDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="activity-title" onKeyDown={onDialogKeyDown} className="w-full max-w-lg rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><h2 id="activity-title" className="text-2xl font-semibold">{item ? 'Editar atividade' : 'Nova atividade'}</h2><p className="mt-1 text-sm text-muted">Ela se repete toda semana neste dia.</p></div><button onClick={onClose} aria-label="Fechar" className="rounded-full px-3 py-2 text-muted hover:bg-moss">✕</button></div>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-sm font-medium">Atividade<input ref={titleRef} required maxLength={80} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: aula, leitura, treino" className="mt-2 w-full rounded-xl border-[#dbe4dc] px-4 py-3" /></label>
          <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Dia<select value={draft.weekday} onChange={(event) => setDraft({ ...draft, weekday: Number(event.target.value) })} className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3">{weekdayNames.map((name, index) => <option value={index} key={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}</select></label><label className="block text-sm font-medium">Tipo<select value={draft.category} onChange={(event) => { const category = categories.find((value) => value === event.target.value); if (category) setDraft({ ...draft, category }) }} className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3"><option value="commitment">Compromisso</option><option value="study">Estudos</option><option value="gym">Academia</option></select></label></div>
          <div className="grid grid-cols-2 gap-4"><label className="block text-sm font-medium">Início<input required type="time" value={draft.starts_at} onChange={(event) => setDraft({ ...draft, starts_at: event.target.value })} className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3" /></label><label className="block text-sm font-medium">Fim<input required type="time" value={draft.ends_at} onChange={(event) => setDraft({ ...draft, ends_at: event.target.value })} className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3" /></label></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          <button disabled={saving || archiving} className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-white hover:bg-[#244b3f] disabled:opacity-60">{saving ? 'Salvando…' : item ? 'Salvar alterações' : 'Adicionar à rotina'}</button>
          {item && <button type="button" onClick={() => void archive()} disabled={saving || archiving} className="w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-60">{archiving ? 'Removendo…' : 'Remover da rotina'}</button>}
        </form>
      </section>
    </div>
  )
}
