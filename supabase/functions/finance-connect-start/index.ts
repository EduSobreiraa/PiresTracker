import { adminClient, authenticatedUser } from '../_shared/auth.ts'
import { sha256 } from '../_shared/crypto.ts'
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/http.ts'
import { createApiKey, createConnectToken } from '../_shared/pluggy.ts'

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const user = await authenticatedUser(request)
    const apiKey = await createApiKey()
    const connectToken = await createConnectToken(apiKey, user.id)
    const { data, error } = await adminClient()
      .from('financial_link_sessions')
      .insert({ user_id: user.id, connect_token_hash: await sha256(connectToken) })
      .select('id, expires_at')
      .single()

    if (error) throw new Error('LINK_SESSION_CREATE_FAILED')
    return jsonResponse({ sessionId: data.id, expiresAt: data.expires_at, connectToken })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'INTERNAL_ERROR'
    const status = message === 'AUTH_REQUIRED' || message === 'AUTH_INVALID' ? 401 : 500
    const error = status === 401 ? message : 'LINK_SESSION_START_FAILED'
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
