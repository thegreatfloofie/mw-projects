import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS, safe because we verify the token server-side
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { token, taskId, patch } = await req.json()

  if (!token || !taskId || !patch) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify the token belongs to a real client
  const { data: clientRow } = await supabaseAdmin
    .from('clients')
    .select('id')
    .eq('client_token', token)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Only allow clients to update status and comments — nothing else
  const safePatch: Record<string, unknown> = {}
  if (patch.status   !== undefined) safePatch.status   = patch.status
  if (patch.comments !== undefined) safePatch.comments = patch.comments

  if (Object.keys(safePatch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('tasks')
    .update(safePatch)
    .eq('id', taskId)
    .eq('client_id', clientRow.id)   // ensure task belongs to this client

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
