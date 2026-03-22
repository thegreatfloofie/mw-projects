'use client'

import { useState } from 'react'
import { Task, Section } from '@/lib/types'

const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  'In Progress':      { bg: '#dce8ff', color: '#001fa8', dot: '#0038FF' },
  'Up Next':          { bg: '#feffc0', color: '#4a4500', dot: '#EEFF25' },
  'Awaiting Client':  { bg: '#ffe7de', color: '#7a2000', dot: '#FF5E30' },
  'Feedback Provided':{ bg: '#eeffb8', color: '#1a4a00', dot: '#CEFF58' },
  'Complete':         { bg: '#dde8e2', color: '#2d4a3a', dot: '#B4C6BB' },
}

interface Props {
  client: {
    id: string
    name: string
    am_name: string
    logo_url: string | null
    client_token: string
    updated_at: string
  }
  tasks: Task[]
}

function fmtDate(d: string | null) {
  if (!d) return ''
  const [y, m, dd] = d.split('-').map(Number)
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1] + ' ' + dd
}

function SectionTable({ title, accent, tasks }: { title: string; accent: string; tasks: Task[] }) {
  const [open, setOpen] = useState(true)
  if (tasks.length === 0) return null
  const today = new Date(); today.setHours(0,0,0,0)

  return (
    <div style={{ background: 'white', borderRadius: 12, marginBottom: 16, border: '1.5px solid #e5e7eb', overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(p => !p)}
      >
        <div style={{ width: 4, height: 18, borderRadius: 2, background: accent, flexShrink: 0 }}/>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{tasks.length} item{tasks.length !== 1 ? 's' : ''}</span>
        <svg style={{ width: 16, height: 16, color: '#9ca3af', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#F6F6F4', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              {['Deliverable','Status','Due','Link','Description','Comments'].map(h => (
                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#9ca3af', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => {
              const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG['Up Next']
              const overdue = t.due_date && new Date(t.due_date + 'T00:00:00') < today && t.status !== 'Complete'
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 12px', verticalAlign: 'top', color: '#374151', fontWeight: 600, width: '20%' }}>{t.name || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  <td style={{ padding: '9px 12px', verticalAlign: 'top', width: '14%' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }}/>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', verticalAlign: 'top', fontSize: 12, color: overdue ? '#FF5E30' : '#6b7280', fontWeight: overdue ? 700 : 400, width: '9%' }}>
                    {fmtDate(t.due_date) || <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 12px', verticalAlign: 'top', width: '9%' }}>
                    {t.link_url
                      ? <a href={t.link_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#f3f4f6', borderRadius: 20, fontSize: 11.5, fontWeight: 600, color: '#0038FF', textDecoration: 'none' }}>{t.link_label || 'Link'}</a>
                      : <span style={{ color: '#9ca3af' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '9px 12px', verticalAlign: 'top', color: '#6b7280', fontSize: 12.5, width: '26%' }}>{t.notes || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  <td style={{ padding: '9px 12px', verticalAlign: 'top', color: '#374151', fontSize: 12.5, width: '22%' }}>{t.comments || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function ClientPublicView({ client, tasks }: Props) {
  const mwTasks     = tasks.filter(t => t.section === 'mw')
  const clientTasks = tasks.filter(t => t.section === 'client')
  const doneTasks   = tasks.filter(t => t.section === 'done')
  const total       = tasks.length
  const completed   = doneTasks.length
  const inProgress  = tasks.filter(t => t.status === 'In Progress').length
  const awaitingYou = tasks.filter(t => t.status === 'Awaiting Client').length
  const pct         = total > 0 ? Math.round((completed / total) * 100) : 0
  const exportDate  = new Date(client.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: '#F6F6F4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#0C0C0C', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: 'white', letterSpacing: '-0.3px' }}>Marketwake</span>
          {client.logo_url && (
            <>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.2)' }}/>
              <img src={client.logo_url} alt={client.name} style={{ height: 22, width: 'auto', maxWidth: 120, objectFit: 'contain', borderRadius: 2 }}/>
            </>
          )}
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.2)' }}/>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white', background: 'rgba(255,255,255,.1)', padding: '4px 12px', borderRadius: 6 }}>{client.name}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.9px', textTransform: 'uppercase', color: '#0C0C0C', background: '#CEFF58', padding: '3px 10px', borderRadius: 20 }}>Deliverables</span>
      </header>

      <div style={{ flex: 1, padding: '32px 28px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        {/* Single stat — Awaiting You only */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'inline-block', background: 'white', borderRadius: 10, padding: '16px 24px', border: '1.5px solid #e5e7eb', borderLeftWidth: 4, borderLeftColor: '#FF5E30' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#111827' }}>{awaitingYou}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Awaiting Your Action</div>
          </div>
        </div>

        {/* Sections */}
        <SectionTable title="Marketwake Action Items" accent="#CEFF58" tasks={mwTasks}/>
        <SectionTable title={`${client.name} Action Items`} accent="#FF5E30" tasks={clientTasks}/>
        <SectionTable title="Completed" accent="#B4C6BB" tasks={doneTasks}/>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '32px 24px', fontSize: 12, color: '#9ca3af', background: 'white', borderTop: '1px solid #e5e7eb', marginTop: 8 }}>
        Built by <strong style={{ color: '#0C0C0C' }}>Marketwake</strong> with 🖤 &nbsp;·&nbsp; {exportDate}
      </footer>
    </div>
  )
}
