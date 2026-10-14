export type InterStatementEntry = {
  date: string
  history: string
  description: string
  amount: number
  balance: number
}

export type InterStatement = {
  entries: InterStatementEntry[]
  periodStart: string
  periodEnd: string
}

const headers = ['Data Lançamento', 'Histórico', 'Descrição', 'Valor', 'Saldo']

export function parseInterStatement(csv: string): InterStatement {
  const rows = parseRows(csv.replace(/^\uFEFF/, ''))
  const headerIndex = rows.findIndex((row) => row.map((cell) => cell.trim()).join('\0') === headers.join('\0'))
  if (headerIndex < 0) throw new Error('O arquivo não tem o formato esperado do extrato do Inter.')

  const entries: InterStatementEntry[] = []
  for (const [index, row] of rows.slice(headerIndex + 1).entries()) {
    if (row.every((cell) => cell.trim() === '')) continue
    if (row.length !== headers.length) throw new Error(`A linha ${headerIndex + index + 2} do CSV tem colunas inválidas.`)
    entries.push({
      date: parseDate(row[0].trim()),
      history: row[1].trim(),
      description: row[2].trim(),
      amount: parseAmount(row[3]),
      balance: parseAmount(row[4]),
    })
  }

  if (entries.length === 0) throw new Error('O extrato do Inter não contém movimentações.')
  const dates = entries.map(({ date }) => date).sort()
  return { entries, periodStart: dates[0], periodEnd: dates[dates.length - 1] }
}

function parseRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ';') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (character === '\r' && csv[index + 1] === '\n') index += 1
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('O arquivo CSV contém aspas sem fechamento.')
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function parseDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) throw new Error('O extrato contém uma data inválida.')
  const [, day, month, year] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (date.getUTCDate() !== Number(day) || date.getUTCMonth() !== Number(month) - 1) {
    throw new Error('O extrato contém uma data inválida.')
  }
  return `${year}-${month}-${day}`
}

function parseAmount(value: string): number {
  const normalized = value.trim().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) throw new Error('O extrato contém um valor inválido.')
  const amount = Number(normalized)
  if (!Number.isFinite(amount)) throw new Error('O extrato contém um valor inválido.')
  return amount
}
