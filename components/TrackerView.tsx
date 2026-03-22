'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TrackerData, Task, Draft, Section, TaskStatus, Client } from '@/lib/types'
import MWLogo from './MWLogo'

// ── Status config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  'In Progress':      { bg: '#dce8ff', color: '#001fa8', dot: '#0038FF' },
  'Up Next':          { bg: '#feffc0', color: '#4a4500', dot: '#EEFF25' },
  'Awaiting Client':  { bg: '#ffe7de', color: '#7a2000', dot: '#FF5E30' },
  'Feedback Provided':{ bg: '#f0e6ff', color: '#5b21b6', dot: '#7c3aed' },
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

function targetSectionForStatus(status: TaskStatus): Section | null {
  if (status === 'Complete') return 'done'
  if (status === 'Awaiting Client') return 'client'
  if (status === 'Feedback Provided') return 'mw'
  return null
}

// ── Relative time helper ───────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Confetti celebration ───────────────────────────────────────
function ConfettiCelebration({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        fontSize: 80,
        animation: 'confettiBounce 0.5s cubic-bezier(.34,1.56,.64,1) forwards',
      }}>🎉</div>
      <style>{`
        @keyframes confettiBounce {
          0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
          60%  { transform: scale(1.2) rotate(5deg);  opacity: 1; }
          100% { transform: scale(1)   rotate(0deg);  opacity: 1; }
        }
      `}</style>
    </div>
  )
}

interface Props { data: TrackerData }

