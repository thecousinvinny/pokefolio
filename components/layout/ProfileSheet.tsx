'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { LinkIcon, UploadIcon, LogOutIcon, DownloadIcon, ArrowPathIcon, EyeSlashIcon, EyeIcon } from '@/components/ui/Icons'
import { useCollection } from '@/components/CollectionContext'
import { createClient } from '@/lib/supabase/client'
import { conditionAdjustedValue } from '@/types'
import { formatPrice, rarityWeight } from '@/lib/utils'

export const LS_DISPLAY_NAME = 'catchm_display_name'
export const LS_AVATAR = 'catchm_avatar_img'
export const LS_PRIVACY = 'catchm_privacy_mode'
export const LS_DEFAULT_CONDITION = 'catchm_default_condition'

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const

type ShareFilter = 'all' | 'full-art' | 'favorites'
const SHARE_FILTERS: { key: ShareFilter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'full-art',  label: 'Full Art' },
  { key: 'favorites', label: 'Favs Only' },
]

interface Props {
  open: boolean
  onClose: () => void
  onAvatarChange: (img: string | null) => void
}

type View = 'main' | 'share' | 'logout'

export function ProfileSheet({ open, onClose, onAvatarChange }: Props) {
  const { cards, sales } = useCollection()
  const supabase = createClient()

  // ── Profile state ──
  const [displayName, setDisplayName] = useState('')
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [avatarImg, setAvatarImg] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Navigation ──
  const [view, setView] = useState<View>('main')

  // ── Display / preferences state ──
  const [privacyMode, setPrivacyMode] = useState(false)
  const [defaultCondition, setDefaultCondition] = useState('NM')
  const [cacheCleared, setCacheCleared] = useState(false)
  const router = useRouter()

  // ── Share state ──
  const [shareIncludeCollection, setShareIncludeCollection] = useState(true)
  const [shareIncludeWishlist, setShareIncludeWishlist] = useState(false)
  const [shareFilter, setShareFilter] = useState<ShareFilter>('all')
  const [shareExpiryDays, setShareExpiryDays] = useState<number | null>(30) // null = never
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  // Reset view when modal closes
  useEffect(() => { if (!open) setTimeout(() => setView('main'), 350) }, [open])

  // Load profile: localStorage first, then Supabase sync
  useEffect(() => {
    if (typeof window === 'undefined') return
    const lsName = localStorage.getItem(LS_DISPLAY_NAME) ?? ''
    const lsAvatar = localStorage.getItem(LS_AVATAR)
    setDisplayName(lsName)
    setAvatarImg(lsAvatar)
    setPrivacyMode(localStorage.getItem(LS_PRIVACY) === 'true')
    setDefaultCondition(localStorage.getItem(LS_DEFAULT_CONDITION) ?? 'NM')

    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id
      if (!uid) return
      supabase
        .from('user_profiles')
        .select('display_name, avatar_data, prefs')
        .eq('user_id', uid)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (!profile) return
          if (profile.display_name && profile.display_name !== lsName) {
            setDisplayName(profile.display_name)
            localStorage.setItem(LS_DISPLAY_NAME, profile.display_name)
          }
          if (profile.avatar_data && profile.avatar_data !== lsAvatar) {
            setAvatarImg(profile.avatar_data)
            localStorage.setItem(LS_AVATAR, profile.avatar_data)
            onAvatarChange(profile.avatar_data)
          } else if (!profile.avatar_data && lsAvatar) {
            setAvatarImg(null)
            localStorage.removeItem(LS_AVATAR)
            onAvatarChange(null)
          }
          // Sync preferences from Supabase (cross-device)
          const prefs = (profile as Record<string, unknown>).prefs as Record<string, unknown> | null
          if (prefs) {
            if (typeof prefs.privacy_mode === 'boolean' && prefs.privacy_mode !== (localStorage.getItem(LS_PRIVACY) === 'true')) {
              setPrivacyMode(prefs.privacy_mode)
              localStorage.setItem(LS_PRIVACY, String(prefs.privacy_mode))
              document.documentElement.dataset.privacy = prefs.privacy_mode ? 'true' : ''
            }
            if (typeof prefs.default_condition === 'string' && prefs.default_condition !== localStorage.getItem(LS_DEFAULT_CONDITION)) {
              setDefaultCondition(prefs.default_condition)
              localStorage.setItem(LS_DEFAULT_CONDITION, prefs.default_condition)
            }
          }
        })

      // Load existing share URL if any
      supabase
        .from('public_shares')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle()
        .then(({ data: share }) => {
          if (share) setShareUrl(`${window.location.origin}/share/${share.id}`)
        })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Display / preferences handlers ──
  function togglePrivacy() {
    const next = !privacyMode
    setPrivacyMode(next)
    localStorage.setItem(LS_PRIVACY, String(next))
    document.documentElement.dataset.privacy = next ? 'true' : ''
    upsertProfile({ prefs: { privacy_mode: next, default_condition: defaultCondition } })
  }

  function handleConditionChange(c: string) {
    setDefaultCondition(c)
    localStorage.setItem(LS_DEFAULT_CONDITION, c)
    upsertProfile({ prefs: { privacy_mode: privacyMode, default_condition: c } })
  }

  function clearBrowseCache() {
    localStorage.removeItem('catchm_browse_default_v2')
    localStorage.removeItem('catchm_b_sort')
    localStorage.removeItem('catchm_b_rarity')
    setCacheCleared(true)
    setTimeout(() => setCacheCleared(false), 2200)
  }

  // ── Profile helpers ──
  const upsertProfile = useCallback(async (patch: { display_name?: string; avatar_data?: string | null; prefs?: Record<string, unknown> }) => {
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user.id
    if (!uid) return
    await supabase.from('user_profiles').upsert({ user_id: uid, ...patch }, { onConflict: 'user_id' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    upsertProfile({ display_name: v || undefined })
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
      upsertProfile({ avatar_data: base64 })
    } finally {
      setUploading(false)
    }
  }

  function removeAvatar() {
    setAvatarImg(null)
    localStorage.removeItem(LS_AVATAR)
    onAvatarChange(null)
    upsertProfile({ avatar_data: null })
  }

  // ── Share helpers ──
  async function generateShare() {
    setSharing(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const uid = sessionData.session?.user.id
      if (!uid) return

      const owned = cards.filter(c => c.status === 'owned' || c.status === 'for_sale')
      const wishlist = cards.filter(c => c.status === 'wishlist')
      const filteredOwned = shareFilter === 'full-art'
        ? owned.filter(c => rarityWeight(c.rarity) >= 80)
        : shareFilter === 'favorites'
        ? owned.filter(c => c.is_favorite)
        : owned

      const payload = {
        user_id: uid,
        display_name: displayName || null,
        avatar_data: avatarImg,
        cards_data: shareIncludeCollection ? filteredOwned : null,
        wishlist_data: shareIncludeWishlist ? wishlist : null,
        include_collection: shareIncludeCollection,
        include_wishlist: shareIncludeWishlist,
        expires_at: shareExpiryDays
          ? new Date(Date.now() + shareExpiryDays * 86_400_000).toISOString()
          : null,
      }

      const { data: existing } = await supabase
        .from('public_shares')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle()

      let id: string
      if (existing) {
        await supabase.from('public_shares').update(payload).eq('id', existing.id)
        id = existing.id
      } else {
        const { data: created } = await supabase
          .from('public_shares').insert(payload).select('id').single()
        id = created!.id
      }

      setShareUrl(`${window.location.origin}/share/${id}`)
    } finally {
      setSharing(false)
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Logout ──
  async function handleLogout() {
    localStorage.removeItem(LS_DISPLAY_NAME)
    localStorage.removeItem(LS_AVATAR)
    localStorage.removeItem('catchm_cards_v1')
    localStorage.removeItem('catchm_sales_v1')
    await supabase.auth.signOut()
    window.location.reload()
  }

  // ── Computed ──
  const owned = cards.filter(c => c.status === 'owned' || c.status === 'for_sale')
  const totalValue = owned.reduce((s, c) => s + conditionAdjustedValue(c), 0)
  const filteredOwnedCount = shareFilter === 'full-art'
    ? owned.filter(c => rarityWeight(c.rarity) >= 80).length
    : shareFilter === 'favorites'
    ? owned.filter(c => c.is_favorite).length
    : owned.length
  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : null

  // ─────────────────────────────────────────────
  return (
    <Modal open={open} onClose={onClose}>
      {/* Hidden file input — must be in DOM for iOS */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {view === 'main' && (
        <MainView
          avatarImg={avatarImg}
          initials={initials}
          uploading={uploading}
          displayName={displayName}
          editing={editing}
          nameInput={nameInput}
          nameInputRef={nameInputRef}
          onAvatarClick={() => fileInputRef.current?.click()}
          onRemoveAvatar={removeAvatar}
          onStartEdit={startEdit}
          onNameChange={setNameInput}
          onSaveName={saveName}
          onCancelEdit={() => setEditing(false)}
          owned={owned}
          totalValue={totalValue}
          sales={sales}
          cards={cards}
          onOpenShare={() => { setView('share') }}
          onOpenLogout={() => setView('logout')}
          onExport={() => {
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
          }}
          privacyMode={privacyMode}
          onPrivacyToggle={togglePrivacy}
          defaultCondition={defaultCondition}
          onConditionChange={handleConditionChange}
          cacheCleared={cacheCleared}
          onClearCache={clearBrowseCache}
          onImport={() => { onClose(); router.push('/import') }}
        />
      )}

      {view === 'share' && (
        <ShareView
          includeCollection={shareIncludeCollection}
          includeWishlist={shareIncludeWishlist}
          onToggleCollection={() => setShareIncludeCollection(v => !v)}
          onToggleWishlist={() => setShareIncludeWishlist(v => !v)}
          shareFilter={shareFilter}
          onSetFilter={setShareFilter}
          filteredOwnedCount={filteredOwnedCount}
          expiryDays={shareExpiryDays}
          onSetExpiry={setShareExpiryDays}
          shareUrl={shareUrl}
          sharing={sharing}
          copied={copied}
          ownedCount={owned.length}
          wishlistCount={cards.filter(c => c.status === 'wishlist').length}
          onGenerate={generateShare}
          onCopy={copyShareUrl}
          onBack={() => setView('main')}
        />
      )}

      {view === 'logout' && (
        <LogoutView
          onConfirm={handleLogout}
          onCancel={() => setView('main')}
        />
      )}

      <div style={{ height: 4 }} />
    </Modal>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

function MainView({
  avatarImg, initials, uploading, displayName, editing, nameInput, nameInputRef,
  onAvatarClick, onRemoveAvatar, onStartEdit, onNameChange, onSaveName, onCancelEdit,
  owned, totalValue, sales, cards,
  onOpenShare, onOpenLogout, onExport,
  privacyMode, onPrivacyToggle, defaultCondition, onConditionChange,
  cacheCleared, onClearCache, onImport,
}: {
  avatarImg: string | null; initials: string | null; uploading: boolean
  displayName: string; editing: boolean; nameInput: string
  nameInputRef: React.RefObject<HTMLInputElement | null>
  onAvatarClick: () => void; onRemoveAvatar: () => void
  onStartEdit: () => void; onNameChange: (v: string) => void
  onSaveName: () => void; onCancelEdit: () => void
  owned: unknown[]; totalValue: number; sales: unknown[]; cards: unknown[]
  onOpenShare: () => void; onOpenLogout: () => void; onExport: () => void
  privacyMode: boolean; onPrivacyToggle: () => void
  defaultCondition: string; onConditionChange: (c: string) => void
  cacheCleared: boolean; onClearCache: () => void; onImport: () => void
}) {
  return (
    <>
      {/* Avatar + name */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, paddingBottom: 20, marginBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={onAvatarClick}
          aria-label="Change profile photo"
          style={{
            position: 'relative', width: 80, height: 80, borderRadius: '50%',
            border: 'none', padding: 0, cursor: 'pointer', background: 'transparent', flexShrink: 0,
          }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
            background: avatarImg ? 'transparent' : 'linear-gradient(135deg, var(--violet) 0%, var(--gold) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: initials && !avatarImg ? 26 : 20, fontWeight: 700, color: '#fff',
            boxShadow: '0 4px 24px rgba(156,114,250,0.45)',
          }}>
            {uploading ? <SpinnerSvg /> : avatarImg
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarImg} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (initials ?? <UserSvg />)}
          </div>
          {!uploading && (
            <div style={{
              position: 'absolute', bottom: 0, right: 0, width: 26, height: 26,
              borderRadius: '50%', background: 'var(--surface)',
              border: '2px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CameraSvg />
            </div>
          )}
        </button>

        {avatarImg && !uploading && (
          <button onClick={onRemoveAvatar} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--crimson)', padding: '0 4px',
          }}>
            Remove photo
          </button>
        )}

        {editing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={e => onNameChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSaveName(); if (e.key === 'Escape') onCancelEdit() }}
              maxLength={30}
              placeholder="Your name"
              style={{
                background: 'var(--surface)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '7px 12px', color: 'var(--text)',
                fontSize: 15, outline: 'none', minWidth: 0, width: 160,
              }}
            />
            <button onClick={onSaveName} style={{
              background: 'var(--btn-info)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '7px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>Save</button>
          </div>
        ) : (
          <button onClick={onStartEdit} style={{
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 4,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
              {displayName || <span style={{ color: 'var(--text3)' }}>Set your name</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              CATCHM Collector · tap to edit
            </div>
          </button>
        )}
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Cards', value: (owned as unknown[]).length },
          { label: 'Value', value: formatPrice(totalValue) },
          { label: 'Sold', value: (sales as unknown[]).length },
        ].map(s => (
          <div key={s.label} style={{
            textAlign: 'center', background: 'var(--surface)',
            borderRadius: 10, padding: '10px 6px', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Display ── */}
      <SectionLabel>Display</SectionLabel>
      <button
        onClick={onPrivacyToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--surface)', border: `1px solid ${privacyMode ? 'var(--violet)' : 'var(--border)'}`,
          borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
          marginBottom: 8, textAlign: 'left', transition: 'border-color 0.15s',
        }}>
        <span style={{ flexShrink: 0, display: 'flex', color: 'var(--text2)' }}>
          {privacyMode ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Privacy Mode</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Blur portfolio totals</div>
        </div>
        <div style={{
          width: 44, height: 26, borderRadius: 13, flexShrink: 0, position: 'relative',
          background: privacyMode ? 'var(--violet)' : 'rgba(255,255,255,0.12)',
          transition: 'background 0.2s',
        }}>
          <div style={{
            position: 'absolute', top: 3, left: privacyMode ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }} />
        </div>
      </button>

      {/* ── Preferences ── */}
      <SectionLabel>Preferences</SectionLabel>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 14px', marginBottom: 8,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
          Default Condition
        </div>
        <div style={{ display: 'flex', background: 'var(--elevated)', borderRadius: 9, padding: 3, gap: 2 }}>
          {CONDITIONS.map(c => (
            <button key={c} onClick={() => onConditionChange(c)} style={{
              flex: 1, padding: '6px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: defaultCondition === c ? 'var(--violet)' : 'transparent',
              color: defaultCondition === c ? '#fff' : 'var(--text3)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
              transition: 'background 0.15s, color 0.15s',
            }}>{c}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          Applied when adding new cards to CATCHM
        </div>
      </div>

      {/* ── Collection actions ── */}
      <SectionLabel>Collection</SectionLabel>
      <SettingsRow icon={<LinkIcon size={18} />} title="Share Collection" subtitle="Create a public link for friends" onClick={onOpenShare} />
      <SettingsRow icon={<UploadIcon size={18} />} title="Export Collection" subtitle="Download your cards & sales as JSON" onClick={onExport} />
      <SettingsRow icon={<DownloadIcon size={18} />} title="Import Collection" subtitle="Restore from a JSON backup" onClick={onImport} />
      <button
        onClick={onClearCache}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
          marginBottom: 8, textAlign: 'left',
          color: cacheCleared ? 'var(--emerald)' : 'var(--text)',
          transition: 'color 0.2s',
        }}>
        <span style={{ flexShrink: 0, display: 'flex', color: cacheCleared ? 'var(--emerald)' : 'var(--text2)' }}>
          <ArrowPathIcon size={18} />
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {cacheCleared ? 'Cache cleared!' : 'Clear Browse Cache'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Force-refresh card search results</div>
        </div>
      </button>

      {/* Account */}
      <SectionLabel>Account</SectionLabel>
      <button
        onClick={onOpenLogout}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
          marginBottom: 8, textAlign: 'left', color: 'var(--crimson)',
        }}>
        <LogOutIcon size={18} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Sign Out</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Disconnect this device</div>
        </div>
      </button>

      {/* About */}
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
    </>
  )
}

// ── Share sub-view ─────────────────────────────────────────────────────────────

const EXPIRY_OPTIONS: { days: number | null; label: string }[] = [
  { days: 7,    label: '7 days' },
  { days: 30,   label: '30 days' },
  { days: 90,   label: '90 days' },
  { days: null, label: 'Never' },
]

function ShareView({
  includeCollection, includeWishlist, onToggleCollection, onToggleWishlist,
  shareFilter, onSetFilter, filteredOwnedCount, expiryDays, onSetExpiry,
  shareUrl, sharing, copied, ownedCount, wishlistCount, onGenerate, onCopy, onBack,
}: {
  includeCollection: boolean; includeWishlist: boolean
  onToggleCollection: () => void; onToggleWishlist: () => void
  shareFilter: ShareFilter; onSetFilter: (f: ShareFilter) => void; filteredOwnedCount: number
  expiryDays: number | null; onSetExpiry: (d: number | null) => void
  shareUrl: string | null; sharing: boolean; copied: boolean
  ownedCount: number; wishlistCount: number
  onGenerate: () => void; onCopy: () => void; onBack: () => void
}) {
  const canGenerate = includeCollection || includeWishlist

  return (
    <>
      {/* Back header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={onBack} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          color: 'var(--text)',
        }}>
          <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Share Collection</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>Anyone with the link can view</div>
        </div>
      </div>

      {/* What to include */}
      <SectionLabel>Include</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <Toggle
          label="Collection"
          subtitle={`${ownedCount} card${ownedCount !== 1 ? 's' : ''}`}
          checked={includeCollection}
          onToggle={onToggleCollection}
        />

        {/* Filter chips — only visible when collection is toggled on */}
        {includeCollection && (
          <div style={{ paddingLeft: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase' }}>
              Show
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SHARE_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => onSetFilter(key)}
                  style={{
                    padding: '5px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: shareFilter === key ? 'var(--violet)' : 'var(--bg)',
                    color: shareFilter === key ? '#fff' : 'var(--text3)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
              <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', marginLeft: 2 }}>
                {filteredOwnedCount} card{filteredOwnedCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        <Toggle
          label="Wish List"
          subtitle={`${wishlistCount} card${wishlistCount !== 1 ? 's' : ''}`}
          checked={includeWishlist}
          onToggle={onToggleWishlist}
        />
      </div>

      {/* Link expiry */}
      <SectionLabel>Link expires</SectionLabel>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {EXPIRY_OPTIONS.map(({ days, label }) => (
          <button
            key={label}
            onClick={() => onSetExpiry(days)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 12, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: expiryDays === days ? 'var(--violet)' : 'var(--surface)',
              color: expiryDays === days ? '#fff' : 'var(--text3)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>
        {expiryDays
          ? `The link stops working ${expiryDays} days after you generate it.`
          : 'The link never expires — anyone with it can view forever.'}
      </p>

      {/* Generate */}
      <button
        onClick={onGenerate}
        disabled={!canGenerate || sharing}
        style={{
          width: '100%', padding: '13px', borderRadius: 12, border: 'none',
          background: canGenerate ? 'var(--btn-info)' : 'var(--btn-disabled)',
          color: '#fff', fontWeight: 700, fontSize: 15, cursor: canGenerate ? 'pointer' : 'default',
          marginBottom: 16, opacity: sharing ? 0.7 : 1,
          transition: 'opacity 0.15s',
        }}>
        {sharing ? 'Generating…' : shareUrl ? 'Update Link' : 'Generate Link'}
      </button>

      {/* Share URL */}
      {shareUrl && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em' }}>
            YOUR SHARE LINK
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text2)', wordBreak: 'break-all',
            lineHeight: 1.5, marginBottom: 12,
          }}>
            {shareUrl}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onCopy}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                background: copied ? 'var(--emerald)' : 'var(--btn-info)',
                color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                transition: 'background 0.2s',
              }}>
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: 'var(--surface)', border: '1px solid var(--border2)',
                color: 'var(--text)', fontWeight: 600, fontSize: 13,
                textDecoration: 'none', display: 'flex', alignItems: 'center',
                justifyContent: 'center', textAlign: 'center',
              }}>
              Preview ↗
            </a>
          </div>
        </div>
      )}
    </>
  )
}

// ── Logout confirmation ────────────────────────────────────────────────────────

function LogoutView({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', opacity: 0.7 }}><LogOutIcon size={44} /></div>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Sign Out?</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 24 }}>
        This disconnects your collection from this device.
        Since you&apos;re using anonymous sign-in, you won&apos;t be
        able to log back into this account.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}>
          Cancel
        </button>
        <button onClick={onConfirm} style={{
          flex: 1, padding: '12px', borderRadius: 12, border: 'none',
          background: 'var(--btn-remove)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function Toggle({ label, subtitle, checked, onToggle }: {
  label: string; subtitle: string; checked: boolean; onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        background: 'var(--surface)', border: `1px solid ${checked ? 'var(--violet)' : 'var(--border)'}`,
        borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
        transition: 'border-color 0.15s',
      }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{subtitle}</div>
      </div>
      {/* Pill toggle */}
      <div style={{
        width: 44, height: 26, borderRadius: 13, flexShrink: 0, position: 'relative',
        background: checked ? 'var(--violet)' : 'rgba(255,255,255,0.12)',
        transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </div>
    </button>
  )
}

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

function SettingsRow({ icon, title, subtitle, onClick }: {
  icon: React.ReactNode; title: string; subtitle: string; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 14px', color: 'var(--text)',
        cursor: onClick ? 'pointer' : 'default', marginBottom: 8, textAlign: 'left',
      }}>
      <span style={{ flexShrink: 0, display: 'flex', color: 'var(--text2)' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{subtitle}</div>
      </div>
      {onClick && (
        <svg style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--text3)' }}
          width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </button>
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────

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
