type PluggyCredentials = { clientId: string; clientSecret: string }

export type PluggyItem = {
  id: string
  clientUserId: string | null
  status: string
  executionStatus: string | null
  nextAutoSyncAt: string | null
  consentExpiresAt: string | null
  connector: { id: number; name: string }
}

function credentials(): PluggyCredentials {
  const clientId = Deno.env.get('PLUGGY_CLIENT_ID')
  const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('PLUGGY_CONFIG_MISSING')
  return { clientId, clientSecret }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.pluggy.ai${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`PLUGGY_HTTP_${response.status}`)
  }
  return await response.json() as T
}

export async function createApiKey(): Promise<string> {
  const { clientId, clientSecret } = credentials()
  const result = await request<{ apiKey: string }>('/auth', {
    method: 'POST',
    body: JSON.stringify({ clientId, clientSecret }),
  })
  if (!result.apiKey) throw new Error('PLUGGY_AUTH_INVALID_RESPONSE')
  return result.apiKey
}

export async function createConnectToken(apiKey: string, clientUserId: string): Promise<string> {
  const result = await request<{ accessToken: string }>('/connect_token', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey },
    body: JSON.stringify({ options: { clientUserId, avoidDuplicates: true } }),
  })
  if (!result.accessToken) throw new Error('PLUGGY_CONNECT_TOKEN_INVALID_RESPONSE')
  return result.accessToken
}

export async function getScopedItem(connectToken: string, itemId: string): Promise<void> {
  await request<unknown>(`/items/${encodeURIComponent(itemId)}`, {
    headers: { 'X-API-KEY': connectToken },
  })
}

export async function getItem(apiKey: string, itemId: string): Promise<PluggyItem> {
  const item = await request<PluggyItem>(`/items/${encodeURIComponent(itemId)}`, {
    headers: { 'X-API-KEY': apiKey },
  })
  if (item.id !== itemId || !item.connector || typeof item.connector.id !== 'number') {
    throw new Error('PLUGGY_ITEM_INVALID_RESPONSE')
  }
  return item
}
