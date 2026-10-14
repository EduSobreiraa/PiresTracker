import { useEffect, useRef, useState } from 'react'
import { bahiaToday } from './domain'
import type { createDataAccess, FinancialWorkspace } from './data'
import type { FinancialAccount, FinancialConnection, FinancialSyncExecution, FinancialTransaction } from './types'

type FinanceAccess = Pick<ReturnType<typeof createDataAccess>, 'loadFinancialWorkspace' | 'syncFinancialConnection'>

export default function FinanceView({ dataAccess, authenticated }: { dataAccess: FinanceAccess; authenticated: boolean }) {
  const [workspace, setWorkspace] = useState<FinancialWorkspace>({ connections: [], accounts: [], transactions: [], archivedTransactions: [], bills: [], syncExecutions: [] })
  const [loading, setLoading] = useState(authenticated)
  const [error, setError] = useState('')
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState('')
  const autoSyncStartedFor = useRef<FinanceAccess | null>(null)

  async function refresh(): Promise<FinancialWorkspace | null> {
    if (!authenticated) return null
    setLoading(true)
    setError('')
    try {
      const loaded = await dataAccess.loadFinancialWorkspace()
      setWorkspace(loaded)
      return loaded
    } catch (cause) {
      setError(readableFinanceError(cause))
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authenticated && autoSyncStartedFor.current === dataAccess) return
    if (authenticated) autoSyncStartedFor.current = dataAccess
    let active = true
    async function loadAndSync() {
      const loaded = await refresh()
      if (!active || !loaded) return
      let syncError = ''
      for (const connection of loaded.connections.filter(({ status }) => status === 'ACTIVE')) {
        setSyncingConnectionId(connection.id)
        try {
          const result = await dataAccess.syncFinancialConnection(connection.id)
          if (active) setSyncMessage(`${connection.institution_name}. Registros recebidos: ${result.accountsCount} contas, ${result.transactionsCount} movimentações e ${result.billsCount} faturas.`)
        } catch (cause) {
          syncError = cause instanceof Error ? cause.message : `Não foi possível sincronizar ${connection.institution_name}.`
        } finally {
          if (active) setSyncingConnectionId(null)
        }
      }
      if (active) await refresh()
      if (active && syncError) setError(syncError)
    }
    void loadAndSync()
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { active = false; window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [dataAccess, authenticated])

  async function sync(connection: FinancialConnection) {
    setSyncingConnectionId(connection.id)
    setSyncMessage('')
    setError('')
    try {
      const result = await dataAccess.syncFinancialConnection(connection.id)
      setSyncMessage(`${connection.institution_name}. Registros recebidos: ${result.accountsCount} contas, ${result.transactionsCount} movimentações e ${result.billsCount} faturas.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Não foi possível sincronizar ${connection.institution_name}.`)
    } finally {
      setSyncingConnectionId(null)
    }
  }

  const accountById = new Map(workspace.accounts.map((account) => [account.id, account]))
  const connectionById = new Map(workspace.connections.map((connection) => [connection.id, connection]))
  const santanderAccounts = workspace.accounts.filter((account) => account.account_type === 'BANK' && connectionById.get(account.connection_id)?.institution_name.toLocaleLowerCase('pt-BR').includes('santander'))
  const nubankAccounts = workspace.accounts.filter((account) => account.account_type === 'CREDIT' && connectionById.get(account.connection_id)?.institution_name.toLocaleLowerCase('pt-BR').includes('nubank'))
  const nubankAccountIds = new Set(nubankAccounts.map(({ id }) => id))
  const nubankBills = workspace.bills.filter((bill) => nubankAccountIds.has(bill.account_id)).sort((left, right) => left.due_date.localeCompare(right.due_date))
  const today = bahiaToday()
  const nubankBill = nubankBills.find((bill) => bill.due_date >= today) ?? nubankBills.at(-1)

  return <main className="mt-8 min-w-0" aria-labelledby="finance-heading">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-medium text-muted">Contas, cartões e movimentações</p><h1 id="finance-heading" className="mt-1 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Minhas Finanças<span className="text-[#a2afa5]">.</span></h1></div>
      {authenticated && workspace.connections.length > 0 && <p className="text-sm text-muted">Dados importados das instituições conectadas</p>}
    </div>

    {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {syncMessage && <div role="status" className="mt-4 rounded-xl border border-[#dce5dd] bg-white p-3 text-sm text-[#345d43]">{syncMessage}</div>}

    {!authenticated ? <section className="mt-5 rounded-[1.5rem] border border-dashed border-[#cbd7cc] bg-white/70 px-6 py-8" aria-label="Finanças indisponível na demonstração local"><h2 className="font-semibold">Conecte o Supabase para consultar suas finanças.</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted">A demonstração local não contém dados bancários e não executa sincronizações.</p></section>
      : loading && workspace.connections.length === 0 ? <div role="status" className="mt-5 rounded-2xl border border-[#e4eae4] bg-white p-6 text-sm text-muted">Carregando dados financeiros…</div>
        : error && workspace.connections.length === 0 && workspace.accounts.length === 0 && workspace.transactions.length === 0 && workspace.archivedTransactions.length === 0 && workspace.bills.length === 0 ? <section className="mt-5 rounded-[1.5rem] border border-[#e4eae4] bg-white px-6 py-8"><h2 className="font-semibold">Finanças ainda não está preparada neste projeto Supabase.</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted">As tabelas financeiras precisam ser aplicadas ao projeto conectado antes de listar instituições e movimentações.</p></section>
          : <>
            {(santanderAccounts.length > 0 || nubankAccounts.length > 0) && <section className="mt-6" aria-labelledby="finance-highlights-heading"><h2 id="finance-highlights-heading" className="text-lg font-semibold">Resumo principal</h2><div className="mt-3 grid gap-3 lg:grid-cols-2">
              {santanderAccounts.length > 0 && <article className="rounded-[1.4rem] border border-[#e4eae4] bg-white p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Santander</h3><span className="text-xs text-muted">Saldo informado</span></div><div className="mt-4 divide-y divide-[#e8ede8]">{santanderAccounts.map((account) => <div key={account.id} className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{account.name}</p><p className="mt-1 text-xs text-muted">{account.subtype ?? 'Conta bancária'}</p></div><p className="shrink-0 text-lg font-semibold">{account.balance === null ? 'Não informado' : formatMoney(account.balance, account.currency_code)}</p></div>)}</div></article>}
              {nubankAccounts.length > 0 && <article className="rounded-[1.4rem] border border-[#e4eae4] bg-white p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Nubank</h3><span className="text-xs text-muted">Limite e fatura</span></div><div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center"><div className="flex flex-wrap items-center gap-4">{nubankAccounts.map((account) => <CreditLimitRing key={account.id} account={account} />)}</div><div className="min-w-0 flex-1 border-t border-[#e8ede8] pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><p className="text-sm text-muted">{nubankBill ? `Fatura · vence ${formatDate(nubankBill.due_date)}` : 'Fatura'}</p><p className="mt-1 text-2xl font-semibold">{nubankBill ? formatMoney(nubankBill.total_amount, nubankBill.currency_code) : 'Não importada'}</p>{nubankBill?.minimum_payment_amount !== null && nubankBill?.minimum_payment_amount !== undefined && <p className="mt-1 text-xs text-muted">Pagamento mínimo {formatMoney(nubankBill.minimum_payment_amount, nubankBill.currency_code)}</p>}</div></div></article>}
            </div></section>}
            <section className="mt-6" aria-labelledby="connections-heading">
              <div className="flex items-baseline justify-between gap-3"><h2 id="connections-heading" className="text-lg font-semibold">Instituições e históricos</h2>{loading && <span role="status" className="text-xs text-muted">Atualizando…</span>}</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">{workspace.connections.length === 0 && <article className="rounded-[1.4rem] border border-dashed border-[#cbd7cc] bg-white/70 p-5"><h3 className="font-semibold">Nenhuma instituição conectada.</h3><p className="mt-1 text-sm text-muted">As conexões autorizadas aparecerão aqui depois de cadastradas no PiresTracker.</p></article>}{workspace.connections.map((connection) => {
                const latestExecution = workspace.syncExecutions.find((execution) => execution.connection_id === connection.id)
                const status = connectionStatus(connection.status, latestExecution)
                const isSyncing = syncingConnectionId === connection.id
                return <article key={connection.id} className="rounded-[1.4rem] border border-[#e4eae4] bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{connection.institution_name}</h3><p className="mt-1 text-sm text-muted">{connection.provider === 'pluggy' ? 'Conectada pela Pluggy' : connection.provider}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span></div>
                  <p className="mt-4 text-xs text-muted">{connection.last_synced_at ? `Última sincronização concluída em ${formatTimestamp(connection.last_synced_at)}` : 'Ainda não há uma sincronização concluída.'}</p>
                  {latestExecution && <p className="mt-1 text-xs text-muted">Última tentativa: {formatTimestamp(latestExecution.started_at)} · {executionLabel(latestExecution.status)}</p>}
                  <button type="button" disabled={connection.status !== 'ACTIVE' || syncingConnectionId !== null} onClick={() => void sync(connection)} className="mt-4 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-[#244b3f] disabled:cursor-not-allowed disabled:opacity-50">{isSyncing ? 'Sincronizando…' : 'Sincronizar agora'}</button>
                </article>
              })}</div>
            </section>

            <section className="mt-8" aria-labelledby="accounts-heading"><h2 id="accounts-heading" className="text-lg font-semibold">Contas e cartões</h2>
              {workspace.accounts.length === 0 ? <p className="mt-3 rounded-2xl bg-white p-5 text-sm text-muted">A sincronização ainda não importou contas.</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{workspace.accounts.map((account) => <AccountCard key={account.id} account={account} institution={connectionById.get(account.connection_id)?.institution_name ?? 'Instituição'} />)}</div>}
            </section>

            <details className="group mt-8" aria-labelledby="transactions-heading"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-[#e4eae4] bg-white px-5 py-4 hover:bg-[#f8faf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244b3f]"><h2 id="transactions-heading" className="text-lg font-semibold">Movimentações recentes</h2><span aria-hidden="true" className="shrink-0 text-sm text-muted transition-transform group-open:rotate-90">▶</span></summary>
              {workspace.transactions.length > 0 && <div className="mt-3 divide-y divide-[#e8ede8] overflow-hidden rounded-[1.4rem] border border-[#e4eae4] bg-white">{workspace.transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} account={accountById.get(transaction.account_id)} institution={connectionById.get(accountById.get(transaction.account_id)?.connection_id ?? '')?.institution_name ?? 'Instituição'} />)}</div>}
              {workspace.archivedTransactions.length > 0 && <div className="mt-3 divide-y divide-[#e8ede8] overflow-hidden rounded-[1.4rem] border border-[#e4eae4] bg-white">{workspace.archivedTransactions.map((entry) => <article key={entry.id} className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 px-4 py-4 sm:px-5"><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-medium">{entry.description || entry.history}</h3>{entry.history && entry.history !== entry.description && <p className="mt-1 text-xs text-muted">{entry.history}</p>}<p className="mt-1 text-xs text-muted">{formatDate(entry.transaction_date)} · Inter · Saldo após lançamento {formatMoney(entry.balance, 'BRL')}</p></div><p className="shrink-0 text-sm font-semibold">{formatMoney(entry.amount, 'BRL')}</p></article>)}</div>}
            </details>

            <details className="group mt-8" aria-labelledby="bills-heading"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-[#e4eae4] bg-white px-5 py-4 hover:bg-[#f8faf8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244b3f]"><h2 id="bills-heading" className="text-lg font-semibold">Faturas</h2><span aria-hidden="true" className="shrink-0 text-sm text-muted transition-transform group-open:rotate-90">▶</span></summary>
              {workspace.bills.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2">{workspace.bills.map((bill) => {
                const account = accountById.get(bill.account_id)
                const institution = connectionById.get(account?.connection_id ?? '')?.institution_name ?? 'Instituição'
                return <article key={bill.id} className="rounded-[1.4rem] border border-[#e4eae4] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{account?.name ?? 'Cartão'} · {institution}</h3><p className="mt-1 text-sm text-muted">Vencimento {formatDate(bill.due_date)}</p></div><p className="text-right text-sm font-semibold">{formatMoney(bill.total_amount, bill.currency_code)}<span className="mt-1 block text-xs font-normal text-muted">Valor informado na fatura</span></p></div>{bill.closing_date && <p className="mt-3 text-xs text-muted">Fechamento {formatDate(bill.closing_date)}</p>}</article>
              })}</div>}
            </details>
          </>}
  </main>
}

