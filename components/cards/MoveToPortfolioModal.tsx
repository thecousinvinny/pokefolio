'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice } from '@/lib/utils'
import { CONDITION_ORDER, CONDITION_LABELS } from '@/types'
import type { PokemonCard } from '@/types'

interface MoveToPortfolioModalProps {
  card: PokemonCard | null
  onClose: () => void
  onBack?: () => void
}

export function MoveToPortfolioModal({ card, onClose, onBack }: MoveToPortfolioModalProps) {
  const { updateCard } = useCollection()
  const today = new Date().toISOString().slice(0, 10)
  const [condition, setCondition] = useState(0)
  const [pricePaid, setPricePaid] = useState('')
  const [boughtFrom, setBoughtFrom] = useState('')
  const [dateBought, setDateBought] = useState(today)
  const [notes, setNotes] = useState('')
  const [language, setLanguage] = useState<'EN' | 'JP' | 'CN'>(card?.language ?? 'EN')
  const [saving, setSaving] = useState(false)

  async function confirm() {
    if (!card) return
    setSaving(true)
    await updateCard(card.id, {
      status: 'owned',
      condition: CONDITION_ORDER[condition],
      price_paid: pricePaid ? parseFloat(pricePaid) : undefined,
      market_at_buy: card.market_price,
      bought_from: boughtFrom.trim() || undefined,
      date_added: dateBought
        ? new Date(dateBought + 'T12:00:00').toISOString()
        : new Date().toISOString(),
      notes: notes.trim() || undefined,
      language,
    })
    setSaving(false)
    onClose()
  }

  if (!card) return null

  const cond = CONDITION_ORDER[condition]

  return (
    <Modal open title="Move to CATCHM" onClose={onClose} maxWidth={400}>
      <div className="space-y-4">
        {onBack && (
          <button onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            ← {card.name}
          </button>
        )}

        {/* Card preview */}
        <div className="flex gap-4 items-start">
          {card.image_sm && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.image_sm} alt={card.name}
              className="flex-shrink-0 rounded-xl object-cover"
              style={{ width: 60, height: 84 }} />
          )}
          <div className="flex-1 min-w-0 pt-1">
            <h3 className="font-bold text-base truncate">{card.name}</h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
              {card.set_name}{card.set_number ? ` · #${card.set_number}` : ''}
            </p>
            {card.market_price != null && (
              <p className="mt-1.5 font-extrabold" style={{ color: 'var(--gold)' }}>
                {formatPrice(card.market_price)}{' '}
                <span className="text-xs font-normal" style={{ color: 'var(--text3)' }}>market</span>
              </p>
            )}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="section-label block mb-2">Language</label>
          <div className="flex gap-2">
            {(['EN', 'JP', 'CN'] as const).map(lang => (
              <button key={lang} onClick={() => setLanguage(lang)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 10,
                  fontSize: 13, fontWeight: 800, letterSpacing: '0.04em',
                  background: language === lang
                    ? lang === 'JP' ? '#E53E3E' : lang === 'CN' ? '#C05621' : 'var(--sky)'
                    : 'var(--s2)',
                  color: language === lang ? '#fff' : 'var(--text2)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.14s ease',
                }}>
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Condition */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="section-label">Condition</label>
            <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>
              {cond} — {CONDITION_LABELS[cond]}
            </span>
          </div>
          <input
            type="range" min={0} max={4} value={condition}
            onChange={e => setCondition(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between mt-1">
            {CONDITION_ORDER.map(c => (
              <span key={c} className="text-xs" style={{ color: 'var(--text3)' }}>{c}</span>
            ))}
          </div>
        </div>

        {/* Price + From */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="section-label block mb-1.5">Price paid</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm"
                style={{ color: 'var(--text3)' }}>$</span>
              <input
                type="number" min="0" step="0.01" placeholder="0.00" value={pricePaid}
                onChange={e => setPricePaid(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>
          <div className="flex-1">
            <label className="section-label block mb-1.5">From</label>
            <input
              type="text" placeholder="eBay, local…" value={boughtFrom}
              onChange={e => setBoughtFrom(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="section-label block mb-1.5">Date bought</label>
          <input
            type="date" value={dateBought}
            onChange={e => setDateBought(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="section-label block mb-1.5">Notes</label>
          <textarea
            placeholder="Optional notes…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>

        <button
          onClick={confirm} disabled={saving}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity"
          style={{
            background: 'linear-gradient(135deg, #45DB8D, #00B4D8)',
            color: '#fff',
            border: 'none',
            opacity: saving ? 0.7 : 1,
            cursor: saving ? 'default' : 'pointer',
          }}>
          {saving ? 'Saving…' : 'Move to CATCHM'}
        </button>
      </div>
    </Modal>
  )
}
