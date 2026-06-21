'use client'
import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CameraCapture } from '@/components/ui/CameraCapture'
import { CardArtwork } from '@/components/cards/CardArtwork'
import { Sparkline } from '@/components/ui/Sparkline'
import { TcgLink } from '@/components/ui/TcgLink'
import { Modal } from '@/components/ui/Modal'
import { AddToPortfolioModal } from '@/components/cards/AddToPortfolioModal'
import { SellModal } from '@/components/cards/CardDetailModal'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice, generatePriceHistory, rarityWeight, tcgSearchUrl } from '@/lib/utils'
import { getBestTCGPrice, getBestTCGPriceTiers, conditionAdjustedValue, CONDITION_LABELS } from '@/types'
import type { TCGCard, PokemonCard } from '@/types'
import { HeartIcon, XIcon } from '@/components/ui/Icons'

type FlowState = 'idle' | 'camera' | 'scanning' | 'picker' | 'result' | 'notfound'

async function searchCards(query: string, number: string): Promise<TCGCard[]> {
  const p = new URLSearchParams({ q: query, pageSize: '24' })
  if (number) p.set('number', number)
  try {
    const r = await fetch(`/api/tcg/search?${p}`, { signal: AbortSignal.timeout(11_000) })
    if (!r.ok) return []
    const d = await r.json()
    return (d.data ?? []) as TCGCard[]
  } catch { return [] }
}

export function ScanFab() {
  const [state, setState] = useState<FlowState>('idle')
  const [candidates, setCandidates] = useState<TCGCard[]>([])
  const [result, setResult] = useState<TCGCard | null>(null)
  const [ocrName, setOcrName] = useState('')
  const [addTarget, setAddTarget] = useState<TCGCard | null>(null)
  const [addStatus, setAddStatus] = useState<'owned' | 'wishlist'>('owned')

  function reset() {
    setState('idle'); setCandidates([]); setResult(null); setOcrName(''); setAddTarget(null)
  }

  async function resolve(imageBase64: string) {
    setState('scanning')
    try {
      const scanRes = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
        signal: AbortSignal.timeout(13_000),
      })
      const { name, number } = await scanRes.json() as { name?: string; number?: string }
      if (!name) { setOcrName(''); setState('notfound'); return }
      setOcrName(name)

      let cards = await searchCards(name, number ?? '')
      if (cards.length === 0 && number) cards = await searchCards(name, '')  // retry name-only

      if (cards.length === 0) { setState('notfound'); return }
      if (cards.length === 1) { setResult(cards[0]); setState('result') }
      else { setCandidates(cards); setState('picker') }
    } catch {
      setState('notfound')
    }
  }

  function chooseAdd(card: TCGCard, status: 'owned' | 'wishlist') {
    setAddStatus(status)
    setAddTarget(card)
  }

  return (
    <>
      {/* Floating camera FAB — sits just above the nav bar, right side */}
      <button
        onClick={() => setState('camera')}
        aria-label="Scan a card"
        style={{
          position: 'fixed',
          bottom: 'calc(88px + env(safe-area-inset-bottom))',
          right: 18,
          zIndex: 101,
          width: 56, height: 56, borderRadius: '50%',
          // Frosted liquid-glass so cards behind stay visible (blurred) through it
          background: 'rgba(251, 146, 60, 0.22)',
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.28)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <svg width={26} height={26} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
      </button>

      {state === 'camera' && (
        <CameraCapture onCapture={resolve} onClose={reset} />
      )}

      {state === 'scanning' && <ScanningOverlay />}

      {state === 'notfound' && (
        <NotFoundModal ocrName={ocrName} onRetry={() => setState('camera')} onClose={reset} />
      )}

      {state === 'picker' && (
        <CandidatePicker
          cards={candidates}
          onPick={card => { setResult(card); setState('result') }}
          onClose={reset}
        />
      )}

      {state === 'result' && result && (
        <ScanResultModal
          card={result}
          onClose={reset}
          onAddOwned={() => chooseAdd(result, 'owned')}
          onAddWishlist={() => chooseAdd(result, 'wishlist')}
        />
      )}

      {/* Add form — sits over the result modal; on close returns to the result */}
      <AddToPortfolioModal
        card={addTarget}
        defaultStatus={addStatus}
        onClose={() => setAddTarget(null)}
      />
    </>
  )
}

