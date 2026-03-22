import { createServiceRoleClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Task, Section } from '@/lib/types'
import ClientPublicView from '@/components/ClientPublicView'

interface Props {
  params: Promise<{ token: string }>
}

export default async function ClientPage({ params }: Props) {
  const { token } = await params

  // Use service role — this route is public (no AM session)
  // The token acts as the access credential; no auth required
  const supabase = createServiceRoleClient()

  // Look up client by token
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name, am_name, logo_url, client_token, updated_at')
    .eq('client_token', token)
    .single()

  if (clientError || !client) notFound()

  // Fetch tasks — exclude drafts and archived items
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, section, name, notes, status, due_date, link_url, link_label, comments, display_order, ai_drafted')
    .eq('client_id', client.id)
    .in('section', ['mw', 'client', 'done'])
    .order('display_order', { ascending: true })

  return (
    <ClientPublicView
      client={client}
      tasks={(tasks ?? []) as Task[]}
    />
  )
}

// Always fetch fresh — ensures items added by AM show up immediately
export const revalidate = 0
