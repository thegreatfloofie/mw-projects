'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClientWithStats } from '@/lib/types'
import MWLogo from './MWLogo'

interface Props {
  initialClients: ClientWithStats[]
}

export default function Dashboard({ initialClients }: Props) {
  const router = useRouter()
  const [clients, setClients] = useState(initialClients)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAm, setNewAm] = useState('')
  const [newError, setNewError] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleCreateClient() {
    if (!newName.trim()) { setNewError('Client name is required.'); return }
    setCreating(true)
    setNewError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: newName.trim(), am_name: newAm.trim() || 'Marketwake' })
      .select()
      .single()

    if (error || !data) {
      setNewError('Failed to create client. Please try again.')
      setCreating(false)
      return
    }

    setClients(prev => [{ ...data, taskCount: 0, draftCount: 0, completedCount: 0 }, ...prev])
    setShowNewModal(false)
    setNewName('')
    setNewAm('')
    setCreating(false)
    router.push(`/dashboard/tracker/${data.id}`)
  }

  async function handleDeleteClient(id: string) {
    const supabase = createClient()
    await supabase.from('clients').delete().eq('id', id)
    setClients(prev => prev.filter(c => c.id !== id))
    setConfirmDelete(null)
  }

  return (
    <>
      <div className="page-wrapper">
        <header className="site-header">
          <div className="header-left">
            <MWLogo />
            <div className="header-divider" />
            <span className="header-title">Deliverables Hub</span>
          </div>
          <div className="header-right">
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={handleSignOut}>Sign out</button>
            <button className="btn-primary" onClick={() => { setShowNewModal(true); setNewError('') }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              New Client
            </button>
          </div>
        </header>

        <main className="main">
          <div className="dash-hero">
            <div className="dash-title">Client Trackers</div>
            <div className="dash-sub">Create and manage deliverables trackers for each of your clients.</div>
          </div>

          {clients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No clients yet</div>
              <div className="empty-sub">Create your first client tracker to get started.</div>
              <button className="btn-primary" onClick={() => setShowNewModal(true)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                New Client
              </button>
            </div>
          ) : (
            <div className="client-grid">
              {clients.map(client => {
                const pct = client.taskCount > 0
                  ? Math.round((client.completedCount / client.taskCount) * 100)
                  : 0
                return (
                  <div
                    key={client.id}
                    className="client-card"
                    onClick={() => router.push(`/dashboard/tracker/${client.id}`)}
                  >
                    <div className="card-top">
                      <div>
                        <div className="card-client-name">{client.name}</div>
                        <div className="card-am-tag">AM: {client.am_name}</div>
                      </div>
                      <button
                        className="card-menu-btn"
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === client.id ? null : client.id) }}
                      >•••</button>
                      {openMenuId === client.id && (
                        <div className="card-dropdown" onClick={e => e.stopPropagation()}>
                          <div
                            className="card-dropdown-item"
                            onClick={() => { setOpenMenuId(null); router.push(`/dashboard/tracker/${client.id}`) }}
                          >Open tracker</div>
                          <div
                            className="card-dropdown-item"
                            onClick={() => {
                              setOpenMenuId(null)
                              const url = `${window.location.origin}/c/${client.client_token}`
                              navigator.clipboard.writeText(url)
                            }}
                          >Copy client link</div>
                          <div
                            className="card-dropdown-item danger"
                            onClick={() => { setOpenMenuId(null); setConfirmDelete({ id: client.id, name: client.name }) }}
                          >Delete</div>
                        </div>
                      )}
                    </div>

                    <div className="card-progress-bar">
                      <div className="card-progress-fill" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="card-footer">
                      <div className="card-stat">
                        <div className="card-stat-num">{client.taskCount}</div>
                        <div className="card-stat-lbl">Total<br/>Items</div>
                      </div>
                      <div className="card-stat">
                        <div className="card-stat-num">{client.completedCount}</div>
                        <div className="card-stat-lbl">Com-<br/>pleted</div>
                      </div>
                      {client.draftCount > 0 && (
                        <span className="card-draft-badge">⚠ {client.draftCount} pending review</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* New client modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowNewModal(false) }}>
          <div className="modal-box">
            <div className="modal-title">New Client</div>
            <div className="modal-sub">Create a new deliverables tracker.</div>
            <div className="modal-field">
              <label className="modal-label">Client Name *</label>
              <input
                className="modal-input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Acme Corp"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreateClient()}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Account Manager</label>
              <input
                className="modal-input"
                value={newAm}
                onChange={e => setNewAm(e.target.value)}
                placeholder="e.g. Sarah Johnson"
                onKeyDown={e => e.key === 'Enter' && handleCreateClient()}
              />
            </div>
            {newError && <div className="modal-error">{newError}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowNewModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateClient} disabled={creating}>
                {creating ? 'Creating…' : 'Create Tracker'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(null) }}>
          <div className="modal-box">
            <div className="confirm-title">Delete "{confirmDelete.name}"?</div>
            <div className="confirm-msg">
              This will permanently delete the client and all their tasks and drafts. This action cannot be undone.
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDeleteClient(confirmDelete.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
