'use client'
import { useState } from 'react'
import Image from 'next/image'
import { Modal } from '@/components/ui/Modal'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice } from '@/lib/utils'
import { getBestTCGPrice, tcgCardToPortfolioCard, CONDITION_ORDER, CONDITION_LABELS } from '@/types'
import type { TCGCard } from '@/types'

interface AddToPortfolioModalProps {
  card: TCGCard | null
  onClose: () => void
  defaultStatus?: 'owned' | 'wishlist'
}

export function AddToPortfolioModal({ card, onClose, defaultStatus = 'owned' }: AddToPortfolioModalProps) {
  const { addCard } = useCollection()
  const today = new Date().toISOString().slice(0, 10)

  const [status, setStatus] = useState<'owned' | 'wishlist'>(defaultStatus)
  const [language, setLanguage] = useState<'EN' | 'JP' | 'CN'>('EN')
  const [condition, setCondition] = useState<number>(0)
  const [pricePaid, setPricePaid] = useState('')
  const [boughtFrom, setBoughtFrom] = useState('')
  const [dateBought, setDateBought] = useState(today)
  const [targetPrice, setTargetPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const marketPrice = card ? getBestTCGPrice(card) : undefined

  async function save() {
    if (!card) return
    setSaving(true)
    const base = tcgCardToPortfolioCard(card)
    await addCard({
      ...base,
      language,
      status,
      condition: CONDITION_ORDER[condition],
      price_paid: status === 'owned' && pricePaid ? parseFloat(pricePaid) : undefined,
      market_at_buy: marketPrice,
      bought_from: status === 'owned' && boughtFrom.trim() ? boughtFrom.trim() : undefined,
      target_price: status === 'wishlist' && targetPrice ? parseFloat(targetPrice) : undefined,
      notes: status === 'owned' && notes.trim() ? notes.trim() : undefined,
      alerts_enabled: status === 'wishlist',
      is_favorite: false,
      date_added: dateBought ? new Date(dateBought).toISOString() : new Date().toISOString(),
    })
    setSaving(false)
    onClose()
  }

  return (
    <Modal open={!!card} onClose={onClose} title={status === 'owned' ? 'Add to CATCHM' : 'Add to WISH'}>
      {card && (
        <div className="space-y-4">
          {/* Card preview */}
          <div className="flex gap-4 items-start">
            <div className="relative flex-shrink-0 rounded-xl overflow-hidden"
              style={{ width: 70, height: 98, background: 'var(--bg)' }}>
              <Image src={card.images.small} alt={card.name} fill className="object-cover" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="font-bold text-base truncate">{card.name}</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text3)' }}>
                {card.set.name} · #{card.number}
              </p>
              {card.rarity && (
                <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'var(--s2)', color: 'var(--text2)' }}>
                  {card.rarity}
                </span>
              )}
              {marketPrice != null && (
                <p className="mt-2 font-extrabold" style={{ color: 'var(--gold)' }}>
                  {formatPrice(marketPrice)}{' '}
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

          {/* Condition (owned only) */}
          {status === 'owned' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="section-label">Condition</label>
                <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>
                  {CONDITION_ORDER[condition]} — {CONDITION_LABELS[CONDITION_ORDER[condition]]}
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
          )}

          {/* Owned fields: price + from side by side */}
          {status === 'owned' && (
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
          )}

          {/* Date bought */}
          {status === 'owned' && (
            <div>
              <label className="section-label block mb-1.5">Date bought</label>
              <input
                type="date" value={dateBought}
                onChange={e => setDateBought(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
          )}

          {/* Notes (owned only) */}
          {status === 'owned' && (
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
          )}

          {/* Target price (wishlist) */}
          {status === 'wishlist' && (
            <div>
              <label className="section-label block mb-1.5">Target price (buy if ≤)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm"
                  style={{ color: 'var(--text3)' }}>$</span>
                <input
                  type="number" min="0" step="0.01"
                  placeholder={marketPrice ? (marketPrice * 0.85).toFixed(2) : '0.00'}
                  value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>
          )}

          {/* Save */}
          <button
            onClick={save} disabled={saving}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity"
            style={{
              background: status === 'owned'
                ? 'linear-gradient(135deg, #45DB8D, #00B4D8)'
                : 'linear-gradient(135deg, #C084FC, #7C3AED)',
              color: '#fff',
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? 'Saving…' : status === 'owned' ? 'Add to CATCHM' : 'Add to WISH'}
          </button>
        </div>
      )}
    </Modal>
  )
}
