import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { TrackerData } from '@/lib/types'
import TrackerView from '@/components/TrackerView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TrackerPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch client + tasks + drafts in parallel
  const [clientRes, tasksRes, draftsRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('tasks').select('*').eq('client_id', id).order('display_order', { ascending: true }),
    supabase.from('drafts').select('*').eq('client_id', id).order('drafted_at', { ascending: true }),
  ])

  if (clientRes.error || !clientRes.data) notFound()

  const trackerData: TrackerData = {
    client: clientRes.data,
    tasks: tasksRes.data ?? [],
    drafts: draftsRes.data ?? [],
  }

  return <TrackerView data={trackerData} />
}
