'use client'
import { useState, useRef, memo } from 'react'
import { StarIcon, SparkleIcon, CheckIcon } from '@/components/ui/Icons'
import { formatPrice, tcgSearchUrl } from '@/lib/utils'
import { CONDITION_MULTIPLIERS } from '@/types'
import type { PokemonCard, TCGCard } from '@/types'

function LangBadge({ lang }: { lang: 'JP' | 'CN' }) {
  return (
    <span style={{
      fontSize: 7, fontWeight: 900, letterSpacing: '0.05em', color: '#fff',
      background: lang === 'JP' ? '#E53E3E' : '#C05621',
      padding: '1.5px 4px', borderRadius: 3, lineHeight: 1.4, flexShrink: 0,
    }}>
      {lang}
    </span>
  )
}

function FavShowcaseStar({ card, onFavorite, onShowcase }: {
  card: PokemonCard; onFavorite?: () => void; onShowcase?: () => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  if (!onFavorite && !onShowcase) return null

  const isFav = card.is_favorite
  const isShow = card.is_showcase

  return (
    <span
      onPointerDown={e => {
        e.stopPropagation()
        longPressed.current = false
        if (onShowcase) {
          timerRef.current = setTimeout(() => {
            longPressed.current = true
            onShowcase()
          }, 500)
        }
      }}
      onPointerUp={e => {
        e.stopPropagation()
        if (timerRef.current) clearTimeout(timerRef.current)
        if (!longPressed.current && onFavorite) onFavorite()
      }}
      onPointerLeave={() => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }}
      onClick={e => e.stopPropagation()}
      style={{
        fontSize: 13, lineHeight: 1, cursor: 'pointer', userSelect: 'none', flexShrink: 0,
        color: isFav ? 'var(--gold)' : isShow ? '#fff' : 'rgba(255,255,255,0.25)',
        textShadow: isShow ? '0 0 8px rgba(255,255,255,0.9), 0 0 16px rgba(255,255,255,0.5)' : undefined,
      }}>
      {isFav ? <StarIcon size={13} filled /> : isShow ? <SparkleIcon size={13} /> : <StarIcon size={13} />}
    </span>
  )
}
import { CardArtwork, TypeBadge } from './CardArtwork'
import { TcgLink } from '@/components/ui/TcgLink'

// ─── Rarity helpers (exported for CardDetailModal) ────────────────────────────

export function rarityColor(rarity?: string | null): string {
  if (!rarity) return 'rgba(255,255,255,0.25)'
  const r = rarity.toLowerCase()
  if (r.includes('special illustration')) return '#FFC845'
  if (r.includes('hyper rare') || r.includes('rainbow')) return '#73D9D9'
  if (r.includes('shiny ultra'))          return '#73D9D9'
  if (r.includes('illustration rare'))    return '#D166F2'
  if (r.includes('secret'))              return '#5DA9FF'
  if (r.includes('ultra rare') || r.includes('ace spec')) return '#FF9E2E'
  if (r.includes('vmax') || r.includes('vstar') || r.includes('rare ultra')) return '#FF9E2E'
  if (r.includes('double rare'))          return '#FF9E2E'
  if (r.includes('shiny rare'))           return '#73D9D9'
  if (r.includes('trainer gallery') || r.includes('amazing')) return '#9C72FA'
  if (r.includes('holo'))                return 'rgba(200,210,255,0.75)'
  if (r.includes('rare'))                return 'rgba(255,255,255,0.55)'
  if (r.includes('uncommon'))            return 'rgba(255,255,255,0.35)'
  return 'rgba(255,255,255,0.22)'
}

export function shortRarity(rarity?: string | null): string {
  if (!rarity) return 'Common'
  const r = rarity.toLowerCase()
  if (r.includes('special illustration')) return 'Spec Illus Rare'
  if (r.includes('illustration rare'))    return 'Illus Rare'
  if (r.includes('hyper rare'))           return 'Hyper Rare'
  if (r.includes('rainbow'))              return 'Rainbow Rare'
  if (r.includes('shiny ultra'))          return 'Shiny Ultra'
  if (r.includes('shiny rare'))           return 'Shiny Rare'
  if (r.includes('secret'))              return 'Secret Rare'
  if (r.includes('ultra rare'))           return 'Ultra Rare'
  if (r.includes('ace spec'))             return 'ACE SPEC'
  if (r.includes('rare ultra'))           return 'Ultra Rare'
  if (r.includes('double rare'))          return 'Double Rare'
  if (r.includes('vmax'))                 return 'VMAX'
  if (r.includes('vstar'))               return 'VSTAR'
  if (r.includes('trainer gallery'))      return 'Trainer Gallery'
  if (r.includes('amazing'))             return 'Amazing Rare'
  if (r.includes('holo'))                return 'Holo Rare'
  if (r.includes('promo'))               return 'Promo'
  if (r.includes('rare'))                return 'Rare'
  if (r.includes('uncommon'))            return 'Uncommon'
  return 'Common'
}