function ScanningOverlay() {
  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
    }}>
      <div className="animate-spin" style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--gold)' }} />
      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>Identifying card…</span>
    </div>,
    document.body
  )
}

function NotFoundModal({ ocrName, onRetry, onClose }: { ocrName: string; onRetry: () => void; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} maxWidth={400}>
      <div style={{ textAlign: 'center', padding: '8px 4px' }}>
        <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>Couldn’t identify the card</p>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--text3)' }}>
          {ocrName ? <>Read “{ocrName}” but found no match.</> : 'No text detected.'} Try again with the card flat and well-lit.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.07)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onRetry} style={{ flex: 2, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--btn-info)', color: '#fff', border: 'none', cursor: 'pointer' }}>↺ Scan again</button>
        </div>
      </div>
    </Modal>
  )
}

function CandidatePicker({ cards, onPick, onClose }: { cards: TCGCard[]; onPick: (c: TCGCard) => void; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} maxWidth={460}>
      <div style={{ position: 'relative' }}>
        <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>
          {cards.length} matches
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Which printing?</p>
        <div style={{ maxHeight: '60vh', overflowY: 'auto', margin: '0 -4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cards.map(card => {
            const price = getBestTCGPrice(card)
            return (
              <button key={card.id} onClick={() => onPick(card)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                  padding: 8, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)',
                  cursor: 'pointer',
                }}>
                <div style={{ width: 46, flexShrink: 0, borderRadius: 6, overflow: 'hidden', position: 'relative', paddingTop: `${Math.round(46 * 1.39)}px` }}>
                  <CardArtwork types={card.types} imageUrl={card.images.small || card.images.large} imageAlt={card.name} isHolo={rarityWeight(card.rarity) >= 30} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {card.set.name}{card.number ? ` · #${card.number}` : ''}{card.rarity ? ` · ${card.rarity}` : ''}
                  </p>
                </div>
                <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{price != null ? formatPrice(price) : '—'}</span>
              </button>
            )
          })}
        </div>
        <button onClick={onClose} style={{ marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.07)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
      </div>
    </Modal>
  )
}

