export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type FinancialAccountImport = {
  user_id: string
  connection_id: string
  external_account_id: string
  account_type: 'BANK' | 'CREDIT'
  subtype: string | null
  name: string
  currency_code: string
  balance: number | null
  credit_limit: number | null
  available_credit_limit: number | null
  minimum_payment: number | null
  balance_close_date: string | null
  balance_due_date: string | null
  details: Json
  last_synced_at: string
  updated_at: string
}

type FinancialTransactionImport = {
  user_id: string
  account_id: string
  external_transaction_id: string
  transaction_date: string
  amount: number
  currency_code: string
  description: string
  merchant_name: string | null
  provider_type: string | null
  operation_type: string | null
  status: 'PENDING' | 'POSTED'
  provider_category: string | null
  installment_number: number | null
  total_installments: number | null
  purchase_date: string | null
  external_bill_id: string | null
  bill_post_date: string | null
  bill_forecast_month: string | null
  raw_metadata: Json
  last_synced_at: string
  updated_at: string
}

type FinancialBillImport = {
  user_id: string
  account_id: string
  external_bill_id: string
  due_date: string
  closing_date: string | null
  total_amount: number
  currency_code: string
  minimum_payment_amount: number | null
  allows_installments: boolean | null
  raw_metadata: Json
  last_synced_at: string
  updated_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('PLUGGY_INVALID_RECORD')
  return value
}

function requiredText(row: Record<string, unknown>, key: string, maxLength: number): string {
  const value = row[key]
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw new Error('PLUGGY_INVALID_RECORD')
  return value
}

function optionalText(row: Record<string, unknown>, key: string, maxLength: number): string | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > maxLength) throw new Error('PLUGGY_INVALID_RECORD')
  return value
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('PLUGGY_INVALID_RECORD')
  return value
}

function optionalNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('PLUGGY_INVALID_RECORD')
  return value
}

