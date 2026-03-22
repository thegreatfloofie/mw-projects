import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface ImportTask {
  name: string
  notes?: string
  status?: string
  section?: 'mw' | 'client'
  due_date?: string | null
}

const VALID_STATUSES = ['In Progress', 'Up Next', 'Awaiting Client', 'Feedback Provided', 'Complete']

export async function POST(req: NextRequest) {
  const { clientId, tasks } = await req.json()

  if (!clientId || !Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'Missing clientId or tasks array' }, { status: 400 })
  }

  // Verify the client exists
  const { data: clientRow } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const drafts = tasks.map((t: ImportTask) => ({
    client_id: clientId,
    name: String(t.name || '').trim(),
    notes: String(t.notes || '').trim(),
    status: VALID_STATUSES.includes(t.status ?? '') ? t.status : 'Up Next',
    target_section: t.section === 'client' ? 'client' : 'mw',
    due_date: t.due_date || null,
  })).filter(d => d.name.length > 0)

  if (drafts.length === 0) {
    return NextResponse.json({ error: 'No valid tasks (all missing name)' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('drafts')
    .insert(drafts)
    .select('id, name, target_section, status')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, inserted: data?.length ?? 0, drafts: data })
}
