import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

export default function AuthScreen({ client }: { client: SupabaseClient<Database> }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function signIn() {
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await client.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin },
      })
      if (signInError) setError(readableError(signInError.message))
    } catch (cause) {
      setError(cause instanceof Error ? readableError(cause.message) : 'Não foi possível conectar ao Supabase. Confira a internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-[0_24px_80px_-48px_rgba(23,53,45,.32)] sm:p-10" aria-labelledby="login-title">
        <Mark />
        <h1 id="login-title" className="mt-8 text-3xl font-semibold tracking-tight">Sua semana, no seu ritmo.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Use sua conta do GitHub para entrar no aplicativo.</p>
        {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        <button type="button" onClick={() => void signIn()} disabled={loading} className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-ink px-4 py-3 font-medium text-white transition hover:bg-[#244b3f] disabled:cursor-wait disabled:opacity-70">
          <GitHubMark />
          {loading ? 'Conectando ao GitHub…' : 'Entrar com GitHub'}
        </button>
      </section>
    </main>
  )
}

function readableError(message: string): string {
  if (/provider.*not enabled|unsupported provider/i.test(message)) return 'O login pelo GitHub não está habilitado no Supabase. Configure Authentication > Sign In / Providers > GitHub.'
  if (/redirect.*(not allowed|allow list)/i.test(message)) return 'O endereço de retorno não está permitido. Adicione a URL do app em Authentication > URL Configuration no Supabase.'
  if (/failed to fetch|network/i.test(message)) return 'Sem conexão com o Supabase. Confira a internet e tente novamente.'
  return message
}

function GitHubMark() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.1c-3.1.68-3.76-1.31-3.76-1.31-.5-1.3-1.24-1.65-1.24-1.65-1.02-.7.08-.69.08-.69 1.12.08 1.7 1.15 1.7 1.15 1 1.7 2.62 1.2 3.26.92.1-.72.39-1.2.71-1.48-2.47-.28-5.07-1.24-5.07-5.51 0-1.22.44-2.21 1.15-2.99-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.11-1.43 3.04-1.14 3.04-1.14.61 1.54.23 2.68.12 2.96.71.78 1.14 1.77 1.14 2.99 0 4.28-2.6 5.23-5.08 5.5.4.35.76 1.02.76 2.06v3.1c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" /></svg>
}

export function Mark() {
  return <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-lime" aria-hidden="true"><svg viewBox="0 0 24 24" className="h-7 w-7" fill="none"><path d="M5 6h14M5 12h14M5 18h8" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5"/><circle cx="18" cy="18" r="3" fill="currentColor"/></svg></div>
}