function isHoloRarity(rarity?: string | null): boolean {
  if (!rarity) return false
  const r = rarity.toLowerCase()
  return r.includes('holo') || r.includes('ultra') || r.includes('secret') ||
    r.includes('special') || r.includes('vmax') || r.includes('vstar') ||
    r.includes('double rare') || r.includes('rare ultra') ||
    r.includes('shiny') || r.includes('ace spec') ||
    r.includes('illustration') || r.includes('hyper') || r.includes('rainbow')
}

function getBrowsePrice(card: TCGCard): number | undefined {
  const p = card.tcgplayer?.prices
  if (!p) return undefined
  return p.holofoil?.market ?? p.normal?.market ?? p.reverseHolofoil?.market ?? p['1stEditionHolofoil']?.market
}

const SPRING = 'transform 0.30s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.30s ease'

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
      {shortRarity(rarity)}
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
        flex: 1, padding: '5px 0', borderRadius: 8,
        fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
        background: disabled ? 'var(--btn-disabled)' : bg,
        color: disabled ? '#9ca3af' : color,
        border: 'none', cursor: disabled ? 'default' : 'pointer',
      }}>
      {label}
    </button>
  )
}

// ─── Portfolio tile (portrait) ────────────────────────────────────────────────

interface PortfolioTileProps {
  card: PokemonCard
  onClick?: () => void
  onLongPress?: () => void
  onSell?: (e: React.MouseEvent) => void
  onGift?: (e: React.MouseEvent) => void
  onAddToPortfolio?: () => void
  onRemove?: () => void
  onFavorite?: () => void
  onShowcase?: () => void
  inCollection?: boolean
  selected?: boolean
}

