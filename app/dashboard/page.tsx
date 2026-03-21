import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientWithStats } from '@/lib/types'
import Dashboard from '@/components/Dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Verify session (middleware handles redirect, this is a belt-and-suspenders check)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all clients with task + draft counts
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*, tasks(id, status), drafts(id)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load clients:', error)
  }

  // Shape data for the Dashboard component
  const clientsWithStats: ClientWithStats[] = (clients ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    am_name: c.am_name,
    logo_url: c.logo_url,
    client_token: c.client_token,
    created_at: c.created_at,
    updated_at: c.updated_at,
    taskCount: (c.tasks ?? []).length,
    draftCount: (c.drafts ?? []).length,
    completedCount: (c.tasks ?? []).filter((t: any) => t.status === 'Complete').length,
  }))

  return <Dashboard initialClients={clientsWithStats} />
}
