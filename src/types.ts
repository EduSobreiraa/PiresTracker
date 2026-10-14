export const categories = ['commitment', 'study', 'gym'] as const
export type Category = (typeof categories)[number]

export type RoutineItem = {
  id: string
  user_id: string | null
  weekday: number
  starts_at: string
  ends_at: string
  title: string
  category: Category
  is_trackable: boolean
  active: boolean
}

export type Completion = {
  id: string
  user_id: string | null
  routine_item_id: string
  local_date: string
  completed_at: string | null
}

export type LifeEvent = { id: string; user_id: string | null; title: string; event_date: string; description: string | null; created_at: string; updated_at: string }
export type LifeEventDraft = Pick<LifeEvent, 'title' | 'event_date' | 'description'>

export type RoutineDraft = Pick<RoutineItem, 'weekday' | 'starts_at' | 'ends_at' | 'title' | 'category'>
export type StudyTrack = 'aws' | 'gpt'
export type StudyGoal = { id: string; user_id: string | null; track: StudyTrack; title: string; description: string | null; week_start: string; completed_at: string | null; parent_goal_id: string | null; optional: boolean; waivable: boolean; waived_at: string | null; archived_at: string | null }
export type StudyGoalDraft = Pick<StudyGoal, 'track' | 'title' | 'description' | 'week_start'> & { parent_goal_id?: string | null } & Partial<Pick<StudyGoal, 'optional' | 'waivable'>>
export type Project = { id: string; user_id: string | null; seed_key: string | null; name: string; description: string | null; created_at: string; updated_at: string }
export type ProjectStage = { id: string; user_id: string | null; project_id: string; seed_key: string | null; title: string; description: string | null; position: number; completed_at: string | null; created_at: string; updated_at: string }
export type ProjectTask = { id: string; user_id: string | null; project_id: string; stage_id: string; seed_key: string | null; title: string; description: string | null; planned_week: string | null; position: number; optional: boolean; waivable: boolean; completed_at: string | null; waived_at: string | null; created_at: string; updated_at: string }
export type ProjectDraft = Pick<Project, 'name' | 'description'>
export type ProjectStageDraft = Pick<ProjectStage, 'title' | 'description' | 'position'>
export type ProjectTaskDraft = Pick<ProjectTask, 'title' | 'description' | 'planned_week' | 'position' | 'optional' | 'waivable'>
export type ProjectTree = { projects: Project[]; stages: ProjectStage[]; tasks: ProjectTask[] }

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type FinancialConnection = { id: string; user_id: string; provider: 'pluggy'; external_item_id: string; institution_name: string; status: 'ACTIVE' | 'PENDING' | 'ERROR' | 'DISCONNECTED'; last_synced_at: string | null; next_auto_sync_at: string | null; consent_expires_at: string | null; created_at: string; updated_at: string }
export type FinancialAccount = { id: string; user_id: string; connection_id: string; external_account_id: string; account_type: 'BANK' | 'CREDIT'; subtype: string | null; name: string; currency_code: string; balance: number | null; credit_limit: number | null; available_credit_limit: number | null; minimum_payment: number | null; balance_close_date: string | null; balance_due_date: string | null; details: Json; last_synced_at: string; created_at: string; updated_at: string }
export type FinancialTransaction = { id: string; user_id: string; account_id: string; external_transaction_id: string; transaction_date: string; amount: number; currency_code: string; description: string; merchant_name: string | null; provider_type: string | null; operation_type: string | null; status: 'PENDING' | 'POSTED'; provider_category: string | null; manual_category: string | null; installment_number: number | null; total_installments: number | null; purchase_date: string | null; external_bill_id: string | null; bill_post_date: string | null; bill_forecast_month: string | null; raw_metadata: Json; last_synced_at: string; created_at: string; updated_at: string }
export type FinancialArchivedTransaction = { id: string; user_id: string; source_row: number; transaction_date: string; history: string; description: string; amount: number; balance: number; created_at: string }
export type FinancialBill = { id: string; user_id: string; account_id: string; external_bill_id: string; due_date: string; closing_date: string | null; total_amount: number; currency_code: string; minimum_payment_amount: number | null; allows_installments: boolean | null; raw_metadata: Json; last_synced_at: string; created_at: string; updated_at: string }
export type FinancialSyncExecution = { id: string; user_id: string; connection_id: string; status: 'RUNNING' | 'SUCCEEDED' | 'FAILED'; accounts_count: number; transactions_count: number; bills_count: number; error_code: string | null; started_at: string; finished_at: string | null }

