'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import type { PokemonCard, TCGCard } from '@/types'
import { getArtColors } from './CardArtwork'

// ─── Rarity helpers ────────────────────────────────────────────────────────────

export function rarityColor(rarity?: string | null): string {
  if (!rarity) return 'rgba(255,255,255,0.25)'
  const r = rarity.toLowerCase()
  if (r.includes('special illustration')) return '#FFC845'
  if (r.includes('illustration rare'))    return '#D166F2'
  if (r.includes('hyper rare') || r.includes('rainbow')) return '#73D9D9'
  if (r.includes('secret'))     return '#5DA9FF'
  if (r.includes('vmax') || r.includes('vstar')) return '#FF9E2E'
  if (r.includes('amazing'))    return '#73D9D9'
  if (r.includes('ultra rare') || r.includes(' ex') || r.includes(' gx')) return '#FF9E2E'
  if (r.includes('holo'))       return 'rgba(200,210,255,0.75)'
  if (r === 'rare')             return 'rgba(255,255,255,0.55)'
  if (r === 'uncommon')         return 'rgba(255,255,255,0.35)'
  return 'rgba(255,255,255,0.22)'
}

export function shortRarity(rarity?: string | null): string {
  if (!rarity) return 'Common'
  const r = rarity.toLowerCase()
  if (r.includes('special illustration')) return 'Spec Illus Rare'
  if (r.includes('illustration rare')) return 'Illus Rare'
  if (r.includes('hyper rare')) return 'Hyper Rare'
  if (r.includes('rainbow')) return 'Rainbow Rare'
  if (r.includes('secret rare')) return 'Secret Rare'
  if (r.includes('ultra rare')) return 'Ultra Rare'
  if (r.includes('amazing')) return 'Amazing Rare'
  if (r.includes('vmax')) return 'VMAX'
  if (r.includes('vstar')) return 'VSTAR'
  if (r.includes('holo')) return 'Holo Rare'
  if (r === 'rare') return 'Rare'
  if (r === 'uncommon') return 'Uncommon'
  return 'Common'
}

function isHoloRarity(rarity?: string | null): boolean {
  if (!rarity) return false
  const r = rarity.toLowerCase()
  return r.includes('holo') || r.includes('ultra') || r.includes('secret') ||
    r.includes('special') || r.includes('vmax') || r.includes('vstar') ||
    r.includes(' ex') || r.includes(' gx')
}

function getBrowsePrice(card: TCGCard): number | undefined {
  const p = card.tcgplayer?.prices
  if (!p) return undefined
  return p.holofoil?.market ?? p.normal?.market ?? p.reverseHolofoil?.market ?? p['1stEditionHolofoil']?.market
}

const SPRING = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.28s ease'

// ─── Shared sub-components ────────────────────────────────────────────────────

function RarityPill({ rarity }: { rarity?: string | null }) {
  const color = rarityColor(rarity)
  const isAccent = !color.startsWith('rgba')
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
      color,
      background: isAccent ? `${color}1A` : 'rgba(255,255,255,0.06)',
      border: `1px solid ${isAccent ? `${color}30` : 'rgba(255,255,255,0.10)'}`,
      borderRadius: 100, padding: '2px 7px', lineHeight: 1.5,
      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {shortRarity(rarity)}
    </span>
  )
}

function ActionBtn({ label, onClick, variant, disabled }: {
  label: string
  onClick?: (e: React.MouseEvent) => void
  variant: 'gold' | 'red-outline' | 'violet-outline' | 'ghost' | 'disabled'
  disabled?: boolean
}) {
  const v = disabled ? 'disabled' : variant
  const variantStyles: Record<string, React.CSSProperties> = {
    gold:             { background: 'var(--gold)', color: '#0D0F1A', border: 'none' },
    'red-outline':    { background: 'rgba(242,69,96,0.08)', color: 'var(--crimson)', border: '1px solid rgba(242,69,96,0.28)' },
    'violet-outline': { background: 'rgba(156,114,250,0.08)', color: 'var(--violet)', border: '1px solid rgba(156,114,250,0.28)' },
    ghost:            { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.52)', border: '1px solid rgba(255,255,255,0.12)' },
    disabled:         { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.06)' },
  }
  return (
    <button
      onClick={e => { if (!disabled) { e.stopPropagation(); onClick?.(e) } }}
      disabled={disabled}
      style={{
        flex: 1, padding: '6px 4px', borderRadius: 7,
        fontSize: 9.5, fontWeight: 800, letterSpacing: '0.03em',
        cursor: disabled ? 'default' : 'pointer',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'opacity 0.12s',
        ...variantStyles[v],
      }}>
      {label}
    </button>
  )
}

