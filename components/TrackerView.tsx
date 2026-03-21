'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TrackerData, Task, Draft, Section, TaskStatus, Client } from '@/lib/types'
import MWLogo from './MWLogo'
import MickeyCelebration from './MickeyCelebration'

// ── Status config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  'In Progress':      { bg: '#dce8ff', color: '#001fa8', dot: '#0038FF' },
  'Up Next':          { bg: '#feffc0', color: '#4a4500', dot: '#EEFF25' },
  'Awaiting Client':  { bg: '#ffe7de', color: '#7a2000', dot: '#FF5E30' },
  'Feedback Provided':{ bg: '#eeffb8', color: '#1a4a00', dot: '#CEFF58' },
  'Complete':         { bg: '#dde8e2', color: '#2d4a3a', dot: '#B4C6BB' },
}
const STATUSES = Object.keys(STATUS_CONFIG) as TaskStatus[]
const SECTION_LABELS: Record<Section, string> = {
  mw: 'Marketwake Action Items',
  client: 'Client Action Items',
  done: 'Completed',
}
const SECTION_ACCENTS: Record<Section, string> = {
  mw: '#CEFF58', client: '#FF5E30', done: '#B4C6BB',
}

// ── Section for a given status change ──────────────────────────
function targetSectionForStatus(status: TaskStatus): Section | null {
  if (status === 'Complete') return 'done'
  if (status === 'Awaiting Client') return 'client'
  if (status === 'Feedback Provided') return 'mw'
  return null
}

interface Props { data: TrackerData }