function ScanResultModal({ card, onClose, onAddOwned, onAddWishlist }: {
  card: TCGCard
  onClose: () => void
  onAddOwned: () => void
  onAddWishlist: () => void
}) {
  const { cards } = useCollection()
  const ownedMatches = useMemo(
    () => cards.filter(c => (c.status === 'owned' || c.status === 'for_sale') && c.tcg_id === card.id),
    [cards, card.id],
  )
  const inCollection = ownedMatches.length > 0
  const inWishlist = cards.some(c => c.status === 'wishlist' && c.tcg_id === card.id)

  const [sellTarget, setSellTarget] = useState<PokemonCard | null>(null)
  const [pickCopy, setPickCopy] = useState(false)
  function startSell() {
    if (ownedMatches.length === 1) setSellTarget(ownedMatches[0])
    else if (ownedMatches.length > 1) setPickCopy(true)
  }

  const price = getBestTCGPrice(card)
  const tiers = getBestTCGPriceTiers(card)
  const priceHistory = useMemo(() => price != null ? generatePriceHistory(price) : [], [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const setRef = [
    card.number ? `#${card.number}${card.set.printedTotal ? `/${card.set.printedTotal}` : ''}` : null,
    card.set.releaseDate ? new Date(card.set.releaseDate.replace(/\//g, '-')).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null,
  ].filter(Boolean).join(' · ')

  return (
    <>
    <Modal open onClose={onClose} maxWidth={520}>
      <div style={{ position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: -4, right: -4, width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}><XIcon size={14} /></button>

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ width: 120, flexShrink: 0, borderRadius: 10, overflow: 'hidden', position: 'relative', paddingTop: `${Math.round(120 * 1.39)}px`, boxShadow: '0 6px 24px rgba(0,0,0,0.50)' }}>
            <CardArtwork types={card.types} imageUrl={card.images.large || card.images.small} imageAlt={card.name} isHolo={rarityWeight(card.rarity) >= 30} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <h2 style={{ margin: '0 0 5px', fontSize: 16, fontWeight: 800, lineHeight: 1.2, paddingRight: 32 }}>{card.name}</h2>
            {card.rarity && (
              <span style={{ display: 'inline-block', marginBottom: 5, fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', color: 'var(--text2)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 100, padding: '2px 8px', lineHeight: 1.5 }}>{card.rarity}</span>
            )}
            <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text3)' }}>{card.set.name}{setRef ? ` · ${setRef}` : ''}</p>
            {card.artist && <p style={{ margin: '0 0 8px', fontSize: 10, color: 'var(--text3)' }}>Illus. {card.artist}</p>}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

        <div style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>Market Value</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>{price != null ? formatPrice(price) : '—'}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>NM</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            {([{ label: 'NM Low', val: tiers?.low }, { label: 'Mid', val: tiers?.mid }, { label: 'High', val: tiers?.high }] as { label: string; val: number | undefined }[]).map(({ label, val }) => (
              <div key={label}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
                <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 700, color: val != null ? 'var(--text)' : 'var(--text3)' }}>{val != null ? formatPrice(val) : '—'}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>30-Day Price</span>
            {priceHistory.length > 1 && <span style={{ fontSize: 9, color: 'var(--text3)' }}>{formatPrice(Math.min(...priceHistory))} – {formatPrice(Math.max(...priceHistory))}</span>}
          </div>
          {priceHistory.length > 1 ? <Sparkline points={priceHistory} color="var(--emerald)" height={80} /> : <div style={{ height: 100, borderRadius: 8, background: 'var(--s2)', opacity: 0.4 }} />}
        </div>

        <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onAddWishlist} style={{ flex: 1, padding: '11px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--btn-wishlist)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <HeartIcon size={13} filled={inWishlist} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
              {inWishlist ? 'Add to WISH again' : 'Add to WISH'}
            </button>
            <button onClick={onAddOwned} style={{ flex: 1, padding: '11px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--btn-catchm)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {inCollection ? '+ Add Another' : 'Add to CATCHM'}
            </button>
          </div>
          {inCollection && (
            <button onClick={startSell} style={{ width: '100%', padding: '11px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--btn-sell)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Sell{ownedMatches.length > 1 ? ` (${ownedMatches.length} copies)` : ''}
            </button>
          )}
          <TcgLink url={tcgSearchUrl(card.name, card.set.name)} style={{ display: 'block', textAlign: 'center', padding: '8px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--btn-info)', border: 'none', textDecoration: 'none' }}>↗ View on TCGPlayer</TcgLink>
        </div>
      </div>
    </Modal>

    {pickCopy && (
      <OwnedCopyPicker
        matches={ownedMatches}
        onPick={c => { setPickCopy(false); setSellTarget(c) }}
        onClose={() => setPickCopy(false)}
      />
    )}
    {sellTarget && (
      <SellModal card={sellTarget} mode="sell" onClose={onClose} onBack={() => setSellTarget(null)} />
    )}
    </>
  )
}

function OwnedCopyPicker({ matches, onPick, onClose }: { matches: PokemonCard[]; onPick: (c: PokemonCard) => void; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} maxWidth={420}>
      <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>You own {matches.length}</p>
      <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 800 }}>Which copy to sell?</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map(c => (
          <button key={c.id} onClick={() => onPick(c)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '11px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{CONDITION_LABELS[c.condition] ?? c.condition}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text3)' }}>Paid {c.price_paid != null ? formatPrice(c.price_paid) : '—'}</p>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)' }}>{formatPrice(conditionAdjustedValue(c))}</span>
          </button>
        ))}
      </div>
      <button onClick={onClose} style={{ marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.07)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
    </Modal>
  )
}