type RoutineItemRow = Omit<RoutineItem, 'category' | 'user_id'> & { category: string; user_id: string; created_at: string }
type CompletionRow = Omit<Completion, 'user_id'> & { user_id: string; created_at: string }

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' }
  public: {
    Tables: {
      routine_items: {
        Row: RoutineItemRow
        Insert: Omit<RoutineItemRow, 'id' | 'created_at' | 'active'> & { id?: string; created_at?: string; active?: boolean }
        Update: Partial<RoutineItemRow>
        Relationships: []
      }
      completions: {
        Row: CompletionRow
        Insert: Omit<CompletionRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<CompletionRow>
        Relationships: [{
          foreignKeyName: 'completions_item_owner_fk'
          columns: ['routine_item_id', 'user_id']
          isOneToOne: false
          referencedRelation: 'routine_items'
          referencedColumns: ['id', 'user_id']
        }]
      }
      study_goals: {
        Row: Omit<StudyGoal, 'user_id' | 'parent_goal_id'> & { user_id: string; parent_goal_id: string | null; created_at: string; updated_at: string }
        Insert: Omit<StudyGoal, 'id' | 'user_id' | 'completed_at' | 'parent_goal_id' | 'optional' | 'waivable' | 'waived_at' | 'archived_at'> & { user_id: string; completed_at?: string | null; parent_goal_id?: string | null; optional?: boolean; waivable?: boolean; waived_at?: string | null; archived_at?: string | null; id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<StudyGoal, 'id' | 'user_id'>>
        Relationships: []
      },
      projects: {
        Row: Omit<Project, 'user_id'> & { user_id: string }
        Insert: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string; user_id: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<Project, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      },
      project_stages: {
        Row: Omit<ProjectStage, 'user_id'> & { user_id: string }
        Insert: Omit<ProjectStage, 'id' | 'user_id' | 'completed_at' | 'created_at' | 'updated_at'> & { id?: string; user_id: string; completed_at?: string | null; created_at?: string; updated_at?: string }
        Update: Partial<Omit<ProjectStage, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      },
      project_tasks: {
        Row: Omit<ProjectTask, 'user_id'> & { user_id: string }
        Insert: Omit<ProjectTask, 'id' | 'user_id' | 'completed_at' | 'waived_at' | 'created_at' | 'updated_at'> & { id?: string; user_id: string; completed_at?: string | null; waived_at?: string | null; created_at?: string; updated_at?: string }
        Update: Partial<Omit<ProjectTask, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      },
      life_events: {
        Row: Omit<LifeEvent, 'user_id'> & { user_id: string }
        Insert: Omit<LifeEvent, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string; user_id: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<LifeEvent, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      },
      financial_connections: {
        Row: FinancialConnection
        Insert: Omit<FinancialConnection, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<FinancialConnection, 'id' | 'user_id' | 'provider' | 'external_item_id' | 'created_at'>>
        Relationships: []
      },
      financial_accounts: {
        Row: FinancialAccount
        Insert: Omit<FinancialAccount, 'id' | 'created_at' | 'updated_at' | 'last_synced_at'> & { id?: string; created_at?: string; updated_at?: string; last_synced_at?: string }
        Update: Partial<Omit<FinancialAccount, 'id' | 'user_id' | 'connection_id' | 'external_account_id' | 'created_at'>>
        Relationships: [{
          foreignKeyName: 'financial_accounts_connection_owner_fk'
          columns: ['connection_id', 'user_id']
          isOneToOne: false
          referencedRelation: 'financial_connections'
          referencedColumns: ['id', 'user_id']
        }]
      },
      financial_transactions: {
        Row: FinancialTransaction
        Insert: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at' | 'last_synced_at' | 'manual_category'> & { id?: string; created_at?: string; updated_at?: string; last_synced_at?: string; manual_category?: string | null }
        Update: Partial<Omit<FinancialTransaction, 'id' | 'user_id' | 'account_id' | 'external_transaction_id' | 'created_at'>>
        Relationships: [{
          foreignKeyName: 'financial_transactions_account_owner_fk'
          columns: ['account_id', 'user_id']
          isOneToOne: false
          referencedRelation: 'financial_accounts'
          referencedColumns: ['id', 'user_id']
        }]
      },
      financial_archived_transactions: {
        Row: FinancialArchivedTransaction
        Insert: Omit<FinancialArchivedTransaction, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<FinancialArchivedTransaction, 'id' | 'user_id' | 'source_row' | 'created_at'>>
        Relationships: []
      },
      financial_bills: {
        Row: FinancialBill
        Insert: Omit<FinancialBill, 'id' | 'created_at' | 'updated_at' | 'last_synced_at'> & { id?: string; created_at?: string; updated_at?: string; last_synced_at?: string }
        Update: Partial<Omit<FinancialBill, 'id' | 'user_id' | 'account_id' | 'external_bill_id' | 'created_at'>>
        Relationships: [{
          foreignKeyName: 'financial_bills_account_owner_fk'
          columns: ['account_id', 'user_id']
          isOneToOne: false
          referencedRelation: 'financial_accounts'
          referencedColumns: ['id', 'user_id']
        }]
      },
      financial_sync_executions: {
        Row: FinancialSyncExecution
        Insert: Omit<FinancialSyncExecution, 'id' | 'started_at' | 'finished_at' | 'accounts_count' | 'transactions_count' | 'bills_count'> & { id?: string; started_at?: string; finished_at?: string | null; accounts_count?: number; transactions_count?: number; bills_count?: number }
        Update: Partial<Omit<FinancialSyncExecution, 'id' | 'user_id' | 'connection_id' | 'started_at'>>
        Relationships: [{
          foreignKeyName: 'financial_sync_executions_connection_owner_fk'
          columns: ['connection_id', 'user_id']
          isOneToOne: false
          referencedRelation: 'financial_connections'
          referencedColumns: ['id', 'user_id']
        }]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
