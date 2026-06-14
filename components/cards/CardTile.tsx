'use client'
import { useState, useRef } from 'react'
import { formatPrice } from '@/lib/utils'
import type { PokemonCard, TCGCard } from '@/types'
import { CardArtwork, TypeBadge } from './CardArtwork'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isHoloRarity(rarity?: string | null): boolean {
  if (!rarity) return false
  const r = rarity.toLowerCase()
  return (
    r.includes('holo') || r.includes('ultra') || r.includes('secret') ||
    r.includes('special') || r.includes('vmax') || r.includes('vstar') ||
    r.includes(' ex') || r.includes(' gx')
  )
}

function getRarityBadge(rarity?: string | null): { label: string; color: string } | null {
  if (!rarity) return null
  const r = rarity.toLowerCase()
  if (r.includes('special illustration')) return { label: 'SIR',    color: '#FFC845' }
  if (r.includes('illustration rare'))    return { label: 'IR',     color: '#D166F2' }
  if (r.includes('hyper rare') || r.includes('rainbow')) return { label: 'Hyper', color: '#73D9D9' }
  if (r.includes('secret'))  return { label: 'Secret', color: '#5DA9FF' }
  if (r.includes('vmax'))    return { label: 'VMAX',   color: '#FF9E2E' }
  if (r.includes('vstar'))   return { label: 'VSTAR',  color: '#FF9E2E' }
  if (r.includes('amazing')) return { label: 'Amazing',color: '#73D9D9' }
  if (r.includes('holo ex') || (r.includes(' ex') && !r.includes('vmax')))
    return { label: 'ex', color: '#FF9E2E' }
  if (r.includes('holo gx') || r.includes(' gx'))
    return { label: 'GX', color: '#FF9E2E' }
  if (r.includes('ultra rare')) return { label: 'Ultra', color: '#FF9E2E' }
  if (r.includes('holo v') && !r.includes('vmax') && !r.includes('vstar'))
    return { label: 'V', color: '#FF9E2E' }
  if (r.includes('holo'))  return { label: 'Holo', color: 'rgba(200,210,255,0.80)' }
  if (r === 'rare')        return { label: 'Rare', color: 'rgba(255,255,255,0.50)' }
  return null
}

