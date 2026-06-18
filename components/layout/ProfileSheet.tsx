'use client'
import { useRef, useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useCollection } from '@/components/CollectionContext'
import { conditionAdjustedValue } from '@/types'
import { formatPrice } from '@/lib/utils'

export const LS_DISPLAY_NAME = 'catchm_display_name'
export const LS_AVATAR = 'catchm_avatar_img'

interface Props {
  open: boolean
  onClose: () => void
  onAvatarChange: (img: string | null) => void
}

export function ProfileSheet({ open, onClose, onAvatarChange }: Props) {
  const { cards, sales } = useCollection()
  const [displayName, setDisplayName] = useState('')
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [avatarImg, setAvatarImg] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDisplayName(localStorage.getItem(LS_DISPLAY_NAME) ?? '')
    setAvatarImg(localStorage.getItem(LS_AVATAR))
  }, [])

  const owned = cards.filter(c => c.status === 'owned' || c.status === 'for_sale')
  const totalValue = owned.reduce((s, c) => s + conditionAdjustedValue(c), 0)

  function startEdit() {
    setNameInput(displayName)
    setEditing(true)
    setTimeout(() => nameInputRef.current?.focus(), 60)
  }

  function saveName() {
    const v = nameInput.trim()
    setDisplayName(v)
    if (v) localStorage.setItem(LS_DISPLAY_NAME, v)
    else localStorage.removeItem(LS_DISPLAY_NAME)
    setEditing(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const base64 = await resizeToSquare(file, 256)
      setAvatarImg(base64)
      localStorage.setItem(LS_AVATAR, base64)
      onAvatarChange(base64)
    } finally {
      setUploading(false)
    }
  }

  function removeAvatar() {
    setAvatarImg(null)
    localStorage.removeItem(LS_AVATAR)
    onAvatarChange(null)
  }

  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), cards, sales }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `catchm-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : null

  return (
    <Modal open={open} onClose={onClose} title="Profile & Settings">
      {/* Hidden file input — must be in DOM for iOS to work */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── Avatar + name ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, paddingBottom: 20, marginBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Tappable avatar */}
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Change profile photo"
          style={{
            position: 'relative', width: 80, height: 80, borderRadius: '50%',
            border: 'none', padding: 0, cursor: 'pointer',
            background: 'transparent', flexShrink: 0,
          }}>
          {/* Circle */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            overflow: 'hidden',
            background: avatarImg ? 'transparent' : 'linear-gradient(135deg, var(--violet) 0%, var(--gold) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: initials && !avatarImg ? 26 : 20, fontWeight: 700, color: '#fff',
            boxShadow: '0 4px 24px rgba(156, 114, 250, 0.45)',
          }}>
            {uploading ? (
              <SpinnerSvg />
            ) : avatarImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarImg} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials ?? <UserSvg />
            )}
          </div>

          {/* Camera badge */}
          {!uploading && (
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--surface)',
              border: '2px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CameraSvg />
            </div>
          )}
        </button>

        {/* Remove photo link */}
        {avatarImg && !uploading && (
          <button
            onClick={removeAvatar}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--crimson)', padding: '0 4px',
            }}>
            Remove photo
          </button>
        )}

        {/* Name */}
        {editing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') setEditing(false)
              }}
              maxLength={30}
              placeholder="Your name"
              style={{
                background: 'var(--surface)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '7px 12px',
                color: 'var(--text)', fontSize: 15, outline: 'none', minWidth: 0, width: 160,
              }}
            />
            <button
              onClick={saveName}
              style={{
                background: 'var(--btn-info)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
              Save
            </button>
          </div>
        ) : (
          <button onClick={startEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 4 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
              {displayName || <span style={{ color: 'var(--text3)' }}>Set your name</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              CATCHM Collector · tap to edit
            </div>
          </button>
        )}
      </div>

      {/* ── Quick stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Cards', value: owned.length },
          { label: 'Value', value: formatPrice(totalValue) },
          { label: 'Sold', value: sales.length },
        ].map(s => (
          <div key={s.label} style={{
            textAlign: 'center', background: 'var(--surface)',
            borderRadius: 10, padding: '10px 6px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Data section ── */}
      <SectionLabel>Data</SectionLabel>
      <SettingsRow
        icon="📤"
        title="Export Collection"
        subtitle="Download your cards & sales as JSON"
        onClick={exportData}
      />

      {/* ── About section ── */}
      <SectionLabel>About</SectionLabel>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>CATCHM</span>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>v1.0</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          Pokémon TCG Portfolio Tracker
        </div>
      </div>

      <div style={{ height: 8 }} />
    </Modal>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resizeToSquare(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        // Center-crop to square
        const s = Math.min(img.naturalWidth, img.naturalHeight)
        const sx = (img.naturalWidth - s) / 2
        const sy = (img.naturalHeight - s) / 2
        ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
      color: 'var(--text3)', marginBottom: 8, marginTop: 4,
    }}>
      {String(children ?? '').toUpperCase()}
    </div>
  )
}

function SettingsRow({
  icon, title, subtitle, onClick,
}: {
  icon: string; title: string; subtitle: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 14px',
        color: 'var(--text)', cursor: onClick ? 'pointer' : 'default',
        marginBottom: 8, textAlign: 'left',
      }}>
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{subtitle}</div>
      </div>
      {onClick && (
        <svg style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--text3)' }}
          width={16} height={16} fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </button>
  )
}

export function UserSvg({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function CameraSvg() {
  return (
    <svg width={13} height={13} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text2)' }}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  )
}

function SpinnerSvg() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2}
      style={{ color: 'rgba(255,255,255,0.8)', animation: 'spin 0.8s linear infinite' }}>
      <path strokeLinecap="round" d="M12 3a9 9 0 019 9" />
    </svg>
  )
}
