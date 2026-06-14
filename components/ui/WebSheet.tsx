'use client'
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ─── Context ──────────────────────────────────────────────────────────────────

interface WebSheetCtx { open: (url: string) => void }
const Ctx = createContext<WebSheetCtx>({ open: () => {} })
export const useWebSheet = () => useContext(Ctx)

// ─── Provider (add once in app layout) ───────────────────────────────────────

export function WebSheetProvider({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null)
  return (
    <Ctx.Provider value={{ open: setUrl }}>
      {children}
      {url && <WebSheetOverlay url={url} onClose={() => setUrl(null)} />}
    </Ctx.Provider>
  )
}

// ─── Overlay ─────────────────────────────────────────────────────────────────

function WebSheetOverlay({ url, onClose }: { url: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Lock body scroll while sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Keyboard close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // Friendly display URL (strip protocol + trailing slash)
  const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      background: '#0D0F1A',
      animation: 'websheet-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
    }}>
      {/* ── Header bar ── */}
      <div style={{
        flexShrink: 0,
        paddingTop: 'env(safe-area-inset-top)',
        background: 'rgba(20,22,38,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
        }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              background: 'rgba(255,255,255,0.10)', border: 'none',
              borderRadius: 9, padding: '7px 13px',
              color: 'rgba(255,255,255,0.90)', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            CATCHM
          </button>

          <div style={{
            flex: 1, minWidth: 0,
            padding: '5px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 500,
              color: 'rgba(255,255,255,0.45)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {displayUrl}
            </p>
          </div>

          <a
            href={url} target="_blank" rel="noopener noreferrer"
            style={{
              flexShrink: 0, padding: '5px 9px', borderRadius: 8,
              fontSize: 11, fontWeight: 700, textDecoration: 'none',
              color: 'rgba(255,255,255,0.50)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
            ↗
          </a>
        </div>
      </div>

      {/* ── iframe ── */}
      <div style={{ flex: 1, position: 'relative', background: '#fff' }}>
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 14, background: '#0D0F1A',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.12)',
              borderTopColor: 'rgba(255,200,69,0.80)',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.40)', fontWeight: 500 }}>
              Loading TCGPlayer…
            </p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={url}
          title="TCGPlayer"
          onLoad={() => setLoaded(true)}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          style={{
            width: '100%', height: '100%', border: 'none',
            opacity: loaded ? 1 : 0, transition: 'opacity 0.2s',
            paddingBottom: 'env(safe-area-inset-bottom)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <style>{`
        @keyframes websheet-in {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  )
}
