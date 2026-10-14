import { createClient, type User } from 'npm:@supabase/supabase-js@2'

export async function authenticatedUser(request: Request): Promise<User> {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) throw new Error('AUTH_REQUIRED')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!supabaseUrl || !publishableKey) throw new Error('SUPABASE_CONFIG_MISSING')

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('AUTH_INVALID')
  return data.user
}

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE_ADMIN_CONFIG_MISSING')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