function optionalInteger(row: Record<string, unknown>, key: string): number | null {
  const value = optionalNumber(row, key)
  if (value === null) return null
  if (!Number.isInteger(value) || value <= 0) throw new Error('PLUGGY_INVALID_RECORD')
  return value
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function requiredUuid(row: Record<string, unknown>, key: string): string {
  const value = requiredText(row, key, 64)
  if (!isUuid(value)) throw new Error('PLUGGY_INVALID_RECORD')
  return value
}

function dateOnly(value: unknown, required: boolean): string | null {
  if (value === null || value === undefined) {
    if (required) throw new Error('PLUGGY_INVALID_RECORD')
    return null
  }
  if (typeof value !== 'string') throw new Error('PLUGGY_INVALID_RECORD')
  const match = /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(value)
  if (!match) throw new Error('PLUGGY_INVALID_RECORD')
  const date = new Date(`${match[1]}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) throw new Error('PLUGGY_INVALID_RECORD')
  if (value.includes('T') && Number.isNaN(Date.parse(value))) throw new Error('PLUGGY_INVALID_RECORD')
  return match[1]
}

function optionalDateField(row: Record<string, unknown>, key: string): string | null {
  return dateOnly(row[key], false)
}

function currencyCode(row: Record<string, unknown>, key: string): string {
  const value = requiredText(row, key, 3).toUpperCase()
  if (value.length !== 3) throw new Error('PLUGGY_INVALID_RECORD')
  return value
}

function optionalJsonRecord(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = row[key]
  return value === null || value === undefined ? {} : asRecord(value)
}

function copyJsonField(source: Record<string, unknown>, key: string): Json {
  return source[key] === undefined ? null : toJson(source[key])
}

export function normalizeAccount(value: unknown, context: { userId: string; connectionId: string; itemId: string; syncedAt: string }): FinancialAccountImport {
  const row = asRecord(value)
  const externalAccountId = requiredUuid(row, 'id')
  if (requiredUuid(row, 'itemId') !== context.itemId) throw new Error('PLUGGY_ACCOUNT_ITEM_MISMATCH')
  const type = requiredText(row, 'type', 20)
  if (type !== 'BANK' && type !== 'CREDIT') throw new Error('PLUGGY_INVALID_RECORD')
  const creditData = optionalJsonRecord(row, 'creditData')
  return {
    user_id: context.userId,
    connection_id: context.connectionId,
    external_account_id: externalAccountId,
    account_type: type,
    subtype: optionalText(row, 'subtype', 80),
    name: requiredText(row, 'name', 200).trim(),
    currency_code: currencyCode(row, 'currencyCode'),
    balance: optionalNumber(row, 'balance'),
    credit_limit: optionalNumber(creditData, 'creditLimit'),
    available_credit_limit: optionalNumber(creditData, 'availableCreditLimit'),
    minimum_payment: optionalNumber(creditData, 'minimumPayment'),
    balance_close_date: optionalDateField(creditData, 'balanceCloseDate'),
    balance_due_date: optionalDateField(creditData, 'balanceDueDate'),
    details: {},
    last_synced_at: context.syncedAt,
    updated_at: context.syncedAt,
  }
}

export function normalizeTransaction(value: unknown, context: { userId: string; accountId: string; externalAccountId: string; syncedAt: string }): FinancialTransactionImport {
  const row = asRecord(value)
  const externalAccountId = requiredUuid(row, 'accountId')
  if (externalAccountId !== context.externalAccountId) throw new Error('PLUGGY_TRANSACTION_ACCOUNT_MISMATCH')
  const status = requiredText(row, 'status', 20)
  if (status !== 'PENDING' && status !== 'POSTED') throw new Error('PLUGGY_INVALID_RECORD')
  const cardMetadata = optionalJsonRecord(row, 'creditCardMetadata')
  const merchant = optionalJsonRecord(row, 'merchant')
  const forecast = optionalText(cardMetadata, 'billForecastDate', 7)
  if (forecast !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(forecast)) throw new Error('PLUGGY_INVALID_RECORD')
  const installmentNumber = optionalInteger(cardMetadata, 'installmentNumber')
  const totalInstallments = optionalInteger(cardMetadata, 'totalInstallments')
  if (installmentNumber !== null && totalInstallments !== null && installmentNumber > totalInstallments) throw new Error('PLUGGY_INVALID_RECORD')
  return {
    user_id: context.userId,
    account_id: context.accountId,
    external_transaction_id: requiredUuid(row, 'id'),
    transaction_date: dateOnly(row.date, true) ?? '',
    amount: requiredNumber(row, 'amount'),
    currency_code: currencyCode(row, 'currencyCode'),
    description: requiredText(row, 'description', 1000),
    merchant_name: optionalText(merchant, 'name', 300),
    provider_type: optionalText(row, 'type', 80),
    operation_type: optionalText(row, 'operationType', 120),
    status,
    provider_category: optionalText(row, 'category', 160),
    installment_number: installmentNumber,
    total_installments: totalInstallments,
    purchase_date: optionalDateField(cardMetadata, 'purchaseDate'),
    external_bill_id: optionalText(cardMetadata, 'billId', 128),
    bill_post_date: optionalDateField(cardMetadata, 'billPostDate'),
    bill_forecast_month: forecast,
    raw_metadata: {},
    last_synced_at: context.syncedAt,
    updated_at: context.syncedAt,
  }
}

export function normalizeBill(value: unknown, context: { userId: string; accountId: string; syncedAt: string }): FinancialBillImport {
  const row = asRecord(value)
  const allowsInstallments = row.allowsInstallments
  if (allowsInstallments !== null && allowsInstallments !== undefined && typeof allowsInstallments !== 'boolean') {
    throw new Error('PLUGGY_INVALID_RECORD')
  }
  return {
    user_id: context.userId,
    account_id: context.accountId,
    external_bill_id: requiredText(row, 'id', 128),
    due_date: dateOnly(row.dueDate, true) ?? '',
    closing_date: optionalDateField(row, 'billClosingDate'),
    total_amount: requiredNumber(row, 'totalAmount'),
    currency_code: currencyCode(row, 'totalAmountCurrencyCode'),
    minimum_payment_amount: optionalNumber(row, 'minimumPaymentAmount'),
    allows_installments: typeof allowsInstallments === 'boolean' ? allowsInstallments : null,
    raw_metadata: {},
    last_synced_at: context.syncedAt,
    updated_at: context.syncedAt,
  }
}
