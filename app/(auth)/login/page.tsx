'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleGoogle() {
    setLoading(true)
    setError('')
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (isSignup) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      setMessage('Check your email for a confirmation link.')
      setLoading(false)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at top, #171923 0%, #0D0F1A 60%)' }}>
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #FFC845, #FF9E2E)', boxShadow: '0 0 40px rgba(255,200,69,0.3)' }}>
            <span className="text-2xl font-black text-black">C</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">CATCHM</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>Pokémon TCG Portfolio Tracker</p>
        </div>

        {/* Card */}
        <div className="surface-card p-6">
          <h2 className="text-lg font-bold mb-5">
            {isSignup ? 'Create account' : 'Sign in'}
          </h2>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold transition-opacity mb-5"
            style={{ background: 'var(--elevated)', border: '1px solid var(--border)', color: 'var(--text)', opacity: loading ? 0.7 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text3)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="section-label block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label className="section-label block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ background: 'rgba(242,69,96,0.12)', color: 'var(--crimson)' }}>
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm px-3 py-2 rounded-lg"
                style={{ background: 'rgba(69,219,141,0.12)', color: 'var(--emerald)' }}>
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm transition-opacity"
              style={{ background: 'linear-gradient(135deg, var(--gold), var(--amber))', color: '#0D0F1A', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Loading…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{ color: 'var(--text3)' }}>
            {isSignup ? 'Already have an account? ' : "Don't have an account? "}
            <button
              onClick={() => { setIsSignup(!isSignup); setError(''); setMessage('') }}
              className="font-semibold transition-colors hover:opacity-80"
              style={{ color: 'var(--gold)' }}>
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
