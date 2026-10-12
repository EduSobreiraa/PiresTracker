import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const configurationError = Boolean(url) !== Boolean(key)
  ? 'Preencha a URL e a chave publicável do Supabase juntas.'
  : url && key && !/^https?:\/\//.test(url)
    ? 'A URL do Supabase precisa começar com https:// ou http://.'
    : null

export const supabase = url && key && !configurationError
  ? createClient<Database>(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
