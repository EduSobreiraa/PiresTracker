import { afterEach, expect, it, vi } from 'vitest'
import { geminiProvider } from './copilot-provider.ts'

afterEach(() => vi.unstubAllGlobals())

it('reports provider outages without returning an action', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
  await expect(geminiProvider('test').reply('Pergunta', [], {})).rejects.toThrow('PROVIDER_UNAVAILABLE')
})

it('rejects malformed structured output', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"Ok","proposal":{"kind":"delete_all"}}' }] } }] }), { status: 200 })))
  await expect(geminiProvider('test').reply('Pergunta', [], {})).rejects.toThrow('PROVIDER_INVALID_RESPONSE')
})
