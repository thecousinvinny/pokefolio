'use client'
import { useRef, useState } from 'react'

interface Props {
  onResult: (name: string) => void
}

function cropNameArea(file: File): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      // Top 20% of the card is where the name lives
      canvas.height = Math.round(img.height * 0.20)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(b => resolve(b!), 'image/png')
    }
    img.src = url
  })
}

function extractCardName(text: string): string | null {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 2 && /^[A-Za-z]/.test(l))
  if (!lines.length) return null
  // Strip trailing HP + number (e.g. "Charizard HP 330" → "Charizard")
  return lines[0].replace(/\s+HP\s*\d.*/i, '').replace(/\s+\d+.*$/, '').trim() || lines[0]
}

export function ScanCardButton({ onResult }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      const cropped = await cropNameArea(file)
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      const { data } = await worker.recognize(cropped)
      await worker.terminate()
      const name = extractCardName(data.text)
      if (name) onResult(name)
    } catch {
      // silently fail — user can type manually
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ''
    }
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
        onClick={() => !scanning && fileRef.current?.click()}
        title="Scan card with camera"
        style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: scanning ? 'rgba(255,200,69,0.12)' : 'var(--surface)',
          color: scanning ? 'var(--gold)' : 'var(--text2)',
          border: `1px solid ${scanning ? 'rgba(255,200,69,0.30)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: scanning ? 'default' : 'pointer',
        }}
      >
        {scanning ? (
          <div className="animate-spin-gold" style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2.5px solid var(--border)',
            borderTopColor: 'var(--gold)',
          }} />
        ) : (
          <svg width={18} height={18} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
        )}
      </button>
    </>
  )
}
