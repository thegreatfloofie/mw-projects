'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Task, Section, TaskStatus } from '@/lib/types'
import { MW_LOGO } from '@/lib/logo'

const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  'In Progress':      { bg: '#dce8ff', color: '#001fa8', dot: '#0038FF' },
  'Up Next':          { bg: '#feffc0', color: '#4a4500', dot: '#EEFF25' },
  'Awaiting Client':  { bg: '#ffe7de', color: '#7a2000', dot: '#FF5E30' },
  'Feedback Provided':{ bg: '#f0e6ff', color: '#5b21b6', dot: '#7c3aed' },
  'Complete':         { bg: '#dde8e2', color: '#2d4a3a', dot: '#B4C6BB' },
}

const STATUSES = Object.keys(STATUS_CONFIG) as TaskStatus[]

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
  const [, m, dd] = d.split('-').map(Number)
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1] + ' ' + dd
}

// ── Editable row ───────────────────────────────────────────────
function TaskRow({
  task, token, onPatch,
}: {
  task: Task
  token: string
  onPatch: (id: string, patch: Partial<Task>) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingComment, setEditingComment] = useState(false)
  const [commentDraft, setCommentDraft] = useState(task.comments ?? '')
  const [saving, setSaving] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG['Up Next']
  const today = new Date(); today.setHours(0,0,0,0)
  const overdue = task.due_date && new Date(task.due_date + 'T00:00:00') < today && task.status !== 'Complete'

  // Close picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  async function updateField(patch: Partial<Task>) {
    setSaving(true)
    onPatch(task.id, patch) // optimistic
    await fetch('/api/client-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, taskId: task.id, patch }),
    })
    setSaving(false)
  }

  async function saveComment() {
    await updateField({ comments: commentDraft })
    setEditingComment(false)
  }

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      {/* Deliverable */}
      <td style={{ padding: '9px 12px', verticalAlign: 'middle', color: '#374151', fontWeight: 600, width: '22%' }}>
        {task.name || <span style={{ color: '#9ca3af' }}>—</span>}
      </td>

      {/* Status — clickable picker */}
      <td style={{ padding: '9px 12px', verticalAlign: 'middle', width: '16%', position: 'relative' }}>
        <div ref={pickerRef} style={{ position: 'relative', display: 'inline-block' }}>
          <span
            title="Click to update status"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
              cursor: 'pointer', userSelect: 'none', transition: 'opacity .12s',
            }}
            onClick={() => setPickerOpen(p => !p)}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }}/>
            {task.status}
            <svg style={{ width: 10, height: 10, marginLeft: 2, opacity: .6 }} viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          {pickerOpen && (
            <div style={{
              position: 'absolute', left: 0, top: 'calc(100% + 4px)', background: 'white',
              border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,.1)',
              zIndex: 200, minWidth: 170, padding: 4,
            }}>
              {STATUSES.map(s => {
                const sc = STATUS_CONFIG[s]
                return (
                  <div
                    key={s}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      borderRadius: 5, cursor: 'pointer', fontSize: 12.5, color: '#374151',
                      background: task.status === s ? '#f3f4f6' : 'transparent',
                      fontWeight: task.status === s ? 700 : 400,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={e => (e.currentTarget.style.background = task.status === s ? '#f3f4f6' : 'transparent')}
                    onClick={() => { updateField({ status: s }); setPickerOpen(false) }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0 }}/>
                    {s}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </td>

      {/* Due */}
      <td style={{ padding: '9px 12px', verticalAlign: 'middle', fontSize: 12, color: overdue ? '#FF5E30' : '#6b7280', fontWeight: overdue ? 700 : 400, width: '9%' }}>
        {fmtDate(task.due_date) || <span style={{ color: '#9ca3af' }}>—</span>}
      </td>

      {/* Link */}
      <td style={{ padding: '9px 12px', verticalAlign: 'middle', width: '9%' }}>
        {task.link_url
          ? <a href={task.link_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#f3f4f6', borderRadius: 20, fontSize: 11.5, fontWeight: 600, color: '#0038FF', textDecoration: 'none' }}>{task.link_label || 'Link'}</a>
          : <span style={{ color: '#9ca3af' }}>—</span>
        }
      </td>

      {/* Description */}
      <td style={{ padding: '9px 12px', verticalAlign: 'middle', color: '#6b7280', fontSize: 12.5, width: '22%' }}>
        {task.notes || <span style={{ color: '#9ca3af' }}>—</span>}
      </td>

      {/* Comments — editable */}
      <td style={{ padding: '9px 12px', verticalAlign: 'middle', width: '22%' }}>
        {editingComment ? (
          <div>
            <textarea
              value={commentDraft}
              onChange={e => setCommentDraft(e.target.value)}
              autoFocus
              style={{
                width: '100%', fontSize: 12.5, border: '1.5px solid #0038FF', borderRadius: 5,
                padding: '5px 8px', resize: 'none', outline: 'none', height: 64, fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                onClick={saveComment}
                disabled={saving}
                style={{ padding: '3px 10px', fontSize: 11.5, fontWeight: 700, border: 'none', borderRadius: 5, background: '#0C0C0C', color: 'white', cursor: 'pointer' }}
              >{saving ? '…' : 'Save'}</button>
              <button
                onClick={() => { setEditingComment(false); setCommentDraft(task.comments ?? '') }}
                style={{ padding: '3px 10px', fontSize: 11.5, fontWeight: 600, border: '1.5px solid #e5e7eb', borderRadius: 5, background: 'white', color: '#6b7280', cursor: 'pointer' }}
              >Cancel</button>
            </div>
          </div>
        ) : (
          <div
            title="Click to add or edit a comment"
            onClick={() => { setCommentDraft(task.comments ?? ''); setEditingComment(true) }}
            style={{
              cursor: 'pointer', borderRadius: 4, padding: '2px 4px', margin: '-2px -4px',
              color: task.comments ? '#374151' : '#9ca3af', fontSize: 12.5,
              transition: 'background .1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {task.comments || 'Add comment…'}
            {task.comments && <span style={{ marginLeft: 6, fontSize: 10, color: '#9ca3af' }}>✎</span>}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Section table ──────────────────────────────────────────────
function SectionTable({
  title, accent, tasks, token, onPatch,
}: {
  title: string; accent: string; tasks: Task[]
  token: string; onPatch: (id: string, patch: Partial<Task>) => void
}) {
  const [open, setOpen] = useState(true)
  if (tasks.length === 0) return null

  return (
    <div style={{ background: 'white', borderRadius: 12, marginBottom: 16, border: '1.5px solid #e5e7eb', overflow: 'visible', position: 'relative' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', userSelect: 'none', borderRadius: open ? '12px 12px 0 0' : 12 }}
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, overflow: 'visible' }}>
          <thead style={{ background: '#F6F6F4', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              {['Deliverable','Status','Due','Link','Description','Comments'].map(h => (
                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#9ca3af', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <TaskRow key={t.id} task={t} token={token} onPatch={onPatch} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────
export default function ClientPublicView({ client, tasks: initialTasks }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)

  // Optimistic local patch — API call happens inside TaskRow
  function handlePatch(id: string, patch: Partial<Task>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  // Auto-refresh every 30s + on tab focus so AM changes appear
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30_000)
    const onFocus = () => router.refresh()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [router])

  // When server re-renders, sync new task data into state
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])

  const today       = new Date(); today.setHours(0, 0, 0, 0)
  const mwTasks     = tasks.filter(t => t.section === 'mw')
  const clientTasks = tasks.filter(t => t.section === 'client')
  const doneTasks   = tasks.filter(t => t.section === 'done')
  const awaitingYou = tasks.filter(t => t.status === 'Awaiting Client').length
  const overdueTasks = tasks.filter(t =>
    t.status === 'Awaiting Client' &&
    t.due_date &&
    new Date(t.due_date + 'T00:00:00') < today
  )
  const exportDate  = new Date(client.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: '#F6F6F4', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <header style={{ background: '#0C0C0C', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={MW_LOGO} alt="Marketwake" style={{ height: 22, width: 'auto', display: 'block', filter: 'invert(1)' }}/>
          {client.logo_url && (
            <>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.2)' }}/>
              <img src={client.logo_url} alt={client.name} style={{ height: 22, width: 'auto', maxWidth: 120, objectFit: 'contain', borderRadius: 2 }}/>
            </>
          )}
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.2)' }}/>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white', background: 'rgba(255,255,255,.1)', padding: '4px 12px', borderRadius: 6 }}>{client.name}</span>
        </div>
      </header>

      <div style={{ flex: 1, padding: '32px 28px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        {/* Stat card */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'inline-block', background: 'white', borderRadius: 10, padding: '16px 24px', border: '1.5px solid #e5e7eb', borderLeftWidth: 4, borderLeftColor: '#FF5E30' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#111827' }}>{awaitingYou}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Awaiting Your Action</div>
          </div>
        </div>

        {/* Editable hint */}
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#9ca3af" strokeWidth="1.2"/><path d="M6 5.5v3M6 4h.01" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round"/></svg>
          You can update <strong style={{ color: '#6b7280' }}>Status</strong> and add <strong style={{ color: '#6b7280' }}>Comments</strong> on any row.
        </div>

        {/* Overdue panel — only visible when there are overdue "Awaiting Client" items */}
        {overdueTasks.length > 0 && (
          <div style={{
            background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 10,
            padding: '14px 18px', marginBottom: 20,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M9 1.5L1.5 15h15L9 1.5z" stroke="#dc2626" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 7v4M9 13h.01" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>
                {overdueTasks.length} overdue item{overdueTasks.length !== 1 ? 's' : ''} need{overdueTasks.length === 1 ? 's' : ''} your attention
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {overdueTasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      {t.name || 'Untitled'}
                    </span>
                    <span style={{ color: '#9ca3af' }}>·</span>
                    <span style={{ color: '#dc2626', fontSize: 11.5, fontWeight: 700 }}>
                      Due {fmtDate(t.due_date)}
                    </span>
                    <span style={{ color: '#9ca3af' }}>·</span>
                    <span style={{ color: '#6b7280', fontSize: 11.5 }}>
                      {t.section === 'client' ? `${client.name} Action Item` : 'Marketwake Action Item'}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 8 }}>
                Please update the status on each item below once you've taken action.
              </div>
            </div>
          </div>
        )}

        {/* Sections */}
        <SectionTable title="Marketwake Action Items"    accent="#CEFF58"  tasks={mwTasks}     token={client.client_token} onPatch={handlePatch}/>
        <SectionTable title={`${client.name} Action Items`} accent="#FF5E30" tasks={clientTasks} token={client.client_token} onPatch={handlePatch}/>
        <SectionTable title="Completed"                  accent="#B4C6BB"  tasks={doneTasks}   token={client.client_token} onPatch={handlePatch}/>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '32px 24px', fontSize: 12, color: '#9ca3af', background: 'white', borderTop: '1px solid #e5e7eb', marginTop: 8 }}>
        Built by <strong style={{ color: '#0C0C0C' }}>Marketwake</strong> with 🖤 &nbsp;·&nbsp; {exportDate}
      </footer>
    </div>
  )
}