// Left-side card art panel — stretches full card height
function CardImg({ imageUrl, name, types, isHolo }: {
  imageUrl?: string; name: string; types?: string[]; isHolo?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [top, bottom] = getArtColors(types)
  const showImg = !!imageUrl && !failed

  return (
    <div style={{
      width: 80, flexShrink: 0, alignSelf: 'stretch',
      background: `linear-gradient(160deg, ${top} 0%, ${bottom} 100%)`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 25%, rgba(255,255,255,0.22) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      {showImg ? (
        <Image
          src={imageUrl} alt={name} fill
          className="object-contain"
          sizes="80px"
          style={{ padding: 2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, opacity: 0.28 }}>
          🃏
        </div>
      )}
      {isHolo && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.09) 45%, rgba(255,200,69,0.06) 50%, rgba(255,255,255,0.06) 55%, transparent 75%)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}

// ─── Portfolio tile ───────────────────────────────────────────────────────────

interface PortfolioTileProps {
  card: PokemonCard
  onClick?: () => void
  onLongPress?: () => void
  onSell?: (e: React.MouseEvent) => void
  onGift?: (e: React.MouseEvent) => void
  onAddToPortfolio?: () => void
  onRemove?: () => void
  inCollection?: boolean
  selected?: boolean
}

export function PortfolioTile({ card, onClick, onLongPress, onSell, onGift, onAddToPortfolio, onRemove, inCollection, selected }: PortfolioTileProps) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isWishlist = card.status === 'wishlist'
  const isHolo = isHoloRarity(card.rarity)
  const showSellGift = !isWishlist && !card.is_favorite && !card.is_showcase

  const borderColor = selected
    ? 'rgba(255,200,69,0.65)'
    : card.is_favorite
    ? 'rgba(255,200,69,0.35)'
    : 'rgba(255,255,255,0.07)'

  const shadow = pressed
    ? '0 4px 12px rgba(0,0,0,0.45)'
    : hovered
    ? '0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)'
    : card.is_favorite
    ? '0 0 0 1px rgba(255,200,69,0.28), 0 4px 16px rgba(0,0,0,0.25)'
    : '0 2px 10px rgba(0,0,0,0.18)'

  const transform = pressed
    ? 'scale(0.97)'
    : hovered
    ? 'scale(1.02) translateY(-2px)'
    : 'scale(1.0)'

  function down() {
    setPressed(true)
    if (onLongPress) lpTimer.current = setTimeout(() => { setPressed(false); onLongPress() }, 600)
  }
  function up() {
    setPressed(false)
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null }
  }

  return (
    <div
      onClick={onClick}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={() => { up(); setHovered(false) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={card.is_showcase ? 'showcase-border' : ''}
      style={{
        background: 'var(--surface)', border: `1px solid ${borderColor}`,
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer', userSelect: 'none',
        transform, transition: SPRING, boxShadow: shadow,
        position: 'relative', display: 'flex', flexDirection: 'column',
      }}>

      {/* Favourite star — top-left overlay */}
      {card.is_favorite && (
        <div style={{
          position: 'absolute', top: 7, left: 7, zIndex: 10,
          fontSize: 14, lineHeight: 1, color: 'var(--gold)',
          filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))',
          pointerEvents: 'none',
        }}>
          ★
        </div>
      )}

      {/* Main row: image + info */}
      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 100 }}>
        <CardImg
          imageUrl={card.image_sm ?? undefined}
          name={card.name}
          types={card.types}
          isHolo={isHolo}
        />

        {/* Info column */}
        <div style={{ flex: 1, minWidth: 0, padding: '9px 10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <RarityPill rarity={card.rarity} />
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
          }}>
            {card.name}
          </p>
          <p style={{
            margin: 0, fontSize: 10, color: 'var(--text3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2,
          }}>
            {card.set_name}{card.set_number ? ` · #${card.set_number}` : ''}
          </p>
          <div style={{ marginTop: 'auto', paddingTop: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: card.market_price != null ? 'var(--gold)' : 'var(--text3)', lineHeight: 1 }}>
              {card.market_price != null ? formatPrice(card.market_price, true) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex', gap: 5,
        padding: '6px 8px 8px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        {isWishlist ? (
          <>
            <ActionBtn
              label={inCollection ? '✓ In CATCHM' : '+ Add to CATCHM'}
              variant={inCollection ? 'disabled' : 'gold'}
              disabled={inCollection}
              onClick={() => onAddToPortfolio?.()}
            />
            <ActionBtn
              label="✕ Remove"
              variant="red-outline"
              onClick={e => { e.stopPropagation(); onRemove?.() }}
            />
          </>
        ) : showSellGift ? (
          <>
            <ActionBtn label="Sell" variant="red-outline" onClick={onSell} />
            <ActionBtn label="Gift" variant="violet-outline" onClick={onGift} />
          </>
        ) : (
          <div style={{ height: 26 }} />
        )}
      </div>
    </div>
  )
}