export default function TrackerView({ data }: Props) {
  const supabase = createClient()

  const [client, setClient] = useState<Client>(data.client)
  const [tasks, setTasks] = useState<Record<string, Task>>(
    Object.fromEntries(data.tasks.filter(t => t.section !== 'archived').map(t => [t.id, t]))
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
  const [archivedTasks, setArchivedTasks] = useState<Task[]>(
    data.tasks.filter(t => t.section === 'archived')
  )
  const [showArchive, setShowArchive] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<TaskStatus | ''>('')
  const [bulkSection, setBulkSection] = useState<Section | ''>('')
  const [copyLinkMsg, setCopyLinkMsg] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Drag state
  const dragId = useRef<string | null>(null)
  const dragSec = useRef<Section | null>(null)

  // Single task form fields
  const [iformName, setIformName] = useState('')
  const [iformNotes, setIformNotes] = useState('')
  const [iformDue, setIformDue] = useState('')
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

  // ── Debounced save ─────────────────────────────────────────
  function scheduleSave(taskId: string, patch: Partial<Task>) {
    clearTimeout(saveTimers.current[taskId])
    saveTimers.current[taskId] = setTimeout(async () => {
      await supabase.from('tasks').update(patch).eq('id', taskId)
    }, 600)
  }

  async function patchTask(id: string, patch: Partial<Task>, saveNow = false) {
    setTasks(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
    if (saveNow) {
      clearTimeout(saveTimers.current[id])
      const { error } = await supabase.from('tasks').update(patch).eq('id', id)
      if (error) console.error('[patchTask] save failed:', error.message, patch)
    } else {
      scheduleSave(id, patch)
    }
  }

  // ── Status change + section move ──────────────────────────
  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    const task = tasks[taskId]
    if (!task) return
    const destSec = targetSectionForStatus(newStatus)
    const moveTo: Section = destSec ?? (task.origin as Section) ?? 'mw'

    if (newStatus === 'Complete') {
      setShowCelebration(true)
      setTimeout(() => setShowCelebration(false), 2000)
    }

    if (moveTo !== task.section) {
      setSections(prev => {
        const next = { ...prev }
        next[task.section as Section] = next[task.section as Section].filter(id => id !== taskId)
        next[moveTo] = [...next[moveTo], taskId]
        return next
      })
    }
    patchTask(taskId, { status: newStatus, section: moveTo }, true)
    setOpenPickerId(null)
  }

  // ── Add item ───────────────────────────────────────────────
  async function addItem(sec: Section) {
    const order = sections[sec].length
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        client_id: client.id,
        section: sec,
        origin: sec,
        name: '',
        notes: '',
        status: 'Up Next',
        due_date: null,
        link_url: '',
        link_label: '',
        comments: '',
        display_order: order,
        ai_drafted: false,
      })
      .select()
      .single()

    if (error || !newTask) {
      console.error('Add item failed:', error)
      return
    }

    setTasks(prev => ({ ...prev, [newTask.id]: newTask as Task }))
    setSections(prev => ({ ...prev, [sec]: [...prev[sec], newTask.id] }))
    setTimeout(() => setEditingNameId(newTask.id), 50)
  }

  // ── Archive ────────────────────────────────────────────────
  async function archiveCompleted() {
    const doneIds = sections.done
    if (doneIds.length === 0) return
    const toArchive = doneIds.map(id => tasks[id]).filter(Boolean)
    await supabase.from('tasks').update({ section: 'archived' as any }).in('id', doneIds)
    setArchivedTasks(prev => [...prev, ...toArchive])
    setSections(prev => ({ ...prev, done: [] }))
    doneIds.forEach(id => {
      setTasks(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    })
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
        due_date: (draft as any).due_date || null,
        link_url: '',
        link_label: '',
        comments: '',
        display_order: sections[sec].length,
        ai_drafted: false,
      })
      .select()
      .single()

    if (error || !newTask) return
    await supabase.from('drafts').delete().eq('id', draftId)
    setTasks(prev => ({ ...prev, [newTask.id]: newTask as Task }))
    setSections(prev => ({ ...prev, [sec]: [...prev[sec], newTask.id] }))
    setDrafts(prev => prev.filter(d => d.id !== draftId))
  }

  async function rejectDraft(draftId: string) {
    await supabase.from('drafts').delete().eq('id', draftId)
    setDrafts(prev => prev.filter(d => d.id !== draftId))
  }

  // ── Import JSON ────────────────────────────────────────────
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
      target_section: (['mw','client'].includes(item.section) ? item.section : 'mw') as 'mw'|'client',
      due_date: item.due_date || null,
    }))
    const { data, error } = await supabase.from('drafts').insert(newDrafts).select()
    if (error || !data) { setImportError('Failed to save drafts.'); return }
    setDrafts(prev => [...prev, ...(data as Draft[])])
    setShowImportModal(false); setImportJson(''); setDraftPanelOpen(true)
  }

  // ── Import single form ─────────────────────────────────────
  async function processImportForm() {
    if (!iformName.trim()) { setImportError('Deliverable name is required.'); return }
    const { data, error } = await supabase
      .from('drafts')
      .insert({ client_id: client.id, name: iformName.trim(), notes: iformNotes, status: iformStatus, target_section: iformSection, due_date: iformDue || null })
      .select()
      .single()
    if (error || !data) { setImportError('Failed to save draft.'); return }
    setDrafts(prev => [...prev, data as Draft])
    setShowImportModal(false)
    setIformName(''); setIformNotes(''); setIformDue(''); setIformStatus('Up Next'); setIformSection('mw')
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

  // ── Copy client link ───────────────────────────────────────
  function copyClientLink() {
    const url = `${window.location.origin}/c/${client.client_token}`
    navigator.clipboard.writeText(url)
    setCopyLinkMsg(true)
    setTimeout(() => setCopyLinkMsg(false), 2000)
  }

  // ── Drag and drop ──────────────────────────────────────────
  function handleDragStart(id: string, sec: Section) {
    dragId.current = id
    dragSec.current = sec
  }

  function handleDragOver(e: React.DragEvent, overId: string, sec: Section) {
    e.preventDefault()
    if (!dragId.current || dragId.current === overId || dragSec.current !== sec) return
    setSections(prev => {
      const ids = [...prev[sec]]
      const from = ids.indexOf(dragId.current!)
      const to = ids.indexOf(overId)
      if (from === -1 || to === -1) return prev
      ids.splice(from, 1); ids.splice(to, 0, dragId.current!)
      return { ...prev, [sec]: ids }
    })
  }

  async function handleDragEnd(sec: Section) {
    dragId.current = null
    dragSec.current = null
    // Persist new order
    const ids = sections[sec]
    const updates = ids.map((id, i) => supabase.from('tasks').update({ display_order: i }).eq('id', id))
    await Promise.all(updates)
  }

  // ── Delete task ────────────────────────────────────────────
  async function deleteTask(taskId: string) {
    const task = tasks[taskId]
    if (!task) return
    // Remove from local state immediately
    setSections(prev => {
      const next = { ...prev }
      const sec = task.section as Section
      if (next[sec]) next[sec] = next[sec].filter(id => id !== taskId)
      return next
    })
    setTasks(prev => { const n = { ...prev }; delete n[taskId]; return n })
    await supabase.from('tasks').delete().eq('id', taskId)
  }

  // ── Bulk actions ───────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll(ids: string[]) {
    const allSelected = ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  async function applyBulkStatus(newStatus: TaskStatus) {
    const ids = [...selectedIds]
    for (const id of ids) {
      await handleStatusChange(id, newStatus)
    }
    setSelectedIds(new Set())
    setBulkStatus('')
  }

  async function applyBulkSection(newSec: Section) {
    const ids = [...selectedIds]
    for (const id of ids) {
      const task = tasks[id]
      if (!task || task.section === newSec) continue
      setSections(prev => {
        const next = { ...prev }
        next[task.section as Section] = next[task.section as Section].filter(i => i !== id)
        next[newSec] = [...next[newSec], id]
        return next
      })
      patchTask(id, { section: newSec }, true)
    }
    setSelectedIds(new Set())
    setBulkSection('')
  }

  // ── Filter / sort ──────────────────────────────────────────
  function getSortedTaskIds(sec: Section): string[] {
    let ids = [...sections[sec]]
    if (sortDir) {
      ids.sort((a, b) => {
        const ta = tasks[a], tb = tasks[b]
        if (!ta?.due_date && !tb?.due_date) return 0
        if (!ta?.due_date) return 1
        if (!tb?.due_date) return -1
        return sortDir === 'asc' ? ta.due_date!.localeCompare(tb.due_date!) : tb.due_date!.localeCompare(ta.due_date!)
      })
    }
    return ids
  }

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
            <div className="client-logo-wrap">
              {logoUrl ? (
                <>
                  <img className="client-logo-img" src={logoUrl} alt={client.name}/>
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
            <button className="btn-ghost" onClick={() => { setShowImportModal(true); setImportError('') }}>
              Import Drafts
            </button>
            <button className="btn-ghost" onClick={copyClientLink}>
              {copyLinkMsg ? '✓ Copied!' : 'Copy Client Link'}
            </button>
          </div>
        </header>

        <main className="tracker-main">
          {/* Filter bar */}
          <div className="filter-bar">
            {(['all', ...STATUSES] as string[]).map(s => (
              <button key={s} className={`summary-pill${filter === s ? ' active' : ''}`} onClick={() => setFilter(s)}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
            <div className="filter-spacer"/>
            <button className={`sort-btn${sortDir === 'asc' ? ' sort-active' : ''}`} onClick={() => setSortDir(sortDir === 'asc' ? null : 'asc')}>↑ Due</button>
            <button className={`sort-btn${sortDir === 'desc' ? ' sort-active' : ''}`} onClick={() => setSortDir(sortDir === 'desc' ? null : 'desc')}>↓ Due</button>
          </div>

          {/* Draft panel */}
          {drafts.length > 0 && (
            <div className="draft-panel">
              <div className="draft-panel-hdr" onClick={() => setDraftPanelOpen(p => !p)}>
                <span className="draft-panel-title">AI Draft Queue</span>
                <span className="draft-count-chip">{drafts.length} pending</span>
                <span style={{ flex: 1 }}/>
                <span style={{ fontSize: 11, color: '#8a7a00' }}>{draftPanelOpen ? '▲' : '▼'}</span>
              </div>
              {draftPanelOpen && (
                <div className="draft-panel-body">
                  <table className="draft-table">
                    <thead>
                      <tr>
                        <th style={{ width: '20%' }}>Deliverable</th>
                        <th style={{ width: '22%' }}>Description</th>
                        <th style={{ width: '10%' }}>Due Date</th>
                        <th style={{ width: '13%' }}>Status</th>
                        <th style={{ width: '11%' }}>Section</th>
                        <th style={{ width: '24%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.map(d => (
                        <tr key={d.id}>
                          <td><input className="draft-field" value={d.name} onChange={e => updateDraftField(d.id, 'name', e.target.value)} placeholder="Deliverable name…"/></td>
                          <td><input className="draft-field" value={d.notes} onChange={e => updateDraftField(d.id, 'notes', e.target.value)} placeholder="Description…"/></td>
                          <td><input className="draft-field" type="date" value={(d as any).due_date || ''} onChange={e => updateDraftField(d.id, 'due_date' as any, e.target.value)}/></td>
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
              filter={filter}
              editingNameId={editingNameId}
              editingDueId={editingDueId}
              openPickerId={openPickerId}
              openLinkId={openLinkId}
              openCommentId={openCommentId}
              editingNoteId={editingNoteId}
              selectedIds={selectedIds}
              onToggle={() => setCollapsedSections(prev => { const n = new Set(prev); n.has(sec) ? n.delete(sec) : n.add(sec); return n })}
              onNameEdit={setEditingNameId}
              onNameSave={(id, val) => { patchTask(id, { name: val }, true); setEditingNameId(null) }}
              onDueEdit={setEditingDueId}
              onDueSave={(id, val) => { patchTask(id, { due_date: val || null }, true); setEditingDueId(null) }}
              onStatusOpen={id => setOpenPickerId(openPickerId === id ? null : id)}
              onStatusChange={handleStatusChange}
              onLinkOpen={id => setOpenLinkId(openLinkId === id ? null : id)}
              onLinkSave={(id, url, label) => { patchTask(id, { link_url: url, link_label: label }, true); setOpenLinkId(null) }}
              onNoteEdit={setEditingNoteId}
              onNoteSave={(id, val) => { patchTask(id, { notes: val }, true); setEditingNoteId(null) }}
              onCommentOpen={id => setOpenCommentId(openCommentId === id ? null : id)}
              onCommentSave={(id, val) => { patchTask(id, { comments: val }, true); setOpenCommentId(null) }}
              onAddItem={() => addItem(sec)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onArchive={sec === 'done' ? archiveCompleted : undefined}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onDelete={deleteTask}
            />
          ))}

          {/* Archive view */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                background: 'white', borderRadius: showArchive ? '12px 12px 0 0' : 12,
                border: '1.5px solid #e5e7eb', cursor: 'pointer', userSelect: 'none',
                borderBottom: showArchive ? '1px solid #e5e7eb' : '1.5px solid #e5e7eb',
              }}
              onClick={() => setShowArchive(p => !p)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#9ca3af', flexShrink: 0 }}>
                <path d="M1.5 3.5h11M2.5 3.5V11a1 1 0 001 1h7a1 1 0 001-1V3.5M4.5 3.5V2.5a1 1 0 011-1h3a1 1 0 011 1v1M5.5 6.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', flex: 1 }}>
                Task Archive
              </span>
              {archivedTasks.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#f3f4f6', color: '#6b7280', padding: '2px 9px', borderRadius: 20 }}>
                  {archivedTasks.length} item{archivedTasks.length !== 1 ? 's' : ''}
                </span>
              )}
              {archivedTasks.length === 0 && (
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Empty</span>
              )}
              <svg style={{ width: 14, height: 14, color: '#9ca3af', transform: showArchive ? 'rotate(90deg)' : 'none', transition: 'transform .15s', marginLeft: 4 }} viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {showArchive && (
              <div style={{ background: 'white', borderRadius: '0 0 12px 12px', border: '1.5px solid #e5e7eb', borderTop: 'none' }}>
                {archivedTasks.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                    No archived tasks yet. Use "Archive all" on the Completed section to move finished work here.
                  </div>
                ) : (
                  <table className="tracker-table" style={{ opacity: 0.8 }}>
                    <thead>
                      <tr>
                        <th className="col-item">Deliverable</th>
                        <th className="col-status">Status</th>
                        <th className="col-due">Completed by</th>
                        <th className="col-notes">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedTasks.map(t => (
                        <tr key={t.id}>
                          <td className="col-item" style={{ color: '#6b7280' }}>{t.name || <span className="muted">Untitled</span>}</td>
                          <td className="col-status"><span style={{ fontSize: 11, color: '#9ca3af' }}>{t.status}</span></td>
                          <td className="col-due" style={{ fontSize: 12, color: '#9ca3af' }}>{t.due_date ?? '—'}</td>
                          <td className="col-notes" style={{ fontSize: 12, color: '#9ca3af' }}>{t.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0C0C0C', borderRadius: 12, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,.35)', zIndex: 500, whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 600 }}>
            {selectedIds.size} selected
          </span>
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,.2)' }}/>
          <select
            style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,.1)', color: 'white', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
            value={bulkStatus}
            onChange={e => { if (e.target.value) applyBulkStatus(e.target.value as TaskStatus) }}
          >
            <option value="">Set status…</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            style={{ fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,.1)', color: 'white', border: '1px solid rgba(255,255,255,.2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}
            value={bulkSection}
            onChange={e => { if (e.target.value) applyBulkSection(e.target.value as Section) }}
          >
            <option value="">Move to…</option>
            <option value="mw">Marketwake</option>
            <option value="client">Client</option>
            <option value="done">Completed</option>
          </select>
          <button
            style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
            onClick={() => setSelectedIds(new Set())}
          >✕ Clear</button>
        </div>
      )}

      <ConfettiCelebration active={showCelebration} />

      <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" style={{ display: 'none' }} onChange={handleLogoUpload}/>

      {/* Import modal */}
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
              <textarea className="import-textarea" value={importJson} onChange={e => setImportJson(e.target.value)}
                placeholder={'[\n  {\n    "name": "Monthly Report",\n    "notes": "Analytics overview",\n    "status": "Up Next",\n    "section": "mw",\n    "due_date": "2024-05-01"\n  }\n]'}
              />
            ) : (
              <>
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
                    <div className="import-label">Due Date</div>
                    <input className="import-input" type="date" value={iformDue} onChange={e => setIformDue(e.target.value)}/>
                  </div>
                  <div className="import-form-row" style={{ flex: 1 }}>
                    <div className="import-label">Status</div>
                    <select className="import-input" value={iformStatus} onChange={e => setIformStatus(e.target.value as TaskStatus)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="import-form-row" style={{ flex: 1 }}>
                    <div className="import-label">Section</div>
                    <select className="import-input" value={iformSection} onChange={e => setIformSection(e.target.value as 'mw'|'client')}>
                      <option value="mw">Marketwake</option>
                      <option value="client">Client</option>
                    </select>
                  </div>
                </div>
              </>
            )}
            {importError && <div className="import-error">{importError}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={importTab === 'json' ? processImportJson : processImportForm}>Add to Draft Queue</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── TrackerSection ─────────────────────────────────────────────
interface SectionProps {
  sec: Section; taskIds: string[]; tasks: Record<string, Task>
  collapsed: boolean; filter: string
  editingNameId: string | null; editingDueId: string | null
  openPickerId: string | null; openLinkId: string | null
  openCommentId: string | null; editingNoteId: string | null
  selectedIds: Set<string>
  onToggle: () => void
  onNameEdit: (id: string) => void; onNameSave: (id: string, val: string) => void
  onDueEdit: (id: string) => void; onDueSave: (id: string, val: string) => void
  onStatusOpen: (id: string) => void; onStatusChange: (id: string, s: TaskStatus) => void
  onLinkOpen: (id: string) => void; onLinkSave: (id: string, url: string, label: string) => void
  onNoteEdit: (id: string) => void; onNoteSave: (id: string, val: string) => void
  onCommentOpen: (id: string) => void; onCommentSave: (id: string, val: string) => void
  onAddItem: () => void
  onDragStart: (id: string, sec: Section) => void
  onDragOver: (e: React.DragEvent, overId: string, sec: Section) => void
  onDragEnd: (sec: Section) => void
  onArchive?: () => void
  onToggleSelect: (id: string) => void
  onToggleSelectAll: (ids: string[]) => void
  onDelete: (id: string) => void
}

function TrackerSection({
  sec, taskIds, tasks, collapsed, filter,
  editingNameId, editingDueId, openPickerId, openLinkId, openCommentId, editingNoteId,
  selectedIds, onToggle, onNameEdit, onNameSave, onDueEdit, onDueSave,
  onStatusOpen, onStatusChange, onLinkOpen, onLinkSave,
  onNoteEdit, onNoteSave, onCommentOpen, onCommentSave,
  onAddItem, onDragStart, onDragOver, onDragEnd, onArchive,
  onToggleSelect, onToggleSelectAll, onDelete,
}: SectionProps) {
  const [linkUrl, setLinkUrl] = useState<Record<string, string>>({})
  const [linkLabel, setLinkLabel] = useState<Record<string, string>>({})
  const [noteText, setNoteText] = useState<Record<string, string>>({})
  const [commentText, setCommentText] = useState<Record<string, string>>({})
  const [nameText, setNameText] = useState<Record<string, string>>({})
  const [dueText, setDueText] = useState<Record<string, string>>({})

  const visibleCount = taskIds.filter(id => tasks[id] && (filter === 'all' || tasks[id].status === filter)).length

  return (
    <div className="tracker-section">
      <div className="section-header" onClick={onToggle}>
        <div className="section-accent" style={{ background: SECTION_ACCENTS[sec] }}/>
        <span className="section-title-txt">{SECTION_LABELS[sec]}</span>
        <span className="section-count">{visibleCount} item{visibleCount !== 1 ? 's' : ''}</span>
        {onArchive && visibleCount > 0 && (
          <button
            style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', marginRight: 6,
              border: '1.5px solid #d1d5db', borderRadius: 6, background: 'white',
              color: '#6b7280', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
            onClick={e => { e.stopPropagation(); onArchive() }}
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 3.5h11M2.5 3.5V11a1 1 0 001 1h7a1 1 0 001-1V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Archive all
          </button>
        )}
        <div className={`section-chev${collapsed ? '' : ' open'}`}>
          <svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>

      {!collapsed && (
        <>
          <table className="tracker-table">
            <thead>
              <tr>
                <th style={{ width: 32, padding: '7px 4px 7px 12px' }}>
                  <input
                    type="checkbox"
                    style={{ cursor: 'pointer' }}
                    checked={taskIds.length > 0 && taskIds.every(id => selectedIds.has(id))}
                    onChange={() => onToggleSelectAll(taskIds)}
                  />
                </th>
                <th className="col-drag"/>
                <th className="col-item">Deliverable</th>
                <th className="col-status">Status</th>
                <th className="col-due">Due</th>
                <th className="col-link">Link</th>
                <th className="col-notes">Description</th>
                <th className="col-comments">Comments</th>
                <th style={{ width: 32 }}/>
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
                  <tr
                    key={id}
                    className={isHidden ? 'hidden-row' : ''}
                    draggable
                    onDragStart={() => onDragStart(id, sec)}
                    onDragOver={e => onDragOver(e, id, sec)}
                    onDragEnd={() => onDragEnd(sec)}
                    style={{ cursor: 'grab' }}
                  >
                    {/* Checkbox */}
                    <td style={{ width: 32, padding: '9px 4px 9px 12px' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        style={{ cursor: 'pointer' }}
                        checked={selectedIds.has(id)}
                        onChange={() => onToggleSelect(id)}
                      />
                    </td>

                    {/* Drag handle */}
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
                        <div className="efield-name" onClick={() => { setNameText(p => ({...p,[id]:task.name})); onNameEdit(id) }}>
                          {task.name || <span className="muted">Untitled</span>}
                        </div>
                        <input
                          className="efield-input"
                          value={nameText[id] ?? task.name}
                          onChange={e => setNameText(p => ({...p,[id]:e.target.value}))}
                          onBlur={() => onNameSave(id, nameText[id] ?? task.name)}
                          onKeyDown={e => { if (e.key === 'Enter') onNameSave(id, nameText[id] ?? task.name) }}
                          autoFocus={editingNameId === id}
                        />
                      </div>
                    </td>

                    {/* Status — fixed z-index so picker never clips */}
                    <td className="col-status" style={{ overflow: 'visible', position: 'relative', zIndex: openPickerId === id ? 300 : 'auto' }}>
                      <div className="status-wrap">
                        <span className="status-badge" style={{ background: cfg.bg, color: cfg.color }} onClick={() => onStatusOpen(id)}>
                          <span className="dot" style={{ background: cfg.dot }}/>{task.status}
                        </span>
                        <div className={`status-picker${openPickerId === id ? ' open' : ''}`} style={{ position: 'absolute', zIndex: 400 }}>
                          {STATUSES.map(s => {
                            const sc = STATUS_CONFIG[s]
                            return (
                              <div key={s} className={`picker-opt${task.status === s ? ' picker-active' : ''}`} onClick={() => onStatusChange(id, s)}>
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
                        <div className={`due-display${overdue ? ' overdue' : ''}`} onClick={() => { setDueText(p => ({...p,[id]:task.due_date??''})); onDueEdit(id) }}>
                          {task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : <span className="muted">—</span>}
                        </div>
                        <input className="due-input" type="date" value={dueText[id] ?? task.due_date ?? ''}
                          onChange={e => setDueText(p => ({...p,[id]:e.target.value}))}
                          onBlur={() => onDueSave(id, dueText[id] ?? '')}
                          autoFocus={editingDueId === id}
                        />
                      </div>
                    </td>

                    {/* Link */}
                    <td className="col-link" style={{ overflow: 'visible', position: 'relative', zIndex: openLinkId === id ? 300 : 'auto' }}>
                      <div className="link-cell">
                        {task.link_url
                          ? <a className="link-chip" href={task.link_url} target="_blank" rel="noopener noreferrer">{task.link_label || 'Link'}</a>
                          : <span className="link-add" onClick={() => { setLinkUrl(p=>({...p,[id]:task.link_url})); setLinkLabel(p=>({...p,[id]:task.link_label})); onLinkOpen(id) }}>+ Add</span>
                        }
                        {task.link_url && <span className="link-add" style={{marginLeft:4}} onClick={() => { setLinkUrl(p=>({...p,[id]:task.link_url})); setLinkLabel(p=>({...p,[id]:task.link_label})); onLinkOpen(id) }}>✎</span>}
                        <div className={`link-popover${openLinkId === id ? ' open' : ''}`} style={{ zIndex: 400 }}>
                          <input placeholder="URL" value={linkUrl[id]??''} onChange={e=>setLinkUrl(p=>({...p,[id]:e.target.value}))}/>
                          <input placeholder="Label (optional)" value={linkLabel[id]??''} onChange={e=>setLinkLabel(p=>({...p,[id]:e.target.value}))}/>
                          <div className="link-popover-actions">
                            <button className="btn-cancel" onClick={()=>onLinkOpen(id)}>Cancel</button>
                            <button className="btn-save" onClick={()=>onLinkSave(id,linkUrl[id]??'',linkLabel[id]??'')}>Save</button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Notes */}
                    <td className="col-notes">
                      {editingNoteId === id ? (
                        <div className="notes-editor open">
                          <textarea className="notes-textarea" value={noteText[id]??task.notes} onChange={e=>setNoteText(p=>({...p,[id]:e.target.value}))} autoFocus/>
                          <div className="notes-actions">
                            <button className="btn-save" onClick={()=>onNoteSave(id,noteText[id]??task.notes)}>Save</button>
                            <button className="btn-cancel" onClick={()=>onNoteEdit('')}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="notes-display-wrap" onClick={()=>{setNoteText(p=>({...p,[id]:task.notes}));onNoteEdit(id)}}>
                          {task.notes ? <span className="notes-text">{task.notes}</span> : <span className="muted">—</span>}
                        </div>
                      )}
                    </td>

                    {/* Comments */}
                    <td className="col-comments" style={{ overflow: 'visible', position: 'relative', zIndex: openCommentId === id ? 300 : 'auto' }}>
                      <div className="comment-cell" onClick={()=>{setCommentText(p=>({...p,[id]:task.comments}));onCommentOpen(id)}}>
                        {task.comments
                          ? <><span className="comment-dot"/><span className="comment-text has-comment">{task.comments}</span></>
                          : <><span className="comment-text empty">Add comment…</span><span className="comment-hint">✎</span></>
                        }
                        <div className={`comment-editor${openCommentId === id ? ' open' : ''}`} style={{ zIndex: 400 }} onClick={e=>e.stopPropagation()}>
                          <textarea value={commentText[id]??task.comments} onChange={e=>setCommentText(p=>({...p,[id]:e.target.value}))} autoFocus={openCommentId===id}/>
                          <div className="notes-actions">
                            <button className="btn-save" onClick={()=>onCommentSave(id,commentText[id]??task.comments)}>Save</button>
                            <button className="btn-cancel" onClick={()=>onCommentOpen(id)}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Delete */}
                    <td className="col-delete" style={{ width: 32, padding: '9px 4px', verticalAlign: 'middle', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn-delete-task"
                        title="Delete task"
                        onClick={() => {
                          if (window.confirm(`Delete "${task.name || 'Untitled'}"? This cannot be undone.`)) {
                            onDelete(id)
                          }
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M11 4l-.9 7.2A1 1 0 019.1 12H4.9a1 1 0 01-1-.8L3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="add-row">
            <button className="btn-add-item" onClick={onAddItem}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Add item
            </button>
          </div>
        </>
      )}
    </div>
  )
}