export default function TrackerView({ data }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // ── State ──────────────────────────────────────────────────
  const [client, setClient] = useState<Client>(data.client)
  const [tasks, setTasks] = useState<Record<string, Task>>(
    Object.fromEntries(data.tasks.map(t => [t.id, t]))
  )
  const [sections, setSections] = useState<Record<Section, string[]>>(() => {
    const s: Record<Section, string[]> = { mw: [], client: [], done: [] }
    ;(['mw', 'client', 'done'] as Section[]).forEach(sec => {
      s[sec] = data.tasks
        .filter(t => t.section === sec)
        .sort((a, b) => a.display_order - b.display_order)
        .map(t => t.id)
    })
    return s
  })
  const [drafts, setDrafts] = useState<Draft[]>(data.drafts)
  const [collapsedSections, setCollapsedSections] = useState<Set<Section>>(new Set())
  const [openPickerId, setOpenPickerId] = useState<string | null>(null)
  const [openLinkId, setOpenLinkId] = useState<string | null>(null)
  const [openCommentId, setOpenCommentId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingDueId, setEditingDueId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)
  const [draftPanelOpen, setDraftPanelOpen] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importTab, setImportTab] = useState<'json' | 'form'>('json')
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')
  const [showCelebration, setShowCelebration] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(client.logo_url)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Form fields for single-task import
  const [iformName, setIformName] = useState('')
  const [iformNotes, setIformNotes] = useState('')
  const [iformStatus, setIformStatus] = useState<TaskStatus>('Up Next')
  const [iformSection, setIformSection] = useState<'mw' | 'client'>('mw')

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as HTMLElement
      if (!t.closest('.status-wrap'))  setOpenPickerId(null)
      if (!t.closest('.link-cell'))    setOpenLinkId(null)
      if (!t.closest('.comment-cell')) setOpenCommentId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Debounced Supabase save ────────────────────────────────
  function scheduleSave(taskId: string, patch: Partial<Task>) {
    clearTimeout(saveTimers.current[taskId])
    saveTimers.current[taskId] = setTimeout(async () => {
      await supabase.from('tasks').update(patch).eq('id', taskId)
    }, 600)
  }

  function patchTask(id: string, patch: Partial<Task>, saveNow = false) {
    setTasks(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    if (saveNow) {
      clearTimeout(saveTimers.current[id])
      supabase.from('tasks').update(patch).eq('id', id)
    } else {
      scheduleSave(id, patch)
    }
  }

  // ── Status change + section move ──────────────────────────
  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    const task = tasks[taskId]
    if (!task) return
    const prevStatus = task.status
    const destSec = targetSectionForStatus(newStatus)
    const moveTo: Section = destSec ?? (task.origin as Section) ?? 'mw'

    // Trigger Mickey if completing
    if (newStatus === 'Complete') {
      setShowCelebration(true)
      setTimeout(() => setShowCelebration(false), 3200)
    }

    // Move between sections if needed
    if (moveTo !== task.section) {
      setSections(prev => {
        const next = { ...prev }
        next[task.section as Section] = next[task.section as Section].filter(id => id !== taskId)
        next[moveTo] = [...next[moveTo], taskId]
        return next
      })
      patchTask(taskId, { status: newStatus, section: moveTo }, true)
    } else {
      patchTask(taskId, { status: newStatus }, true)
    }
    setOpenPickerId(null)
  }

  // ── Add item ───────────────────────────────────────────────
  async function addItem(sec: Section) {
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        client_id: client.id,
        section: sec,
        origin: sec,
        name: '',
        notes: '',
        status: 'Up Next',
        display_order: sections[sec].length,
      })
      .select()
      .single()
    if (error || !newTask) return
    setTasks(prev => ({ ...prev, [newTask.id]: newTask }))
    setSections(prev => ({ ...prev, [sec]: [...prev[sec], newTask.id] }))
    setTimeout(() => setEditingNameId(newTask.id), 50)
  }

  // ── Draft actions ──────────────────────────────────────────
  function updateDraftField(id: string, field: keyof Draft, value: string) {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  async function approveDraft(draftId: string) {
    const draft = drafts.find(d => d.id === draftId)
    if (!draft) return
    const sec = draft.target_section as Section
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        client_id: client.id,
        section: sec,
        origin: sec,
        name: draft.name,
        notes: draft.notes,
        status: draft.status,
        display_order: sections[sec].length,
        ai_drafted: true,
      })
      .select()
      .single()
    if (error || !newTask) return
    await supabase.from('drafts').delete().eq('id', draftId)
    setTasks(prev => ({ ...prev, [newTask.id]: newTask }))
    setSections(prev => ({ ...prev, [sec]: [...prev[sec], newTask.id] }))
    setDrafts(prev => prev.filter(d => d.id !== draftId))
  }

  async function rejectDraft(draftId: string) {
    await supabase.from('drafts').delete().eq('id', draftId)
    setDrafts(prev => prev.filter(d => d.id !== draftId))
  }

  // ── Import modal: JSON ─────────────────────────────────────
  async function processImportJson() {
    setImportError('')
    let items: any[]
    try { items = JSON.parse(importJson) } catch { setImportError('Invalid JSON.'); return }
    if (!Array.isArray(items) || items.length === 0) { setImportError('Must be a non-empty array.'); return }
    const newDrafts = items.map(item => ({
      client_id: client.id,
      name: String(item.name || ''),
      notes: String(item.notes || item.description || ''),
      status: (STATUSES.includes(item.status) ? item.status : 'Up Next') as TaskStatus,
      target_section: (['mw', 'client'].includes(item.section) ? item.section : 'mw') as 'mw' | 'client',
    }))
    const { data, error } = await supabase.from('drafts').insert(newDrafts).select()
    if (error || !data) { setImportError('Failed to save drafts.'); return }
    setDrafts(prev => [...prev, ...data])
    setShowImportModal(false)
    setImportJson('')
    setDraftPanelOpen(true)
  }

  // ── Import modal: single form ──────────────────────────────
  async function processImportForm() {
    if (!iformName.trim()) { setImportError('Deliverable name is required.'); return }
    const { data, error } = await supabase
      .from('drafts')
      .insert({ client_id: client.id, name: iformName.trim(), notes: iformNotes, status: iformStatus, target_section: iformSection })
      .select()
      .single()
    if (error || !data) { setImportError('Failed to save draft.'); return }
    setDrafts(prev => [...prev, data])
    setShowImportModal(false)
    setIformName(''); setIformNotes(''); setIformStatus('Up Next'); setIformSection('mw')
    setDraftPanelOpen(true)
  }

  // ── Logo upload ────────────────────────────────────────────
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setLogoUrl(dataUrl)
      await supabase.from('clients').update({ logo_url: dataUrl }).eq('id', client.id)
    }
    reader.readAsDataURL(file)
  }

  // ── Filter / sort ──────────────────────────────────────────
  function isTaskHidden(task: Task): boolean {
    if (filter === 'all') return false
    return task.status !== filter
  }

  function getSortedTaskIds(sec: Section): string[] {
    let ids = [...sections[sec]]
    if (sortDir) {
      ids.sort((a, b) => {
        const ta = tasks[a], tb = tasks[b]
        if (!ta?.due_date && !tb?.due_date) return 0
        if (!ta?.due_date) return 1
        if (!tb?.due_date) return -1
        return sortDir === 'asc'
          ? ta.due_date.localeCompare(tb.due_date)
          : tb.due_date.localeCompare(ta.due_date)
      })
    }
    return ids
  }

  // ── Export client view (generates static HTML) ─────────────
  function exportClientView() {
    const clientTasks = data.tasks // We'd regenerate, but keep it simple: use current state
    const html = buildClientHTML(client, Object.values(tasks))
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = (client.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'client') + '_tracker.html'
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(a.href)
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      <div className="tracker-page">
        <header className="site-header">
          <div className="header-left">
            <a href="/dashboard" className="back-btn">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Hub
            </a>
            <div className="header-divider"/>
            <MWLogo />
            <div className="header-divider"/>
            {/* Client logo slot */}
            <div className="client-logo-wrap">
              {logoUrl ? (
                <>
                  <img className="client-logo-img" src={logoUrl} alt={client.name} />
                  <button className="btn-change-logo" onClick={() => logoInputRef.current?.click()} title="Change logo">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M1 9.5V11h1.5l5-5-1.5-1.5-5 5zm8.7-5.2a.5.5 0 000-.7L8.4 2.3a.5.5 0 00-.7 0L6.8 3.2l2.2 2.2.7-.7z" fill="rgba(255,255,255,.65)"/>
                    </svg>
                  </button>
                </>
              ) : (
                <button className="btn-upload-logo" onClick={() => logoInputRef.current?.click()}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v7M6 1L3.5 3.5M6 1L8.5 3.5M1.5 10.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Upload Logo
                </button>
              )}
            </div>
            <span className="tracker-client-badge">{client.name}</span>
            <span className="tracker-am-tag">AM: {client.am_name}</span>
          </div>
          <div className="header-right">
            <button className="btn-import" onClick={() => { setShowImportModal(true); setImportError('') }}>
              <svg viewBox="0 0 12 12" fill="none">
                <path d="M6 1v7M6 8L3.5 5.5M6 8L8.5 5.5M1.5 10.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Import Drafts
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => {
                const url = `${window.location.origin}/c/${client.client_token}`
                navigator.clipboard.writeText(url)
              }}
              title="Copy client-facing link to clipboard"
            >
              Copy Client Link
            </button>
            <span className="header-badge">LIVE</span>
          </div>
        </header>

        <main className="tracker-main">
          {/* Filter bar */}
          <div className="filter-bar">
            {(['all', ...STATUSES] as string[]).map(s => (
              <button
                key={s}
                className={`summary-pill${filter === s ? ' active' : ''}`}
                onClick={() => setFilter(s)}
              >{s === 'all' ? 'All' : s}</button>
            ))}
            <div className="filter-spacer" />
            <button
              id="sort-asc"
              className={`sort-btn${sortDir === 'asc' ? ' sort-active' : ''}`}
              onClick={() => setSortDir(sortDir === 'asc' ? null : 'asc')}
            >↑ Due Date</button>
            <button
              id="sort-desc"
              className={`sort-btn${sortDir === 'desc' ? ' sort-active' : ''}`}
              onClick={() => setSortDir(sortDir === 'desc' ? null : 'desc')}
            >↓ Due Date</button>
          </div>

          {/* Draft panel */}
          {drafts.length > 0 && (
            <div className="draft-panel">
              <div className="draft-panel-hdr" onClick={() => setDraftPanelOpen(p => !p)}>
                <span className="draft-panel-title">AI Draft Queue</span>
                <span className="draft-count-chip">{drafts.length} pending</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#8a7a00' }}>{draftPanelOpen ? '▲ Collapse' : '▼ Expand'}</span>
              </div>
              {draftPanelOpen && (
                <div className="draft-panel-body">
                  <table className="draft-table">
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Deliverable</th>
                        <th style={{ width: '24%' }}>Description</th>
                        <th style={{ width: '14%' }}>Status</th>
                        <th style={{ width: '12%' }}>Section</th>
                        <th style={{ width: '28%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.map(d => (
                        <tr key={d.id}>
                          <td><input className="draft-field" value={d.name} onChange={e => updateDraftField(d.id, 'name', e.target.value)} placeholder="Deliverable name…"/></td>
                          <td><input className="draft-field" value={d.notes} onChange={e => updateDraftField(d.id, 'notes', e.target.value)} placeholder="Description…"/></td>
                          <td>
                            <select className="draft-section-select" value={d.status} onChange={e => updateDraftField(d.id, 'status', e.target.value)}>
                              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td>
                            <select className="draft-section-select" value={d.target_section} onChange={e => updateDraftField(d.id, 'target_section', e.target.value)}>
                              <option value="mw">Marketwake</option>
                              <option value="client">Client</option>
                            </select>
                          </td>
                          <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn-draft-approve" onClick={() => approveDraft(d.id)}>✓ Approve</button>
                            <button className="btn-draft-reject" onClick={() => rejectDraft(d.id)}>✕ Reject</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tracker sections */}
          {(['mw', 'client', 'done'] as Section[]).map(sec => (
            <TrackerSection
              key={sec}
              sec={sec}
              taskIds={getSortedTaskIds(sec)}
              tasks={tasks}
              collapsed={collapsedSections.has(sec)}
              onToggle={() => setCollapsedSections(prev => {
                const next = new Set(prev)
                next.has(sec) ? next.delete(sec) : next.add(sec)
                return next
              })}
              filter={filter}
              editingNameId={editingNameId}
              editingDueId={editingDueId}
              openPickerId={openPickerId}
              openLinkId={openLinkId}
              openCommentId={openCommentId}
              editingNoteId={editingNoteId}
              onNameEdit={(id) => setEditingNameId(id)}
              onNameSave={(id, val) => { patchTask(id, { name: val }, true); setEditingNameId(null) }}
              onDueEdit={(id) => setEditingDueId(id)}
              onDueSave={(id, val) => { patchTask(id, { due_date: val || null }, true); setEditingDueId(null) }}
              onStatusOpen={(id) => setOpenPickerId(openPickerId === id ? null : id)}
              onStatusChange={handleStatusChange}
              onLinkOpen={(id) => setOpenLinkId(openLinkId === id ? null : id)}
              onLinkSave={(id, url, label) => { patchTask(id, { link_url: url, link_label: label }, true); setOpenLinkId(null) }}
              onNoteEdit={(id) => setEditingNoteId(id)}
              onNoteSave={(id, val) => { patchTask(id, { notes: val }, true); setEditingNoteId(null) }}
              onCommentOpen={(id) => setOpenCommentId(openCommentId === id ? null : id)}
              onCommentSave={(id, val) => { patchTask(id, { comments: val }, true); setOpenCommentId(null) }}
              onAddItem={() => addItem(sec)}
            />
          ))}
        </main>
      </div>

      {/* Mickey celebration */}
      <MickeyCelebration active={showCelebration} />

      {/* Hidden logo file input */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
        style={{ display: 'none' }}
        onChange={handleLogoUpload}
      />

      {/* Import Drafts modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowImportModal(false) }}>
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div className="import-modal-title">Import AI Drafts</div>
            <div className="import-modal-sub">Queue tasks for AM review before they go live. Tasks stay hidden from the client until approved.</div>
            <div className="import-tabs">
              <button className={`import-tab${importTab === 'json' ? ' active' : ''}`} onClick={() => setImportTab('json')}>Paste JSON</button>
              <button className={`import-tab${importTab === 'form' ? ' active' : ''}`} onClick={() => setImportTab('form')}>Single Task</button>
            </div>
            {importTab === 'json' ? (
              <div className="import-pane active">
                <textarea
                  className="import-textarea"
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                  placeholder={'[\n  {\n    "name": "Monthly Report",\n    "notes": "Analytics overview",\n    "status": "Up Next",\n    "section": "mw"\n  }\n]'}
                />
              </div>
            ) : (
              <div className="import-pane active">
                <div className="import-form-row">
                  <div className="import-label">Deliverable Name</div>
                  <input className="import-input" value={iformName} onChange={e => setIformName(e.target.value)} placeholder="e.g. Q2 Social Media Calendar"/>
                </div>
                <div className="import-form-row">
                  <div className="import-label">Description</div>
                  <input className="import-input" value={iformNotes} onChange={e => setIformNotes(e.target.value)} placeholder="Brief description or context"/>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="import-form-row" style={{ flex: 1 }}>
                    <div className="import-label">Status</div>
                    <select className="import-input" value={iformStatus} onChange={e => setIformStatus(e.target.value as TaskStatus)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="import-form-row" style={{ flex: 1 }}>
                    <div className="import-label">Section</div>
                    <select className="import-input" value={iformSection} onChange={e => setIformSection(e.target.value as 'mw' | 'client')}>
                      <option value="mw">Marketwake</option>
                      <option value="client">Client</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            {importError && <div className="import-error">{importError}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={importTab === 'json' ? processImportJson : processImportForm}>
                Add to Draft Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── TrackerSection sub-component ──────────────────────────────
interface SectionProps {
  sec: Section
  taskIds: string[]
  tasks: Record<string, Task>
  collapsed: boolean
  filter: string
  editingNameId: string | null
  editingDueId: string | null
  openPickerId: string | null
  openLinkId: string | null
  openCommentId: string | null
  editingNoteId: string | null
  onToggle: () => void
  onNameEdit: (id: string) => void
  onNameSave: (id: string, val: string) => void
  onDueEdit: (id: string) => void
  onDueSave: (id: string, val: string) => void
  onStatusOpen: (id: string) => void
  onStatusChange: (id: string, status: TaskStatus) => void
  onLinkOpen: (id: string) => void
  onLinkSave: (id: string, url: string, label: string) => void
  onNoteEdit: (id: string) => void
  onNoteSave: (id: string, val: string) => void
  onCommentOpen: (id: string) => void
  onCommentSave: (id: string, val: string) => void
  onAddItem: () => void
}

function TrackerSection({
  sec, taskIds, tasks, collapsed, filter,
  editingNameId, editingDueId, openPickerId, openLinkId, openCommentId, editingNoteId,
  onToggle, onNameEdit, onNameSave, onDueEdit, onDueSave,
  onStatusOpen, onStatusChange, onLinkOpen, onLinkSave,
  onNoteEdit, onNoteSave, onCommentOpen, onCommentSave, onAddItem,
}: SectionProps) {

  const visibleCount = taskIds.filter(id => {
    const t = tasks[id]
    return t && (filter === 'all' || t.status === filter)
  }).length

  // Local state for link and comment editing
  const [linkUrl, setLinkUrl] = useState<Record<string, string>>({})
  const [linkLabel, setLinkLabel] = useState<Record<string, string>>({})
  const [noteText, setNoteText] = useState<Record<string, string>>({})
  const [commentText, setCommentText] = useState<Record<string, string>>({})
  const [nameText, setNameText] = useState<Record<string, string>>({})
  const [dueText, setDueText] = useState<Record<string, string>>({})

  return (
    <div className="tracker-section">
      <div className="section-header" onClick={onToggle}>
        <div className="section-accent" style={{ background: SECTION_ACCENTS[sec] }} />
        <span className="section-title-txt">{SECTION_LABELS[sec]}</span>
        <span className="section-count">{visibleCount} item{visibleCount !== 1 ? 's' : ''}</span>
        <div className={`section-chev${collapsed ? '' : ' open'}`}>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {!collapsed && (
        <>
          <table className="tracker-table">
            <thead>
              <tr>
                <th className="col-drag"/>
                <th className="col-item">Deliverable</th>
                <th className="col-status">Status</th>
                <th className="col-due">Due</th>
                <th className="col-link">Link</th>
                <th className="col-notes">Description</th>
                <th className="col-comments">Comments</th>
              </tr>
            </thead>
            <tbody>
              {taskIds.map(id => {
                const task = tasks[id]
                if (!task) return null
                const isHidden = filter !== 'all' && task.status !== filter
                const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG['Up Next']
                const today = new Date(); today.setHours(0,0,0,0)
                const overdue = task.due_date && new Date(task.due_date + 'T00:00:00') < today && task.status !== 'Complete'

                return (
                  <tr key={id} className={isHidden ? 'hidden-row' : ''}>
                    {/* Drag handle (visual only — drag-to-reorder can be added with dnd-kit) */}
                    <td className="col-drag">
                      <div className="drag-handle">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <circle cx="4" cy="3" r="1" fill="currentColor"/>
                          <circle cx="8" cy="3" r="1" fill="currentColor"/>
                          <circle cx="4" cy="6" r="1" fill="currentColor"/>
                          <circle cx="8" cy="6" r="1" fill="currentColor"/>
                          <circle cx="4" cy="9" r="1" fill="currentColor"/>
                          <circle cx="8" cy="9" r="1" fill="currentColor"/>
                        </svg>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="col-item">
                      <div className={`efield${editingNameId === id ? ' editing' : ''}`}>
                        <div
                          className="efield-name"
                          onClick={() => { setNameText(p => ({ ...p, [id]: task.name })); onNameEdit(id) }}
                        >{task.name || <span className="muted">Untitled</span>}</div>
                        <input
                          className="efield-input"
                          value={nameText[id] ?? task.name}
                          onChange={e => setNameText(p => ({ ...p, [id]: e.target.value }))}
                          onBlur={() => onNameSave(id, nameText[id] ?? task.name)}
                          onKeyDown={e => { if (e.key === 'Enter') onNameSave(id, nameText[id] ?? task.name) }}
                          autoFocus={editingNameId === id}
                        />
                      </div>
                      {task.ai_drafted && <span className="ai-drafted-badge">AI</span>}
                    </td>

                    {/* Status */}
                    <td className="col-status">
                      <div className="status-wrap">
                        <span
                          className="status-badge"
                          style={{ background: cfg.bg, color: cfg.color }}
                          onClick={() => onStatusOpen(id)}
                        >
                          <span className="dot" style={{ background: cfg.dot }}/>
                          {task.status}
                        </span>
                        <div className={`status-picker${openPickerId === id ? ' open' : ''}`}>
                          {STATUSES.map(s => {
                            const sc = STATUS_CONFIG[s]
                            return (
                              <div
                                key={s}
                                className={`picker-opt${task.status === s ? ' picker-active' : ''}`}
                                onClick={() => onStatusChange(id, s)}
                              >
                                <span className="dot" style={{ background: sc.dot }}/>{s}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </td>

                    {/* Due date */}
                    <td className="col-due">
                      <div className={`due-wrap${editingDueId === id ? ' editing' : ''}`}>
                        <div
                          className={`due-display${overdue ? ' overdue' : ''}`}
                          onClick={() => { setDueText(p => ({ ...p, [id]: task.due_date ?? '' })); onDueEdit(id) }}
                        >{task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : <span className="muted">—</span>}</div>
                        <input
                          className="due-input"
                          type="date"
                          value={dueText[id] ?? task.due_date ?? ''}
                          onChange={e => setDueText(p => ({ ...p, [id]: e.target.value }))}
                          onBlur={() => onDueSave(id, dueText[id] ?? '')}
                          autoFocus={editingDueId === id}
                        />
                      </div>
                    </td>

                    {/* Link */}
                    <td className="col-link">
                      <div className="link-cell">
                        {task.link_url ? (
                          <a className="link-chip" href={task.link_url} target="_blank" rel="noopener noreferrer">
                            {task.link_label || 'Link'}
                          </a>
                        ) : (
                          <span className="link-add" onClick={() => { setLinkUrl(p => ({ ...p, [id]: task.link_url })); setLinkLabel(p => ({ ...p, [id]: task.link_label })); onLinkOpen(id) }}>+ Add</span>
                        )}
                        {task.link_url && <span className="link-add" style={{ marginLeft: 4 }} onClick={() => { setLinkUrl(p => ({ ...p, [id]: task.link_url })); setLinkLabel(p => ({ ...p, [id]: task.link_label })); onLinkOpen(id) }}>✎</span>}
                        <div className={`link-popover${openLinkId === id ? ' open' : ''}`}>
                          <input placeholder="URL" value={linkUrl[id] ?? ''} onChange={e => setLinkUrl(p => ({ ...p, [id]: e.target.value }))}/>
                          <input placeholder="Label (optional)" value={linkLabel[id] ?? ''} onChange={e => setLinkLabel(p => ({ ...p, [id]: e.target.value }))}/>
                          <div className="link-popover-actions">
                            <button className="btn-cancel" onClick={() => onLinkOpen(id)}>Cancel</button>
                            <button className="btn-save" onClick={() => onLinkSave(id, linkUrl[id] ?? '', linkLabel[id] ?? '')}>Save</button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Notes / Description */}
                    <td className="col-notes">
                      {editingNoteId === id ? (
                        <div className="notes-editor open">
                          <textarea
                            className="notes-textarea"
                            value={noteText[id] ?? task.notes}
                            onChange={e => setNoteText(p => ({ ...p, [id]: e.target.value }))}
                            autoFocus
                          />
                          <div className="notes-actions">
                            <button className="btn-save" onClick={() => onNoteSave(id, noteText[id] ?? task.notes)}>Save</button>
                            <button className="btn-cancel" onClick={() => onNoteEdit('')}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="notes-display-wrap" onClick={() => { setNoteText(p => ({ ...p, [id]: task.notes })); onNoteEdit(id) }}>
                          {task.notes ? <span className="notes-text">{task.notes}</span> : <span className="muted">—</span>}
                        </div>
                      )}
                    </td>

                    {/* Comments */}
                    <td className="col-comments">
                      <div className="comment-cell" onClick={() => { setCommentText(p => ({ ...p, [id]: task.comments })); onCommentOpen(id) }}>
                        {task.comments
                          ? <><span className="comment-dot"/><span className="comment-text has-comment">{task.comments}</span></>
                          : <><span className="comment-text empty">Add comment…</span><span className="comment-hint">✎</span></>
                        }
                        <div className={`comment-editor${openCommentId === id ? ' open' : ''}`} onClick={e => e.stopPropagation()}>
                          <textarea
                            value={commentText[id] ?? task.comments}
                            onChange={e => setCommentText(p => ({ ...p, [id]: e.target.value }))}
                            autoFocus={openCommentId === id}
                          />
                          <div className="notes-actions">
                            <button className="btn-save" onClick={() => onCommentSave(id, commentText[id] ?? task.comments)}>Save</button>
                            <button className="btn-cancel" onClick={() => onCommentOpen(id)}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="add-row">
            <button className="btn-add-item" onClick={onAddItem}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add item
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Minimal static client HTML builder ───────────────────────
// Used for the "Export" button (generates a standalone file)
function buildClientHTML(client: Client, tasks: Task[]): string {
  const rows = (sec: Section) => tasks
    .filter(t => t.section === sec)
    .map(t => `<tr><td>${t.name}</td><td>${t.status}</td><td>${t.due_date ?? ''}</td><td>${t.notes}</td></tr>`)
    .join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${client.name} Tracker</title></head>
<body style="font-family:sans-serif;padding:32px">
<h1>${client.name}</h1><p>Prepared by Marketwake</p>
<h2>Marketwake Action Items</h2><table border="1" cellpadding="6"><tr><th>Deliverable</th><th>Status</th><th>Due</th><th>Description</th></tr>${rows('mw')}</table>
<h2>Client Action Items</h2><table border="1" cellpadding="6"><tr><th>Deliverable</th><th>Status</th><th>Due</th><th>Description</th></tr>${rows('client')}</table>
</body></html>`
}
