import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../../src/types.ts'
import { parseInterStatement } from '../../src/interStatement.ts'

const [userId, csvPath, confirmation] = Deno.args
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!userId || !/^[0-9a-f-]{36}$/i.test(userId) || !csvPath || confirmation !== '--confirm-owner-and-static-archive') {
  throw new Error('Uso: deno run --allow-env --allow-net --allow-read supabase/scripts/bootstrap-inter-archive.ts <user-uuid> <csv-path> --confirm-owner-and-static-archive')
}
if (!supabaseUrl || !serviceRoleKey) throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.')
if (new URL(supabaseUrl).hostname !== 'vwroeysxtkzryizzqnjq.supabase.co') throw new Error('SUPABASE_URL não corresponde ao projeto PiresTracker esperado.')

const csv = await Deno.readTextFile(csvPath)
const statement = parseInterStatement(csv)
const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(userId)
if (userError || !userResult.user) throw new Error('O UUID informado não corresponde a um usuário do Supabase.')

const rows = statement.entries.map((entry, index) => ({
  user_id: userId,
  source_row: index + 1,
  transaction_date: entry.date,
  history: entry.history,
  description: entry.description,
  amount: entry.amount,
  balance: entry.balance,
}))

for (let offset = 0; offset < rows.length; offset += 100) {
  const { error } = await supabase.from('financial_archived_transactions').upsert(rows.slice(offset, offset + 100), { onConflict: 'user_id,source_row' })
  if (error) throw new Error(`Falha ao importar lote ${Math.floor(offset / 100) + 1}: ${error.code}`)
}

const { count, error: countError } = await supabase.from('financial_archived_transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
if (countError) throw new Error(`Não foi possível conferir a importação: ${countError.code}`)
if (count !== rows.length) throw new Error(`A conferência retornou ${count ?? 0} registros; esperado ${rows.length}.`)
console.log(`Arquivo histórico do Inter carregado: ${count} movimentações.`)