export function PortfolioTile({ card, onClick, onLongPress, onSell, onGift, onAddToPortfolio, onRemove, onFavorite, onShowcase, inCollection, selected }: PortfolioTileProps) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isWishlist = card.status === 'wishlist'
  const isHolo = isHoloRarity(card.rarity)
  const adjPrice = card.market_price != null
    ? card.market_price * (CONDITION_MULTIPLIERS[card.condition] ?? 1)
    : null
  const profitPct = adjPrice != null && card.price_paid != null && card.price_paid > 0
    ? ((adjPrice - card.price_paid) / card.price_paid) * 100
    : null
  const delta = card.price_yesterday && card.market_price
    ? ((card.market_price - card.price_yesterday) / card.price_yesterday) * 100
    : null
  const showSellGift = !isWishlist && !card.is_favorite && !card.is_showcase

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
    ? '0 6px 18px rgba(0,0,0,0.50)'
    : hovered
    ? '0 28px 56px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.07)'
    : card.is_favorite
    ? '0 0 0 1.5px rgba(255,200,69,0.40), 0 8px 28px rgba(0,0,0,0.35)'
    : '0 4px 16px rgba(0,0,0,0.25)'

  const transform = pressed
    ? 'scale(0.95) translateY(1px)'
    : hovered
    ? 'scale(1.05) translateY(-5px)'
    : 'scale(1.0)'

  return (
    <div
      onClick={() => { setHovered(false); setPressed(false); onClick?.() }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={() => { up(); setHovered(false) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={card.is_showcase ? 'showcase-border' : ''}
      style={{
        background: 'var(--surface)', border: `1px solid ${borderColor}`,
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer', userSelect: 'none',
        transform, transition: SPRING, boxShadow: shadow,
      }}>

      {/* ── Artwork ── */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '139%' }}>
        <CardArtwork types={card.types} imageUrl={card.image_sm ?? undefined} imageAlt={card.name} isHolo={isHolo} />

        {/* TL: selected checkmark only */}
        {selected && (
          <div style={{ position: 'absolute', top: 7, left: 7, zIndex: 2 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0D0F1A' }}><CheckIcon size={12} /></div>
          </div>
        )}

        {/* TR: status */}
        <div style={{ position: 'absolute', top: 7, right: 7, zIndex: 2 }}>
          <StatusPill status={card.status} />
        </div>

        {/* BR: 24h delta */}
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

      {/* ── Info ── */}
      <div style={{ padding: '8px 10px 0' }}>
        {/* Rarity row: pill left, lang badge + star right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 19, marginBottom: 5, gap: 4 }}>
          <RarityPill rarity={card.rarity} />
          {card.status !== 'wishlist' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {(card.language === 'JP' || card.language === 'CN') && (
                <LangBadge lang={card.language} />
              )}
              <FavShowcaseStar card={card} onFavorite={onFavorite} onShowcase={onShowcase} />
            </div>
          )}
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
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1, color: 'var(--gold)' }}>
            {card.market_price != null ? formatPrice(card.market_price, true) : '—'}
          </span>
          {!isWishlist && card.price_paid != null && (
            <div style={{ textAlign: 'right', lineHeight: 1.25, flexShrink: 0 }}>
              {card.market_price != null && profitPct != null && (
                <span style={{
                  fontSize: 9, fontWeight: 800, display: 'block',
                  color: profitPct >= 0 ? 'var(--emerald)' : 'var(--crimson)',
                }}>
                  {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(0)}%
                </span>
              )}
              <span style={{ fontSize: 8, color: 'var(--text3)', display: 'block' }}>
                pd {formatPrice(card.price_paid, true)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      {isWishlist ? (
        <div style={{ display: 'flex', gap: 5, padding: '8px 10px 10px' }}>
          <TileBtn
            label={inCollection ? '✓ In CATCHM' : '+ CATCHM'}
            color="#fff" bg="var(--btn-catchm)"
            onClick={e => { e.stopPropagation(); onAddToPortfolio?.() }}
            disabled={inCollection}
          />
          <TileBtn
            label="✕ Remove"
            color="#fff" bg="var(--btn-remove)"
            onClick={e => { e.stopPropagation(); onRemove?.() }}
          />
        </div>
      ) : showSellGift ? (
        <div style={{ display: 'flex', gap: 5, padding: '8px 10px 10px' }}>
          <TileBtn label="SELL" color="#fff" bg="var(--btn-sell)" onClick={e => { e.stopPropagation(); onSell?.(e) }} />
          <TileBtn label="GIFT" color="#fff" bg="var(--btn-wishlist)" onClick={e => { e.stopPropagation(); onGift?.(e) }} />
        </div>
      ) : (
        <div style={{ height: 10 }} />
      )}
    </div>
  )
}

// ─── Browse tile (portrait) ───────────────────────────────────────────────────

interface BrowseTileProps {
  card: TCGCard
  onClick?: (card: TCGCard) => void
  onAddToPortfolio?: (card: TCGCard) => void
  onAddToWishlist?: (card: TCGCard) => void
  inCollection?: boolean
  inWishlist?: boolean
}

function BrowseTileInner({ card, onClick, onAddToPortfolio, onAddToWishlist, inCollection, inWishlist }: BrowseTileProps) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const price = getBrowsePrice(card)
  const isHolo = isHoloRarity(card.rarity)

  const transform = pressed
    ? 'scale(0.95) translateY(1px)'
    : hovered ? 'scale(1.05) translateY(-5px)' : 'scale(1.0)'
  const shadow = pressed
    ? '0 6px 18px rgba(0,0,0,0.50)'
    : hovered ? '0 28px 56px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.07)'
    : '0 4px 16px rgba(0,0,0,0.25)'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, overflow: 'hidden', userSelect: 'none',
        transform, transition: SPRING, boxShadow: shadow,
      }}>

      {/* Artwork */}
      <div
        style={{ position: 'relative', width: '100%', paddingTop: '139%', cursor: 'pointer' }}
        onClick={() => { setHovered(false); setPressed(false); onClick?.(card) }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}>
        <CardArtwork types={card.types} imageUrl={card.images.small} imageAlt={card.name} isHolo={isHolo} />
        {inCollection && (
          <div style={{ position: 'absolute', top: 7, right: 7, zIndex: 2 }}>
            <StatusPill status="owned" />
          </div>
        )}
        {inWishlist && !inCollection && (
          <div style={{ position: 'absolute', top: 7, right: 7, zIndex: 2 }}>
            <StatusPill status="wishlist" />
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
        <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1, color: price != null ? 'var(--gold)' : 'var(--text3)' }}>
            {price != null ? formatPrice(price, true) : '—'}
          </span>
      </div>

      {/* Actions — heart | TCG | +CATCHM */}
      <div style={{ display: 'flex', gap: 5, padding: '8px 10px 10px', alignItems: 'center' }}>

        {/* Wishlist heart */}
        <button
          onClick={e => { e.stopPropagation(); onAddToWishlist?.(card) }}
          style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: inWishlist ? 'var(--btn-wishlist)' : 'transparent',
            color: inWishlist ? '#fff' : 'rgba(255,255,255,0.30)',
            border: inWishlist ? 'none' : '1px solid rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
          <svg width={13} height={13} viewBox="0 0 24 24"
            fill={inWishlist ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>

        {/* TCG external link — direct search URL, no redirect hop */}
        <TcgLink
          url={tcgSearchUrl(card.name, card.set?.name)}
          style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'var(--btn-info)',
            border: 'none',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </TcgLink>

        {/* + CATCHM (fills remaining space) */}
        <button
          onClick={e => { e.stopPropagation(); onAddToPortfolio?.(card) }}
          style={{
            flex: 1, height: 30, borderRadius: 8,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.03em',
            background: 'var(--btn-catchm)',
            color: '#fff',
            border: 'none', cursor: 'pointer',
          }}>
          {inCollection ? '+ More' : '+ CATCHM'}
        </button>
      </div>
    </div>
  )
}

// Memoized: only re-renders when card id or collection status changes,
// not when parent re-renders due to loading more pages.
export const BrowseTile = memo(BrowseTileInner, (prev, next) =>
  prev.card.id === next.card.id &&
  prev.inCollection === next.inCollection &&
  prev.inWishlist === next.inWishlist
)
