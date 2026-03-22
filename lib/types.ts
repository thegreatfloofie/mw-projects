// ── Database row shapes (mirror Supabase schema) ─────────────

export type Section = 'mw' | 'client' | 'done'

export type TaskStatus =
  | 'In Progress'
  | 'Up Next'
  | 'Awaiting Client'
  | 'Feedback Provided'
  | 'Complete'

export interface Client {
  id: string
  name: string
  am_name: string
  logo_url: string | null
  client_token: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  client_id: string
  section: Section | 'archived'
  origin: Section
  name: string
  notes: string
  status: TaskStatus
  due_date: string | null
  link_url: string
  link_label: string
  comments: string
  display_order: number
  ai_drafted: boolean
  created_at: string
  updated_at: string
}

export interface Draft {
  id: string
  client_id: string
  name: string
  notes: string
  status: TaskStatus
  target_section: 'mw' | 'client'
  due_date?: string | null
  drafted_at: string
}

// ── App-level shapes ──────────────────────────────────────────

export interface ClientWithStats extends Client {
  taskCount: number
  draftCount: number
  completedCount: number
  overdueCount: number
}

export interface TrackerData {
  client: Client
  tasks: Task[]
  drafts: Draft[]
}
