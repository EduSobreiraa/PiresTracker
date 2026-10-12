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

export type RoutineDraft = Pick<RoutineItem, 'weekday' | 'starts_at' | 'ends_at' | 'title' | 'category'>
export type StudyTrack = 'aws' | 'gpt'
export type StudyGoal = { id: string; user_id: string | null; track: StudyTrack; title: string; description: string | null; week_start: string; completed_at: string | null; parent_goal_id?: string | null }
export type StudyGoalDraft = Pick<StudyGoal, 'track' | 'title' | 'description' | 'week_start' | 'parent_goal_id'>

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
        Insert: Omit<StudyGoal, 'id' | 'user_id' | 'completed_at' | 'parent_goal_id'> & { user_id: string; completed_at?: string | null; parent_goal_id?: string | null; id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<StudyGoal, 'id' | 'user_id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
