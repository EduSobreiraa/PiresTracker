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
export type StudyGoal = { id: string; user_id: string | null; track: StudyTrack; title: string; description: string | null; week_start: string; completed_at: string | null; parent_goal_id: string | null; optional: boolean; waivable: boolean; waived_at: string | null; archived_at: string | null }
export type StudyGoalDraft = Pick<StudyGoal, 'track' | 'title' | 'description' | 'week_start'> & { parent_goal_id?: string | null } & Partial<Pick<StudyGoal, 'optional' | 'waivable'>>
export type Project = { id: string; user_id: string | null; seed_key: string | null; name: string; description: string | null; created_at: string; updated_at: string }
export type ProjectStage = { id: string; user_id: string | null; project_id: string; seed_key: string | null; title: string; description: string | null; position: number; completed_at: string | null; created_at: string; updated_at: string }
export type ProjectTask = { id: string; user_id: string | null; project_id: string; stage_id: string; seed_key: string | null; title: string; description: string | null; planned_week: string | null; position: number; optional: boolean; waivable: boolean; completed_at: string | null; waived_at: string | null; created_at: string; updated_at: string }
export type ProjectDraft = Pick<Project, 'name' | 'description'>
export type ProjectStageDraft = Pick<ProjectStage, 'title' | 'description' | 'position'>
export type ProjectTaskDraft = Pick<ProjectTask, 'title' | 'description' | 'planned_week' | 'position' | 'optional' | 'waivable'>
export type ProjectTree = { projects: Project[]; stages: ProjectStage[]; tasks: ProjectTask[] }

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
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
