import { adminClient, authenticatedUser } from '../_shared/auth.ts'
import { sha256 } from '../_shared/crypto.ts'
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/http.ts'
import { createApiKey, getItem, getScopedItem } from '../_shared/pluggy.ts'

type ConfirmRequest = { sessionId: string; itemId: string; connectToken: string }

function parseRequest(value: unknown): ConfirmRequest {
  if (!value || typeof value !== 'object') throw new Error('INVALID_REQUEST')
  const body = value as Record<string, unknown>
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (typeof body.sessionId !== 'string' || !uuid.test(body.sessionId)
    || typeof body.itemId !== 'string' || !uuid.test(body.itemId)
    || typeof body.connectToken !== 'string' || body.connectToken.length < 32 || body.connectToken.length > 4096) {
    throw new Error('INVALID_REQUEST')
  }
  return { sessionId: body.sessionId, itemId: body.itemId, connectToken: body.connectToken }
}

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const user = await authenticatedUser(request)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new Error('INVALID_REQUEST')
    }
    const input = parseRequest(body)
    const admin = adminClient()
    const { data: linkSession, error: sessionError } = await admin
      .from('financial_link_sessions')
      .select('connect_token_hash, expires_at, consumed_at, confirmed_connection_id')
      .eq('id', input.sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sessionError || !linkSession) throw new Error('LINK_SESSION_NOT_FOUND')
    if (await sha256(input.connectToken) !== linkSession.connect_token_hash) throw new Error('LINK_SESSION_TOKEN_MISMATCH')
    if (linkSession.consumed_at) {
      const { data: connection, error: connectionError } = await admin
        .from('financial_connections')
        .select('id')
        .eq('id', linkSession.confirmed_connection_id)
        .eq('user_id', user.id)
        .eq('external_item_id', input.itemId)
        .maybeSingle()
      if (connectionError || !connection) throw new Error('LINK_SESSION_ALREADY_CONSUMED')
      return jsonResponse({ connectionId: connection.id })
    }
    if (Date.parse(linkSession.expires_at) <= Date.now()) throw new Error('LINK_SESSION_EXPIRED')

    // Only this session's Connect Token can prove that Pluggy created or returned this Item for the attempt.
    await getScopedItem(input.connectToken, input.itemId)
    const apiKey = await createApiKey()
    const item = await getItem(apiKey, input.itemId)
    if (item.clientUserId !== user.id || item.connector.id !== 200) throw new Error('ITEM_NOT_AUTHORIZED_FOR_SESSION')

    const { data: connectionId, error: confirmError } = await admin.rpc('confirm_financial_link', {
      p_session_id: input.sessionId,
      p_user_id: user.id,
      p_connect_token_hash: linkSession.connect_token_hash,
      p_external_item_id: input.itemId,
      p_institution_name: item.connector.name,
      p_status: item.status === 'UPDATED' || item.status === 'PARTIAL_SUCCESS' ? 'ACTIVE' : 'PENDING',
      p_next_auto_sync_at: item.nextAutoSyncAt,
      p_consent_expires_at: item.consentExpiresAt,
    })
    if (confirmError || !connectionId) throw new Error('LINK_CONFIRM_FAILED')
    return jsonResponse({ connectionId })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'INTERNAL_ERROR'
    const status = message === 'AUTH_REQUIRED' || message === 'AUTH_INVALID' ? 401
      : message === 'LINK_SESSION_NOT_FOUND' ? 404
      : message === 'LINK_SESSION_TOKEN_MISMATCH' || message === 'ITEM_NOT_AUTHORIZED_FOR_SESSION' || message === 'LINK_SESSION_ALREADY_CONSUMED' || message === 'PLUGGY_HTTP_403' ? 403
      : message === 'LINK_SESSION_EXPIRED' ? 410
      : message === 'INVALID_REQUEST' ? 400
      : message.startsWith('PLUGGY_HTTP_') ? 502 : 500
    const safeError = status < 500 ? message : 'LINK_CONFIRM_FAILED'
    return new Response(JSON.stringify({ error: safeError }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
