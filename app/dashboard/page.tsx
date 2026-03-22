import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientWithStats } from '@/lib/types'
import Dashboard from '@/components/Dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch clients with task counts + due dates for overdue detection
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*, tasks(id, status, due_date, section), drafts(id)')
    .order('created_at', { ascending: false })

  if (error) console.error('Failed to load clients:', error)

  const today = new Date().toISOString().split('T')[0]

  const clientsWithStats: ClientWithStats[] = (clients ?? []).map((c: any) => {
    const liveTasks = (c.tasks ?? []).filter((t: any) => t.section !== 'archived')
    return {
      id: c.id,
      name: c.name,
      am_name: c.am_name,
      logo_url: c.logo_url,
      client_token: c.client_token,
      created_at: c.created_at,
      updated_at: c.updated_at,
      taskCount: liveTasks.length,
      draftCount: (c.drafts ?? []).length,
      completedCount: liveTasks.filter((t: any) => t.status === 'Complete').length,
      overdueCount: liveTasks.filter((t: any) =>
        t.due_date && t.due_date < today && t.status !== 'Complete'
      ).length,
    }
  })

  return <Dashboard initialClients={clientsWithStats} />
}
