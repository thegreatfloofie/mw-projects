'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="login-card">
      <div className="login-logo">
        {/* Inline Marketwake wordmark — replace src with your logo if desired */}
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Marketwake</span>
      </div>
      <div className="login-title">Welcome back</div>
      <div className="login-sub">Sign in to the Deliverables Hub</div>

      {error && <div className="login-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="login-input-wrap">
          <label className="login-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="login-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@marketwake.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="login-input-wrap">
          <label className="login-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="login-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>
        <button className="login-submit" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