function getBrowsePrice(card: TCGCard): number | undefined {
  const p = card.tcgplayer?.prices
  if (!p) return undefined
  return p.holofoil?.market ?? p.normal?.market ?? p.reverseHolofoil?.market ?? p['1stEditionHolofoil']?.market
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const MAP: Record<string, { label: string; color: string }> = {
    owned:    { label: 'OWNED',    color: '#45DB8D' },
    wishlist: { label: 'WISH',     color: '#9C72FA' },
    for_sale: { label: 'FOR SALE', color: '#FF9E2E' },
  }
  const cfg = MAP[status] ?? MAP.owned
  return (
    <span style={{
      fontSize: 9, fontWeight: 900, letterSpacing: '0.05em',
      color: '#fff', padding: '3px 7px', borderRadius: 100,
      background: cfg.color, boxShadow: `0 2px 8px ${cfg.color}99`,
      lineHeight: 1, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function RarityBadge({ rarity }: { rarity?: string | null }) {
  const badge = getRarityBadge(rarity)
  if (!badge) return null
  return (
    <span style={{
      fontSize: 8, fontWeight: 900, letterSpacing: '0.08em',
      color: badge.color, background: `${badge.color}18`,
      border: `1px solid ${badge.color}50`, borderRadius: 5,
      padding: '2px 5px', backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)', lineHeight: 1.4,
    }}>
      {badge.label}
    </span>
  )
}

// Spring press — matches VAULT scaleEffect(isPressed ? 1.04 : 1.0)
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

  const nmMarket = card.market_price
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

  // Border & shadow logic
  const containerBorder = selected
    ? 'rgba(255,200,69,0.60)'
    : card.is_favorite
    ? 'rgba(255,200,69,0.30)'
    : 'rgba(255,255,255,0.08)'

  const baseShadow = pressed
    ? '0 22px 48px rgba(0,0,0,0.55)'
    : card.is_favorite
    ? '0 0 24px rgba(255,200,69,0.14), 0 8px 24px rgba(0,0,0,0.35)'
    : '0 6px 20px rgba(0,0,0,0.30)'

  return (
    <div
      onClick={onClick}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      className={card.is_showcase ? 'showcase-border' : ''}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${containerBorder}`,
        borderRadius: 18,
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
        transform: pressed ? 'scale(1.04)' : 'scale(1.0)',
        transition: SPRING,
        boxShadow: baseShadow,
      }}>

      {/* ── Artwork ── */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '139%' }}>
        <CardArtwork types={card.types} imageUrl={card.image_sm ?? undefined} imageAlt={card.name} isHolo={isHolo} />

        {/* TL: holo ✨, fav ★, or showcase ◈ */}
        {(isHolo || card.is_favorite || card.is_showcase) && (
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, lineHeight: 1 }}>
            {card.is_showcase
              ? <span style={{ fontSize: 13, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))' }}>◈</span>
              : isHolo
              ? <span style={{ fontSize: 13, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }}>✨</span>
              : <span style={{ fontSize: 14, color: 'var(--gold)', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))' }}>★</span>
            }
          </div>
        )}

        {/* TR: status pill */}
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
          <StatusPill status={card.status} />
        </div>

        {/* BL: rarity badge */}
        <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 2 }}>
          <RarityBadge rarity={card.rarity} />
        </div>

        {/* BR: JP badge, or selection ✓ */}
        <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 2 }}>
          {selected ? (
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: '#0D0F1A', fontWeight: 900,
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}>✓</div>
          ) : isJP ? (
            <span style={{
              fontSize: 8, fontWeight: 900, letterSpacing: '0.04em',
              color: '#fff', background: '#E53E3E',
              padding: '2px 5px', borderRadius: 4, lineHeight: 1.4,
            }}>JP</span>
          ) : null}
        </div>
      </div>

      {/* ── Info ── */}
      <div style={{ padding: '10px 12px 8px' }}>
        <p style={{
          margin: '0 0 3px', fontSize: 14, fontWeight: 700, lineHeight: 1.25,
          color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {card.name}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 7,
          fontSize: 11, color: 'var(--text3)', overflow: 'hidden',
        }}>
          <TypeBadge type={card.types?.[0]} size={7} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {card.set_name}{card.set_number ? ` · #${card.set_number}` : ''}
          </span>
        </div>

        {/* Price + delta */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 19, fontWeight: 900, lineHeight: 1, color: 'var(--text)' }}>
            {nmMarket != null ? formatPrice(nmMarket, true) : '—'}
          </span>
          {delta != null && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: delta >= 0 ? 'var(--emerald)' : 'var(--crimson)',
            }}>
              {delta >= 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* ── Quick actions (hidden if fav or showcase) ── */}
      {showActions && (
        <div style={{
          display: 'flex', gap: 4,
          padding: '6px 10px 10px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          <button
            onClick={e => { e.stopPropagation(); onSell?.(e) }}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 7,
              fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
              background: 'rgba(242,69,96,0.10)', color: 'var(--crimson)',
              border: 'none', cursor: 'pointer',
            }}>
            SELL
          </button>
          <button
            onClick={e => { e.stopPropagation(); onGift?.(e) }}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 7,
              fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
              background: 'rgba(93,169,255,0.10)', color: 'var(--sky)',
              border: 'none', cursor: 'pointer',
            }}>
            GIFT
          </button>
          {card.tcgplayer_url && (
            <a
              href={card.tcgplayer_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 7,
                fontSize: 10, fontWeight: 800,
                background: 'rgba(255,255,255,0.05)', color: 'var(--text3)',
                textDecoration: 'none', textAlign: 'center', display: 'block',
              }}>
              ↗ TCG
            </a>
          )}
        </div>
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
      background: 'var(--surface)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 18, overflow: 'hidden', userSelect: 'none',
      transform: pressed ? 'scale(1.04)' : 'scale(1.0)',
      transition: SPRING,
      boxShadow: pressed ? '0 22px 48px rgba(0,0,0,0.55)' : '0 6px 20px rgba(0,0,0,0.28)',
    }}>

      {/* Artwork */}
      <div
        style={{ position: 'relative', width: '100%', paddingTop: '139%', cursor: 'pointer' }}
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}>
        <CardArtwork types={card.types} imageUrl={card.images.small} imageAlt={card.name} isHolo={isHolo} />
        {isHolo && (
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
            <span style={{ fontSize: 13, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }}>✨</span>
          </div>
        )}
        {inCollection && (
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
            <StatusPill status="owned" />
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 2 }}>
          <RarityBadge rarity={card.rarity} />
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 8px' }}>
        <p style={{
          margin: '0 0 3px', fontSize: 14, fontWeight: 700, lineHeight: 1.25,
          color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {card.name}
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: price != null ? 7 : 0,
          fontSize: 11, color: 'var(--text3)', overflow: 'hidden',
        }}>
          <TypeBadge type={card.types?.[0]} size={7} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {card.set.name}{card.number ? ` · #${card.number}` : ''}
          </span>
        </div>
        {price != null && (
          <span style={{ fontSize: 19, fontWeight: 900, lineHeight: 1, color: 'var(--text)', display: 'block' }}>
            {formatPrice(price, true)}
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 10px 10px' }}>
        <button
          onClick={e => { e.stopPropagation(); onAddToPortfolio?.() }}
          disabled={inCollection}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 10, fontSize: 11, fontWeight: 700,
            background: inCollection ? 'rgba(69,219,141,0.07)' : 'rgba(69,219,141,0.13)',
            color: inCollection ? 'rgba(69,219,141,0.45)' : 'var(--emerald)',
            border: 'none', cursor: inCollection ? 'default' : 'pointer',
          }}>
          {inCollection ? '✓ Owned' : '+ Portfolio'}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onAddToWishlist?.() }}
          disabled={inWishlist}
          style={{
            padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: inWishlist ? 'rgba(156,114,250,0.07)' : 'rgba(156,114,250,0.13)',
            color: inWishlist ? 'rgba(156,114,250,0.45)' : 'var(--violet)',
            border: 'none', cursor: inWishlist ? 'default' : 'pointer',
          }}>
          {inWishlist ? '♥' : '♡'}
        </button>
      </div>
    </div>
  )
}
