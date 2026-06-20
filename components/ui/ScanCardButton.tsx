'use client'
import { useRef, useState } from 'react'

type ScanState = 'idle' | 'scanning' | 'confirm'

interface Props {
  onResult: (name: string) => void
}

// Grayscale + contrast to help Tesseract on colorful card backgrounds
function preprocessImage(file: File): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < d.data.length; i += 4) {
        const g = Math.round(0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2])
        const c = Math.min(255, Math.max(0, (g - 128) * 1.6 + 128))
        d.data[i] = d.data[i + 1] = d.data[i + 2] = c
      }
      ctx.putImageData(d, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(b => resolve(b!), 'image/png')
    }
    img.src = url
  })
}

type TWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }

// Find the card name by locating the tallest (largest font) text cluster
function extractCardName(words: TWord[], imageHeight: number): string {
  const candidates = words.filter(w =>
    w.confidence > 25 &&
    w.text.trim().length > 1 &&
    /^[A-Za-zÀ-ö]/.test(w.text.trim()) &&
    // Ignore text in the bottom third (attacks, flavor text, set number)
    w.bbox.y1 < imageHeight * 0.67
  )
  if (!candidates.length) return ''

  // Anchor on the word with the tallest bounding box = largest font = card name
  const sorted = [...candidates].sort((a, b) =>
    (b.bbox.y1 - b.bbox.y0) - (a.bbox.y1 - a.bbox.y0)
  )
  const anchor = sorted[0]
  const anchorH = anchor.bbox.y1 - anchor.bbox.y0
  const anchorMidY = (anchor.bbox.y0 + anchor.bbox.y1) / 2

  // Collect all words on the same line as the anchor
  const line = candidates
    .filter(w => {
      const wMidY = (w.bbox.y0 + w.bbox.y1) / 2
      const wH = w.bbox.y1 - w.bbox.y0
      return (
        Math.abs(wMidY - anchorMidY) < anchorH * 0.65 &&
        wH > anchorH * 0.45
      )
    })
    .sort((a, b) => a.bbox.x0 - b.bbox.x0)
    .map(w => w.text.trim())
    .join(' ')
    .replace(/\s+HP\s*\d.*/i, '')   // strip "HP 330" suffix
    .replace(/\s+\d{1,3}\s*$/, '')  // strip trailing standalone numbers
    .trim()

  return line || anchor.text.trim()
}

export function ScanCardButton({ onResult }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ScanState>('idle')
  const [editValue, setEditValue] = useState('')
  const lastFileRef = useRef<File | null>(null)

  async function runOCR(file: File) {
    setState('scanning')
    try {
      const processed = await preprocessImage(file)
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      // PSM 11 = sparse text — finds text anywhere without assuming layout
      await worker.setParameters({ tessedit_pageseg_mode: '11' as never })
      const { data } = await worker.recognize(processed)
      await worker.terminate()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const words = (data as any).words as TWord[]
      const imgH = words.length ? Math.max(...words.map(w => w.bbox.y1)) : 1000
      const name = extractCardName(words, imgH)
      setEditValue(name)
      setState('confirm')
    } catch {
      setState('idle')
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    lastFileRef.current = file
    if (fileRef.current) fileRef.current.value = ''
    await runOCR(file)
  }

  function handleSearch() {
    if (editValue.trim()) onResult(editValue.trim())
    setState('idle')
  }

  function handleRetry() {
    setState('idle')
    setTimeout(() => fileRef.current?.click(), 50)
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: 'none' }}
      />

      <button
        onClick={() => state === 'idle' && fileRef.current?.click()}
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
        {state === 'scanning' ? (
          <div className="animate-spin" style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2.5px solid rgba(255,200,69,0.3)',
            borderTopColor: 'var(--gold)',
          }} />
        ) : (
          <svg width={18} height={18} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        )}
      </button>

      {state === 'confirm' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 16px 40px',
          }}
          onClick={() => setState('idle')}
        >
          <div
            style={{
              width: '100%', maxWidth: 480,
              background: 'var(--surface)', borderRadius: 20,
              padding: '20px 20px 24px', border: '1px solid var(--border)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              CARD DETECTED
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text3)' }}>
              Fix the name if needed, then tap Search.
            </p>
            <input
              autoFocus
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Card name…"
              style={{
                display: 'block', width: '100%', padding: '11px 14px',
                borderRadius: 10, boxSizing: 'border-box',
                background: 'var(--elevated)', border: '1px solid var(--border2)',
                color: 'var(--text)', fontSize: 16, outline: 'none',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setState('idle')}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'transparent', color: 'var(--text3)',
                  border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleRetry}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'transparent', color: 'var(--text2)',
                  border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
                }}
              >↺ Retry</button>
              <button
                onClick={handleSearch}
                disabled={!editValue.trim()}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: editValue.trim() ? 'var(--btn-info)' : 'var(--btn-disabled)',
                  color: '#fff', border: 'none',
                  cursor: editValue.trim() ? 'pointer' : 'default',
                }}
              >Search</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