function readableFinanceError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : 'Não foi possível carregar seus dados financeiros.'
  if (/could not find the table 'public\.financial_[^']+' in the schema cache/i.test(message)) {
    return 'As tabelas financeiras ainda não foram aplicadas ao projeto Supabase conectado.'
  }
  return message
}

function AccountCard({ account, institution }: { account: FinancialAccount; institution: string }) {
  const isCredit = account.account_type === 'CREDIT'
  return <article className="rounded-[1.4rem] border border-[#e4eae4] bg-white p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{account.name}</h3><p className="mt-1 text-sm text-muted">{institution}</p></div><span className="shrink-0 rounded-full bg-moss px-3 py-1 text-xs font-medium text-[#4e6b57]">{isCredit ? 'Crédito' : 'Conta bancária'}</span></div><p className="mt-4 text-xs text-muted">{account.subtype ?? 'Tipo não informado'}</p>{isCredit ? account.available_credit_limit !== null && <p className="mt-3 text-sm">Limite disponível informado <span className="font-semibold">{formatMoney(account.available_credit_limit, account.currency_code)}</span></p> : account.balance !== null && <p className="mt-3 text-sm">Saldo informado pela instituição <span className="font-semibold">{formatMoney(account.balance, account.currency_code)}</span></p>}</article>
}

function CreditLimitRing({ account }: { account: FinancialAccount }) {
  const available = account.available_credit_limit
  const limit = account.credit_limit
  const circumference = 2 * Math.PI * 48
  const consumed = available !== null && limit !== null && limit > 0 ? Math.max(0, Math.min(1, (limit - available) / limit)) : 0
  const availableLabel = available === null ? 'Não informado' : formatMoney(available, account.currency_code)
  const limitLabel = limit === null ? 'Limite total não informado' : `de ${formatMoney(limit, account.currency_code)}`

  return <div className="flex min-w-0 items-center gap-3" role="group" aria-label={`Limite disponível do cartão ${account.name}: ${availableLabel}; ${limitLabel}`}>
    <div className="relative h-28 w-28 shrink-0" aria-hidden="true"><svg viewBox="0 0 112 112" className="h-full w-full -rotate-90"><circle cx="56" cy="56" r="48" fill="none" stroke="#dce5dd" strokeWidth="8" /><circle cx="56" cy="56" r="48" fill="none" stroke="#244b3f" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - consumed)} /></svg><div className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] font-semibold leading-tight">{availableLabel}</div></div>
    <div className="min-w-0"><p className="truncate text-sm font-medium">{account.name}</p><p className="mt-1 text-xs text-muted">Disponível {limitLabel}</p></div>
  </div>
}