// ─── Browse tile ──────────────────────────────────────────────────────────────

interface BrowseTileProps {
  card: TCGCard
  onClick?: () => void
  onAddToPortfolio?: () => void
  onAddToWishlist?: () => void
  inCollection?: boolean
  inWishlist?: boolean
}

export function BrowseTile({ card, onClick, onAddToPortfolio, onAddToWishlist, inCollection, inWishlist }: BrowseTileProps) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const price = getBrowsePrice(card)
  const isHolo = isHoloRarity(card.rarity)

  const transform = pressed ? 'scale(0.97)' : hovered ? 'scale(1.02) translateY(-2px)' : 'scale(1.0)'
  const shadow = pressed
    ? '0 4px 12px rgba(0,0,0,0.45)'
    : hovered
    ? '0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)'
    : '0 2px 10px rgba(0,0,0,0.18)'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, overflow: 'hidden', userSelect: 'none',
        transform, transition: SPRING, boxShadow: shadow,
        display: 'flex', flexDirection: 'column',
      }}>

      {/* Tappable main row */}
      <div
        style={{ display: 'flex', alignItems: 'stretch', minHeight: 100, cursor: 'pointer' }}
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}>
        <CardImg imageUrl={card.images.small} name={card.name} types={card.types} isHolo={isHolo} />

        {/* Info column */}
        <div style={{ flex: 1, minWidth: 0, padding: '9px 10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <RarityPill rarity={card.rarity} />
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
          }}>
            {card.name}
          </p>
          <p style={{
            margin: 0, fontSize: 10, color: 'var(--text3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2,
          }}>
            {card.set.name}{card.number ? ` · #${card.number}` : ''}
          </p>
          <div style={{ marginTop: 'auto', paddingTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: price != null ? 'var(--gold)' : 'var(--text3)', lineHeight: 1 }}>
              {price != null ? formatPrice(price, true) : '—'}
            </span>
            {inCollection && (
              <span style={{
                fontSize: 9, fontWeight: 800, color: 'var(--emerald)',
                background: 'rgba(69,219,141,0.12)', border: '1px solid rgba(69,219,141,0.25)',
                padding: '1px 5px', borderRadius: 100, lineHeight: 1.4,
              }}>
                OWNED
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex', gap: 5,
        padding: '6px 8px 8px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <ActionBtn
          label={inWishlist ? '♥ Watchlist' : '+ Watchlist'}
          variant="ghost"
          disabled={inWishlist}
          onClick={() => onAddToWishlist?.()}
        />
        <ActionBtn
          label={inCollection ? '✓ CATCHM' : '+ CATCHM'}
          variant={inCollection ? 'disabled' : 'gold'}
          disabled={inCollection}
          onClick={() => onAddToPortfolio?.()}
        />
      </div>
    </div>
  )
}
