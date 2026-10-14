const apiBase = 'https://api.pluggy.ai'
const pageSize = 500
const maximumPages = 10_000

type PluggyClientOptions = {
  fetcher?: typeof fetch
  wait?: (milliseconds: number) => Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('PLUGGY_INVALID_RESPONSE')
  return value
}

async function requestJson(apiKey: string, path: string, fetcher: typeof fetch, wait: (milliseconds: number) => Promise<void>): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response: Response
    try {
      response = await fetcher(`${apiBase}${path}`, {
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      if (attempt === 2) throw new Error('PLUGGY_NETWORK_ERROR')
      await wait(250 * (2 ** attempt))
      continue
    }

    if (!response.ok) {
      await response.body?.cancel()
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await wait(250 * (2 ** attempt))
        continue
      }
      throw new Error(`PLUGGY_HTTP_${response.status}`)
    }

    try {
      const body: unknown = await response.json()
      return body
    } catch {
      throw new Error('PLUGGY_INVALID_RESPONSE')
    }
  }
  throw new Error('PLUGGY_NETWORK_ERROR')
}

function pageResponse(value: unknown): { results: unknown[]; totalPages: number } {
  const body = record(value)
  if (!Array.isArray(body.results) || typeof body.totalPages !== 'number'
    || !Number.isInteger(body.totalPages) || body.totalPages < 0 || body.totalPages > maximumPages) {
    throw new Error('PLUGGY_PAGINATION_INVALID')
  }
  return { results: body.results, totalPages: body.totalPages }
}

async function listPageNumberResults(apiKey: string, pathForPage: (page: number) => string, fetcher: typeof fetch, wait: (milliseconds: number) => Promise<void>): Promise<unknown[]> {
  const results: unknown[] = []
  let totalPages = 1
  for (let page = 1; page <= totalPages; page += 1) {
    const response = pageResponse(await requestJson(apiKey, pathForPage(page), fetcher, wait))
    totalPages = Math.max(1, response.totalPages)
    results.push(...response.results)
  }
  return results
}

function nextTransactionPath(next: string, accountId: string): string {
  if (!next.startsWith('?') || next.length > 4096) throw new Error('PLUGGY_PAGINATION_INVALID')
  const url = new URL(next, `${apiBase}/v2/transactions`)
  if (url.origin !== apiBase || url.pathname !== '/v2/transactions' || url.searchParams.get('accountId') !== accountId) {
    throw new Error('PLUGGY_PAGINATION_INVALID')
  }
  return `${url.pathname}${url.search}`
}

export function createPluggyFinanceClient(apiKey: string, options: PluggyClientOptions = {}) {
  const fetcher = options.fetcher ?? fetch
  const wait = options.wait ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)))

  return {
    listAccounts(itemId: string): Promise<unknown[]> {
      return listPageNumberResults(apiKey, (page) => {
        const query = new URLSearchParams({ itemId, page: String(page), pageSize: String(pageSize) })
        return `/accounts?${query}`
      }, fetcher, wait)
    },

    listBills(accountId: string): Promise<unknown[]> {
      return listPageNumberResults(apiKey, (page) => {
        const query = new URLSearchParams({ accountId, page: String(page), pageSize: String(pageSize) })
        return `/bills?${query}`
      }, fetcher, wait)
    },

    async listTransactions(accountId: string): Promise<unknown[]> {
      let path = `/v2/transactions?${new URLSearchParams({ accountId })}`
      const visited = new Set<string>()
      const results: unknown[] = []
      for (let page = 0; page < maximumPages; page += 1) {
        if (visited.has(path)) throw new Error('PLUGGY_PAGINATION_INVALID')
        visited.add(path)
        const body = record(await requestJson(apiKey, path, fetcher, wait))
        if (!Array.isArray(body.results) || (body.next !== null && typeof body.next !== 'string')) {
          throw new Error('PLUGGY_PAGINATION_INVALID')
        }
        results.push(...body.results)
        if (body.next === null) return results
        path = nextTransactionPath(body.next, accountId)
      }
      throw new Error('PLUGGY_PAGINATION_INVALID')
    },
  }
}