function TransactionRow({ transaction, account, institution }: { transaction: FinancialTransaction; account: FinancialAccount | undefined; institution: string }) {
  return <article className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 px-4 py-4 sm:px-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><h3 className="break-words text-sm font-medium">{transaction.description}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${transaction.status === 'PENDING' ? 'bg-[#f4f0df] text-[#806922]' : 'bg-moss text-[#4e6b57]'}`}>{transaction.status === 'PENDING' ? 'Pendente' : 'Efetivada'}</span></div><p className="mt-1 text-xs text-muted">{formatDate(transaction.transaction_date)} · {institution} · {account?.name ?? 'Conta'}</p><p className="mt-1 text-xs text-muted">{[transaction.provider_type, transaction.operation_type, transaction.merchant_name].filter(Boolean).join(' · ') || 'Tipo não informado'}</p></div><p className="shrink-0 text-sm font-semibold">{formatMoney(transaction.amount, transaction.currency_code)}</p></article>
}

function connectionStatus(connection: FinancialConnection['status'], execution: FinancialSyncExecution | undefined): { label: string; tone: string } {
  if (execution?.status === 'FAILED') return { label: 'Falha na última tentativa', tone: 'bg-red-50 text-red-800' }
  if (connection === 'ACTIVE') return { label: 'Ativa', tone: 'bg-moss text-[#4e6b57]' }
  if (connection === 'PENDING') return { label: 'Pendente', tone: 'bg-[#f4f0df] text-[#806922]' }
  if (connection === 'ERROR') return { label: 'Com erro', tone: 'bg-red-50 text-red-800' }
  return { label: 'Desconectada', tone: 'bg-[#f0f3f0] text-muted' }
}

function executionLabel(status: FinancialSyncExecution['status']): string {
  if (status === 'RUNNING') return 'em andamento'
  if (status === 'SUCCEEDED') return 'concluída'
  return 'falhou'
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bahia' }).format(new Date(value))
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toLocaleString('pt-BR')} ${currency}`
  }
}
