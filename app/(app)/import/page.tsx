'use client'
import { useState } from 'react'

export const dynamic = 'force-dynamic'

export default function ImportPage() {
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function clearData() {
    if (!confirm('Delete ALL your cards and sales from the database? This cannot be undone.')) return
    setClearing(true)
    setError(null)
    setResult(null)
    const res = await fetch('/api/import', { method: 'DELETE' })
    const json = await res.json()
    setClearing(false)
    if (!res.ok) setError(json.error ?? 'Clear failed')
    else setResult('All data cleared. Now upload your JSON to re-import.')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Import failed')
      } else {
        const { imported } = json
        setResult(
          `Done! ${imported.portfolio ?? 0} portfolio · ${imported.wishlist ?? 0} wishlist · ${imported.sales ?? 0} sales`
        )
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="bg-[var(--surface)] rounded-2xl p-8 max-w-md w-full flex flex-col gap-4">
        <h1 className="text-xl font-bold text-white">Import from FOLIO export</h1>
        <p className="text-sm text-white/60">
          Select your <code className="text-[var(--gold)]">folio-*.json</code> file.
          Portfolio, wishlist, and sales will all be imported.
        </p>

        <button
          onClick={clearData}
          disabled={clearing || loading}
          className="text-sm text-red-400 border border-red-400/30 hover:border-red-400 rounded-xl py-2 px-4 transition-colors disabled:opacity-40"
        >
          {clearing ? 'Clearing…' : '⚠ Clear all existing data first'}
        </button>

        <label className={`
          flex items-center justify-center rounded-xl border-2 border-dashed
          border-white/20 hover:border-[var(--gold)] transition-colors cursor-pointer p-6
          ${loading ? 'opacity-50 pointer-events-none' : ''}
        `}>
          <span className="text-white/60 text-sm">
            {loading ? 'Importing…' : 'Click to choose JSON file'}
          </span>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFile}
            disabled={loading}
          />
        </label>

        {result && (
          <p className="text-sm font-medium text-[var(--emerald)] bg-[var(--emerald)]/10 rounded-lg px-4 py-3">
            {result}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-3">
            Error: {error}
          </p>
        )}

        {result && result.startsWith('Done') && (
          <a
            href="/portfolio"
            className="text-center text-sm font-semibold bg-[var(--gold)] text-[var(--bg)] rounded-xl py-3 hover:opacity-90 transition-opacity"
          >
            View Portfolio →
          </a>
        )}
      </div>
    </div>
  )
}
