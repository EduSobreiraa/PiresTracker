import { createClient } from 'npm:@supabase/supabase-js@2'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const institutionNames = new Map([
  ['nubank', 'Nubank'],
  ['santander', 'Santander'],
  ['inter', 'Banco Inter'],
])
const [userId, itemId, institutionKey, confirmation] = Deno.args
const institutionName = institutionNames.get(institutionKey ?? '')

if (!uuidPattern.test(userId ?? '') || !uuidPattern.test(itemId ?? '') || !institutionName || confirmation !== '--confirm-owner-and-authorization' || Deno.args.length !== 4) {
  throw new Error('Usage: deno run --allow-env --allow-net supabase/scripts/bootstrap-financial-item.ts <owner-user-uuid> <pluggy-item-uuid> <nubank|santander|inter> --confirm-owner-and-authorization')
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const clientId = Deno.env.get('PLUGGY_CLIENT_ID')
const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET')
if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET are required')
}

const pluggyAuth = await fetch('https://api.pluggy.ai/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId, clientSecret }),
  signal: AbortSignal.timeout(15_000),
})
if (!pluggyAuth.ok) throw new Error(`Pluggy authentication failed with HTTP ${pluggyAuth.status}`)
const { apiKey } = await pluggyAuth.json() as { apiKey?: string }
if (!apiKey) throw new Error('Pluggy authentication returned no API key')

const pluggyItemResponse = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
  headers: { 'X-API-KEY': apiKey },
  signal: AbortSignal.timeout(15_000),
})
if (!pluggyItemResponse.ok) throw new Error(`Pluggy Item lookup failed with HTTP ${pluggyItemResponse.status}`)
const item = await pluggyItemResponse.json() as {
  id?: string
  status?: string
  nextAutoSyncAt?: string | null
  consentExpiresAt?: string | null
  connector?: { id?: number; name?: string }
}
if (item.id !== itemId || item.connector?.id !== 200) {
  throw new Error('The Item does not match the requested ID and MeuPluggy connector')
}

const status = item.status === 'UPDATED' || item.status === 'PARTIAL_SUCCESS' ? 'ACTIVE' : 'PENDING'
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { error: insertError } = await supabase.from('financial_connections').upsert({
  user_id: userId,
  provider: 'pluggy',
  external_item_id: itemId,
  institution_name: institutionName,
  status,
  next_auto_sync_at: item.nextAutoSyncAt ?? null,
  consent_expires_at: item.consentExpiresAt ?? null,
}, { onConflict: 'provider,external_item_id', ignoreDuplicates: true })
if (insertError) throw new Error(`Connection insert failed: ${insertError.code}`)

const { data: connection, error: readError } = await supabase.from('financial_connections')
  .select('id, user_id, institution_name')
  .eq('provider', 'pluggy')
  .eq('external_item_id', itemId)
  .maybeSingle()
if (readError) throw new Error(`Connection verification failed: ${readError.code}`)
if (!connection || connection.user_id !== userId) {
  throw new Error('The Item is already linked to a different owner or could not be verified')
}

console.log('Financial connection linked and ownership verified.')
