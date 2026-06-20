'use client'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

type ScanState = 'idle' | 'camera' | 'confirm'
interface Props { onResult: (name: string, number?: string) => void }

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top = pos[0] === 't'
  const left = pos[1] === 'l'
  return (
    <div style={{
      position: 'absolute',
      top: top ? -2 : undefined, bottom: top ? undefined : -2,
      left: left ? -2 : undefined, right: left ? undefined : -2,
      width: 22, height: 22,
      borderTop: top ? '3px solid rgba(255,200,69,0.95)' : undefined,
      borderBottom: top ? undefined : '3px solid rgba(255,200,69,0.95)',
      borderLeft: left ? '3px solid rgba(255,200,69,0.95)' : undefined,
      borderRight: left ? undefined : '3px solid rgba(255,200,69,0.95)',
      borderRadius: top && left ? '4px 0 0 0' : top && !left ? '0 4px 0 0' : !top && left ? '0 0 0 4px' : '0 0 4px 0',
    }} />
  )
}

export function ScanCardButton({ onResult }: Props) {
  const [state, setState] = useState<ScanState>('idle')
  const [editValue, setEditValue] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [camError, setCamError] = useState('')
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cardGuideRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const openedAtRef = useRef<number>(0)
  const fileRef = useRef<HTMLInputElement>(null)

  // Start/stop camera stream when entering/leaving camera state
  useEffect(() => {
    if (state !== 'camera') return
    let active = true
    setVideoReady(false)
    setCamError('')

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
    }).then(stream => {
      if (!active) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    }).catch(err => {
      if (!active) return
      setCamError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Camera unavailable.')
    })

    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [state])

  function openCamera() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia != null) {
      setState('camera')
    } else {
      fileRef.current?.click()
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setState('idle')
  }

  async function handleCapture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const vNW = video.videoWidth
    const vNH = video.videoHeight

    // Crop to the card guide rectangle so Vision only sees the card, not background.
    // objectFit:cover scales the video to fill the container; we reverse that to find
    // which native pixels correspond to the guide's screen position.
    const guide = cardGuideRef.current
    let sx = 0, sy = 0, sw = vNW, sh = vNH
    if (guide) {
      const vb = video.getBoundingClientRect()
      const gb = guide.getBoundingClientRect()
      const coverScale = Math.max(vb.width / vNW, vb.height / vNH)
      const overflowX = (vNW * coverScale - vb.width) / 2
      const overflowY = (vNH * coverScale - vb.height) / 2
      sx = Math.max(0, (gb.left - vb.left + overflowX) / coverScale)
      sy = Math.max(0, (gb.top  - vb.top  + overflowY) / coverScale)
      sw = Math.min(vNW - sx, gb.width  / coverScale)
      sh = Math.min(vNH - sy, gb.height / coverScale)
    }

    const maxDim = 1200
    const scale = Math.min(1, maxDim / Math.max(sw, sh))
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(sw * scale)
    canvas.height = Math.round(sh * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null

    openedAtRef.current = Date.now()
    setEditValue('Scanning…')
    setCardNumber('')
    setState('confirm')

    try {
      const res = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      })
      const data = await res.json() as { name?: string; number?: string; debug?: string }
      setEditValue(data.name || data.debug || 'no name detected')
      setCardNumber(data.number ?? '')
    } catch (err) {
      setEditValue(`Error: ${String(err)}`)
    }
  }

  // File input fallback (desktop / no camera API)
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''

    const img = new Image()
    const url = URL.createObjectURL(file)
    const imageBase64 = await new Promise<string>((resolve, reject) => {
      img.onload = () => {
        try {
          const maxDim = 1200
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('no ctx')); return }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(url)
          resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
        } catch (e) { URL.revokeObjectURL(url); reject(e) }
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load failed')) }
      img.src = url
    })

    openedAtRef.current = Date.now()
    setEditValue('Scanning…')
    setCardNumber('')
    setState('confirm')

    try {
      const res = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      })
      const data = await res.json() as { name?: string; number?: string; debug?: string }
      setEditValue(data.name || data.debug || 'no name detected')
      setCardNumber(data.number ?? '')
    } catch (err) {
      setEditValue(`Error: ${String(err)}`)
    }
  }

  function handleSearch() {
    if (editValue.trim()) onResult(editValue.trim(), cardNumber || undefined)
    setState('idle')
  }

  function handleRetry() {
    setState('idle')
    setTimeout(openCamera, 50)
  }

  return (
    <>
      {/* File fallback — hidden, used when getUserMedia unavailable */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, pointerEvents: 'none' }}
      />

      {/* Scan button */}
      <button
        onClick={() => state === 'idle' && openCamera()}
        title="Scan card with camera"
        style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: state !== 'idle' ? 'rgba(255,200,69,0.12)' : 'var(--surface)',
          color: state !== 'idle' ? 'var(--gold)' : 'var(--text2)',
          border: `1px solid ${state !== 'idle' ? 'rgba(255,200,69,0.30)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: state === 'idle' ? 'pointer' : 'default',
        }}
      >
        <svg width={18} height={18} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
      </button>

      {/* Camera viewfinder */}
      {state === 'camera' && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: '#000',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Live video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={() => setVideoReady(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Loading spinner while camera warms up */}
          {!videoReady && !camError && (
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div className="animate-spin" style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.2)',
                borderTopColor: '#fff',
              }} />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Starting camera…</span>
            </div>
          )}

          {/* Error state */}
          {camError && (
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 32px' }}>
              <p style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>{camError}</p>
              <button
                onClick={() => { setCamError(''); fileRef.current?.click(); setState('idle') }}
                style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--btn-info)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >Upload photo instead</button>
            </div>
          )}

          {/* Vignette */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 65% 70% at 50% 45%, transparent 38%, rgba(0,0,0,0.62) 100%)',
          }} />

          {/* Card guide */}
          {videoReady && (
            <div ref={cardGuideRef} style={{
              position: 'relative', zIndex: 1,
              width: 'min(72vw, 260px)',
              aspectRatio: '5/7',
              marginBottom: 16,
            }}>
              {/* Corner marks */}
              <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />

              {/* Name zone — top 22% */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '22%',
                background: 'rgba(255,200,69,0.10)',
                borderBottom: '1px dashed rgba(255,200,69,0.55)',
                borderRadius: '6px 6px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,200,69,0.75)', textTransform: 'uppercase' }}>Name</span>
              </div>

              {/* Number zone — bottom 13% */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '13%',
                background: 'rgba(156,114,250,0.10)',
                borderTop: '1px dashed rgba(156,114,250,0.55)',
                borderRadius: '0 0 6px 6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(156,114,250,0.75)', textTransform: 'uppercase' }}># Number</span>
              </div>
            </div>
          )}

          {/* Instruction */}
          {videoReady && (
            <p style={{
              position: 'relative', zIndex: 1,
              color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center',
              margin: '0 0 36px', letterSpacing: '0.02em',
            }}>
              Align card within frame, then tap capture
            </p>
          )}

          {/* Shutter button */}
          {videoReady && (
            <button
              onClick={handleCapture}
              style={{
                position: 'relative', zIndex: 1,
                width: 70, height: 70, borderRadius: '50%',
                background: 'transparent',
                border: '3px solid rgba(255,255,255,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                flexShrink: 0,
              }}
            >
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.92)' }} />
            </button>
          )}

          {/* Close button */}
          <button
            onClick={closeCamera}
            style={{
              position: 'absolute', top: 20, right: 20, zIndex: 2,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >✕</button>
        </div>,
        document.body
      )}

      {/* Confirm modal */}
      {state === 'confirm' && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 16px',
          }}
          onClick={() => { if (Date.now() - openedAtRef.current > 400) setState('idle') }}
        >
          <div
            style={{
              width: '100%', maxWidth: 480,
              background: '#252843', borderRadius: 20,
              padding: '20px 20px 24px',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
              CARD DETECTED
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              {editValue === 'Scanning…'
                ? 'Reading card…'
                : cardNumber
                  ? `Card #${cardNumber} · fix name if needed, then Search.`
                  : 'Fix the name if needed, then tap Search.'}
            </p>
            <input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Card name…"
              style={{
                display: 'block', width: '100%', padding: '11px 14px',
                borderRadius: 10, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
                color: '#ffffff', fontSize: 16, outline: 'none',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setState('idle')}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleRetry}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)',
                  border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                }}
              >↺ Retry</button>
              <button
                onClick={handleSearch}
                disabled={!editValue.trim() || editValue === 'Scanning…'}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: editValue.trim() && editValue !== 'Scanning…' ? 'var(--btn-info)' : 'var(--btn-disabled)',
                  color: '#fff', border: 'none',
                  cursor: editValue.trim() && editValue !== 'Scanning…' ? 'pointer' : 'default',
                }}
              >Search</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
