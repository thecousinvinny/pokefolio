'use client'
import { useState, useRef } from 'react'
import { formatPrice } from '@/lib/utils'
import type { PokemonCard, TCGCard } from '@/types'
import { CardArtwork, TypeBadge } from './CardArtwork'

// ─── Rarity color map ─────────────────────────────────────────────────────────

function rarityColor(rarity?: string | null): string {
  if (!rarity) return 'rgba(255,255,255,0.25)'
  const r = rarity.toLowerCase()
  if (r.includes('special illustration')) return '#FFC845'
  if (r.includes('illustration rare'))    return '#D166F2'
  if (r.includes('hyper rare') || r.includes('rainbow')) return '#73D9D9'
  if (r.includes('secret'))     return '#5DA9FF'
  if (r.includes('vmax'))       return '#FF9E2E'
  if (r.includes('vstar'))      return '#FF9E2E'
  if (r.includes('amazing'))    return '#73D9D9'
  if (r.includes('ultra rare')) return '#FF9E2E'
  if (r.includes(' ex') && !r.includes('vmax')) return '#FF9E2E'
  if (r.includes(' gx'))        return '#FF9E2E'
  if (r.includes('holo v') && !r.includes('vmax') && !r.includes('vstar')) return '#FF9E2E'
  if (r.includes('holo'))       return 'rgba(200,210,255,0.75)'
  if (r === 'rare')             return 'rgba(255,255,255,0.55)'
  if (r === 'uncommon')         return 'rgba(255,255,255,0.35)'
  return 'rgba(255,255,255,0.22)'   // common / unknown
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

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const MAP: Record<string, { label: string; color: string }> = {
    owned:    { label: 'OWNED',    color: '#45DB8D' },
    wishlist: { label: 'WISH',     color: '#9C72FA' },
    for_sale: { label: 'FOR SALE', color: '#FF9E2E' },
  }
  const { label, color } = MAP[status] ?? MAP.owned
  return (
    <span style={{
      fontSize: 8, fontWeight: 900, letterSpacing: '0.05em',
      color: '#000', background: color,
      padding: '2px 6px', borderRadius: 100, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function RarityPill({ rarity }: { rarity?: string | null }) {
  const color = rarityColor(rarity)
  const isAccent = !color.startsWith('rgba')
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 7.5, fontWeight: 900, letterSpacing: '0.08em',
      color,
      background: isAccent ? `${color}16` : 'rgba(255,255,255,0.05)',
      border: `1px solid ${isAccent ? `${color}35` : 'rgba(255,255,255,0.10)'}`,
      borderRadius: 100, padding: '2px 7px', lineHeight: 1.5,
      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {(rarity ?? 'COMMON').toUpperCase()}
    </span>
  )
}

function TileBtn({ label, color, bg, onClick, disabled }: {
  label: string; color: string; bg: string
  onClick?: (e: React.MouseEvent) => void; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '5px 0', borderRadius: 7,
        fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
        background: disabled ? 'rgba(255,255,255,0.04)' : bg,
        color: disabled ? 'rgba(255,255,255,0.18)' : color,
        border: 'none', cursor: disabled ? 'default' : 'pointer',
      }}>
      {label}
    </button>
  )
}

const SPRING = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease'

// ─── Portfolio tile ───────────────────────────────────────────────────────────

interface PortfolioTileProps {
  card: PokemonCard
  onClick?: () => void
  onLongPress?: () => void
  onSell?: (e: React.MouseEvent) => void
  onGift?: (e: React.MouseEvent) => void
  selected?: boolean
}

export function PortfolioTile({ card, onClick, onLongPress, onSell, onGift, selected }: PortfolioTileProps) {
  const [pressed, setPressed] = useState(false)
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isHolo = isHoloRarity(card.rarity)
  const isJP = card.language === 'JP'
  const delta = card.price_yesterday && card.market_price
    ? ((card.market_price - card.price_yesterday) / card.price_yesterday) * 100
    : null
  const showActions = !card.is_favorite && !card.is_showcase

  function down() {
    setPressed(true)
    if (onLongPress) lpTimer.current = setTimeout(() => { setPressed(false); onLongPress() }, 600)
  }
  function up() {
    setPressed(false)
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null }
  }

  const borderColor = selected
    ? 'rgba(255,200,69,0.65)'
    : card.is_favorite
    ? 'rgba(255,200,69,0.35)'
    : 'rgba(255,255,255,0.07)'

  const shadow = pressed
    ? '0 20px 48px rgba(0,0,0,0.60)'
    : card.is_favorite
    ? '0 0 0 1.5px rgba(255,200,69,0.40), 0 8px 28px rgba(0,0,0,0.35)'
    : '0 4px 16px rgba(0,0,0,0.25)'

  return (
    <div
      onClick={onClick}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      className={card.is_showcase ? 'showcase-border' : ''}
      style={{
        background: 'var(--surface)', border: `1px solid ${borderColor}`,
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer', userSelect: 'none',
        transform: pressed ? 'scale(1.04)' : 'scale(1.0)',
        transition: SPRING, boxShadow: shadow,
      }}>

      {/* Artwork */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '139%' }}>
        <CardArtwork types={card.types} imageUrl={card.image_sm ?? undefined} imageAlt={card.name} isHolo={isHolo} />

        {/* TL: JP / selection */}
        {(selected || isJP) && (
          <div style={{ position: 'absolute', top: 7, left: 7, zIndex: 2 }}>
            {selected
              ? <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#0D0F1A', fontWeight: 900 }}>✓</div>
              : <span style={{ fontSize: 7.5, fontWeight: 900, color: '#fff', background: '#E53E3E', padding: '2px 5px', borderRadius: 4, lineHeight: 1.4 }}>JP</span>
            }
          </div>
        )}

        {/* TR: status */}
        <div style={{ position: 'absolute', top: 7, right: 7, zIndex: 2 }}>
          <StatusPill status={card.status} />
        </div>

        {/* BR: delta */}
        {delta != null && (
          <div style={{ position: 'absolute', bottom: 7, right: 7, zIndex: 2 }}>
            <span style={{
              fontSize: 8, fontWeight: 800,
              color: delta >= 0 ? '#45DB8D' : '#F24560',
              background: delta >= 0 ? 'rgba(69,219,141,0.22)' : 'rgba(242,69,96,0.22)',
              padding: '2px 5px', borderRadius: 4, lineHeight: 1.4,
              backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            }}>
              {delta >= 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '8px 10px 0' }}>
        <div style={{ minHeight: 19, marginBottom: 5 }}>
          <RarityPill rarity={card.rarity} />
        </div>
        <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, overflow: 'hidden' }}>
          <TypeBadge type={card.types?.[0]} size={6} />
          <span style={{ fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.set_name}{card.set_number ? ` · #${card.set_number}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1, color: 'var(--gold)' }}>
            {card.market_price != null ? formatPrice(card.market_price, true) : '—'}
          </span>
          {card.tcgplayer_url && (
            <a
              href={card.tcgplayer_url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)', textDecoration: 'none', padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', lineHeight: 1.4, whiteSpace: 'nowrap' }}>
              ↗ TCG
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions ? (
        <div style={{ display: 'flex', gap: 5, padding: '8px 10px 10px' }}>
          <TileBtn label="SELL" color="var(--crimson)" bg="rgba(242,69,96,0.10)" onClick={e => { e.stopPropagation(); onSell?.(e) }} />
          <TileBtn label="GIFT" color="var(--violet)" bg="rgba(156,114,250,0.10)" onClick={e => { e.stopPropagation(); onGift?.(e) }} />
        </div>
      ) : (
        <div style={{ height: 10 }} />
      )}
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
  const price = getBrowsePrice(card)
  const isHolo = isHoloRarity(card.rarity)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16, overflow: 'hidden', userSelect: 'none',
      transform: pressed ? 'scale(1.04)' : 'scale(1.0)',
      transition: SPRING,
      boxShadow: pressed ? '0 20px 48px rgba(0,0,0,0.60)' : '0 4px 16px rgba(0,0,0,0.25)',
    }}>

      {/* Artwork */}
      <div
        style={{ position: 'relative', width: '100%', paddingTop: '139%', cursor: 'pointer' }}
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}>
        <CardArtwork types={card.types} imageUrl={card.images.small} imageAlt={card.name} isHolo={isHolo} />
        {inCollection && (
          <div style={{ position: 'absolute', top: 7, right: 7, zIndex: 2 }}>
            <StatusPill status="owned" />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '8px 10px 0' }}>
        <div style={{ minHeight: 19, marginBottom: 5 }}>
          <RarityPill rarity={card.rarity} />
        </div>
        <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {card.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, overflow: 'hidden' }}>
          <TypeBadge type={card.types?.[0]} size={6} />
          <span style={{ fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {card.set.name}{card.number ? ` · #${card.number}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1, color: price != null ? 'var(--gold)' : 'var(--text3)' }}>
            {price != null ? formatPrice(price, true) : '—'}
          </span>
          {card.tcgplayer?.url && (
            <a
              href={card.tcgplayer.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)', textDecoration: 'none', padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', lineHeight: 1.4, whiteSpace: 'nowrap' }}>
              ↗ TCG
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5, padding: '8px 10px 10px' }}>
        <TileBtn
          label={inCollection ? '✓ Owned' : '+ Portfolio'}
          color="var(--emerald)" bg="rgba(69,219,141,0.10)"
          onClick={e => { e.stopPropagation(); onAddToPortfolio?.() }}
          disabled={inCollection}
        />
        <TileBtn
          label={inWishlist ? '♥ Saved' : '♡ Wish'}
          color="var(--violet)" bg="rgba(156,114,250,0.10)"
          onClick={e => { e.stopPropagation(); onAddToWishlist?.() }}
          disabled={inWishlist}
        />
      </div>
    </div>
  )
}
