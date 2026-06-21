'use client'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CameraCapture } from '@/components/ui/CameraCapture'

const SCAN_TIMEOUT_MS = 12_000

type ScanState = 'idle' | 'camera' | 'confirm'
interface Props { onResult: (name: string, number?: string) => void }

// FIND search-bar scanner: opens the shared CameraCapture, OCRs the shot, and
// drops the detected name into the search box (editable, then "Search").
export function ScanCardButton({ onResult }: Props) {
  const [state, setState] = useState<ScanState>('idle')
  const [editValue, setEditValue] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [scanTimedOut, setScanTimedOut] = useState(false)
  const openedAtRef = useRef<number>(0)

  function onCapture(imageBase64: string) {
    openedAtRef.current = Date.now()
    setScanTimedOut(false)
    setEditValue('Scanning…')
    setCardNumber('')
    setState('confirm')
    doScan(imageBase64)
  }

  async function doScan(imageBase64: string) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS)
    try {
      const res = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json() as { name?: string; number?: string; debug?: string }
      setEditValue(data.name || data.debug || 'no name detected')
      setCardNumber(data.number ?? '')
    } catch (err) {
      clearTimeout(timeout)
      if ((err as Error).name === 'AbortError') {
        setScanTimedOut(true)
        setEditValue('')
      } else {
        setEditValue(`Error: ${String(err)}`)
      }
    }
  }

  function handleSearch() {
    if (editValue.trim()) onResult(editValue.trim(), cardNumber || undefined)
    setState('idle')
  }

  return (
    <>
      {/* Scan button */}
      <button
        onClick={() => state === 'idle' && setState('camera')}
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

      {state === 'camera' && (
        <CameraCapture onCapture={onCapture} onClose={() => setState('idle')} />
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
            <p style={{ margin: '0 0 10px', fontSize: 12, color: scanTimedOut ? 'rgba(251,146,60,0.9)' : 'rgba(255,255,255,0.55)' }}>
              {scanTimedOut
                ? 'Scan timed out — tap Retry to try again.'
                : editValue === 'Scanning…'
                  ? 'Reading card…'
                  : cardNumber
                    ? `Card #${cardNumber} · fix name if needed, then Search.`
                    : 'Fix the name if needed, then tap Search.'}
            </p>

            {/* Progress bar — visible only while actively scanning */}
            <div style={{ height: 3, borderRadius: 2, overflow: 'hidden', background: 'rgba(255,255,255,0.08)', marginBottom: 12 }}>
              {editValue === 'Scanning…' && !scanTimedOut && (
                <div style={{
                  height: '100%',
                  background: 'var(--btn-info)',
                  animation: `scan-progress ${SCAN_TIMEOUT_MS}ms cubic-bezier(0.1, 0.8, 0.4, 1) forwards`,
                }} />
              )}
            </div>

            <input
              value={editValue === 'Scanning…' ? '' : editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={editValue === 'Scanning…' ? 'Reading card…' : 'Card name…'}
              disabled={editValue === 'Scanning…'}
              style={{
                display: 'block', width: '100%', padding: '11px 14px',
                borderRadius: 10, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
                color: '#ffffff', fontSize: 16, outline: 'none',
                marginBottom: 12, opacity: editValue === 'Scanning…' ? 0.4 : 1,
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
                onClick={() => setState('camera')}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: scanTimedOut ? 'var(--btn-info)' : 'rgba(255,255,255,0.07)',
                  color: scanTimedOut ? '#fff' : 'rgba(255,255,255,0.75)',
                  border: scanTimedOut ? 'none' : '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
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
