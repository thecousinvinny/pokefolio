'use client'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Full-screen camera viewfinder. Owns the getUserMedia stream, the card guide,
// capture (crop to guide + contrast boost), and the file-upload fallback.
// Emits the cropped image as base64 (no jpeg prefix) via onCapture.

interface Props {
  onCapture: (imageBase64: string) => void
  onClose: () => void
}

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

export function CameraCapture({ onCapture, onClose }: Props) {
  const [camError, setCamError] = useState('')
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cardGuideRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const hasCamera = typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia != null

  useEffect(() => {
    if (!hasCamera) { fileRef.current?.click(); return }
    let active = true
    setVideoReady(false)
    setCamError('')
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
    }).then(stream => {
      if (!active) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    }).catch(err => {
      if (!active) return
      setCamError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Camera unavailable.')
    })
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [hasCamera])

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function handleCapture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const vNW = video.videoWidth, vNH = video.videoHeight

    // Reverse objectFit:cover to map the guide rectangle to native pixels, then crop.
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
    ctx.filter = 'contrast(1.4) brightness(1.1)'
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
    stopStream()
    onCapture(base64)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) { if (!hasCamera) onClose(); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        img.onload = () => {
          try {
            const maxDim = 1200
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            const ctx = canvas.getContext('2d')
            if (!ctx) { reject(new Error('no ctx')); return }
            ctx.filter = 'contrast(1.4) brightness(1.1)'
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            URL.revokeObjectURL(url)
            resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
          } catch (err) { URL.revokeObjectURL(url); reject(err) }
        }
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load failed')) }
        img.src = url
      })
      stopStream()
      onCapture(base64)
    } catch { onClose() }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile}
        style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, pointerEvents: 'none' }} />

      <video ref={videoRef} autoPlay playsInline muted onCanPlay={() => setVideoReady(true)}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          opacity: videoReady ? 1 : 0, transition: 'opacity 0.25s ease',
        }} />

      {!videoReady && !camError && hasCamera && (
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Starting camera…</span>
        </div>
      )}

      {camError && (
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 32px' }}>
          <p style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>{camError}</p>
          <button onClick={() => { setCamError(''); fileRef.current?.click() }}
            style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--btn-info)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
            Upload photo instead
          </button>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 65% 70% at 50% 45%, transparent 38%, rgba(0,0,0,0.62) 100%)' }} />

      {videoReady && (
        <div ref={cardGuideRef} style={{ position: 'relative', zIndex: 1, width: 'min(72vw, 260px)', aspectRatio: '5/7', marginBottom: 16 }}>
          <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '22%', background: 'rgba(255,200,69,0.10)', borderBottom: '1px dashed rgba(255,200,69,0.55)', borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,200,69,0.75)', textTransform: 'uppercase' }}>Name</span>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '13%', background: 'rgba(255,200,69,0.10)', borderTop: '1px dashed rgba(255,200,69,0.55)', borderRadius: '0 0 6px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,200,69,0.75)', textTransform: 'uppercase' }}># Number</span>
          </div>
        </div>
      )}

      {videoReady && (
        <p style={{ position: 'relative', zIndex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center', margin: '0 0 36px', letterSpacing: '0.02em' }}>
          Align card within frame, then tap capture
        </p>
      )}

      {videoReady && (
        <button onClick={handleCapture}
          style={{ position: 'relative', zIndex: 1, width: 70, height: 70, borderRadius: '50%', background: 'transparent', border: '3px solid rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', flexShrink: 0 }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,0.92)' }} />
        </button>
      )}

      <button onClick={() => { stopStream(); onClose() }}
        style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 48px)', right: 20, zIndex: 2, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        ✕
      </button>
    </div>,
    document.body
  )
}
