'use client'
import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Sparkline } from '@/components/ui/Sparkline'
import { CardArtwork } from '@/components/cards/CardArtwork'
import { TcgLink } from '@/components/ui/TcgLink'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice, formatDate, generatePriceHistory, tcgSearchUrl } from '@/lib/utils'
import { conditionAdjustedValue, CONDITION_ORDER, CONDITION_LABELS, CONDITION_MULTIPLIERS } from '@/types'
import { rarityColor, shortRarity } from '@/components/cards/CardTile'
import type { PokemonCard } from '@/types'

function isHoloRarity(rarity?: string | null): boolean {
  if (!rarity) return false
  const r = rarity.toLowerCase()
  return r.includes('holo') || r.includes('ultra') || r.includes('secret') ||
    r.includes('special') || r.includes('vmax') || r.includes('vstar')
}

function formatSetDate(raw?: string | null): string {
  if (!raw) return ''
  const d = new Date(raw.replace(/\//g, '-'))
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface CardDetailModalProps {
  card: PokemonCard | null
  onClose: () => void
  initialView?: 'detail' | 'sell' | 'gift'
  view?: 'portfolio' | 'wishlist'
}

export function CardDetailModal({ card, onClose, initialView = 'detail', view = 'portfolio' }: CardDetailModalProps) {
  const { updateCard, setFavorite, setShowcase, removeCard } = useCollection()
  const [condition, setCondition] = useState<number>(
    card ? CONDITION_ORDER.indexOf(card.condition) : 0
  )
  const [showSell, setShowSell] = useState(initialView === 'sell')
  const [showGift, setShowGift] = useState(initialView === 'gift')
  const [isEditing, setIsEditing] = useState(false)
  const [editPaid, setEditPaid] = useState('')
  const [editFrom, setEditFrom] = useState('')
  const [editingTarget, setEditingTarget] = useState(false)
  const [editTarget, setEditTarget] = useState('')

  const priceHistory = useMemo(
    () => card?.market_price ? generatePriceHistory(card.market_price) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card?.id]
  )

  if (!card) return null

  const currentCondition = CONDITION_ORDER[condition]
  const adjValue = (card.market_price ?? 0) * CONDITION_MULTIPLIERS[currentCondition]
  const profit = card.price_paid != null ? adjValue - card.price_paid : null
  const profitPct = profit != null && card.price_paid ? (profit / card.price_paid) * 100 : null
  const locked = card.is_favorite || card.is_showcase

  const wlDelta = view === 'wishlist' && card.market_price != null && card.market_at_buy != null
    ? ((card.market_price - card.market_at_buy) / card.market_at_buy) * 100
    : null
  const atTarget = card.target_price != null && card.market_price != null
    && card.market_price <= card.target_price

  const setRef = [
    card.set_number
      ? `#${card.set_number}${card.set_printed_total ? `/${card.set_printed_total}` : ''}`
      : null,
    card.set_release_date ? formatSetDate(card.set_release_date) : null,
  ].filter(Boolean).join(' · ')

  const rc = rarityColor(card.rarity)
  const isRcAccent = !rc.startsWith('rgba')

  const sparkColor = view === 'wishlist'
    ? (atTarget ? 'var(--emerald)' : 'var(--violet)')
    : profit == null ? 'var(--emerald)' : profit >= 0 ? 'var(--emerald)' : 'var(--crimson)'

  async function handleConditionChange(idx: number) {
    setCondition(idx)
    await updateCard(card!.id, { condition: CONDITION_ORDER[idx] })
  }
  function handleShowcase() { setShowcase(card!.id) }
  function handleToWatch() { updateCard(card!.id, { status: 'wishlist' }); onClose() }
  function handleMoveToPortfolio() {
    updateCard(card!.id, { status: 'owned', condition: 'NM', price_paid: card!.target_price ?? card!.market_price, market_at_buy: card!.market_price })
    onClose()
  }
  function handleRemove() { removeCard(card!.id); onClose() }
  function startEditTarget() {
    setEditTarget(card!.target_price != null ? String(card!.target_price) : '')
    setEditingTarget(true)
  }
  function saveTarget() {
    updateCard(card!.id, { target_price: editTarget ? parseFloat(editTarget) : undefined })
    setEditingTarget(false)
  }
  function startEdit() {
    setEditPaid(card!.price_paid != null ? String(card!.price_paid) : '')
    setEditFrom(card!.bought_from ?? '')
    setIsEditing(true)
  }
  function saveEdit() {
    updateCard(card!.id, {
      price_paid: editPaid ? parseFloat(editPaid) : undefined,
      bought_from: editFrom.trim() || undefined,
    })
    setIsEditing(false)
  }

  return (
    <>
      <Modal open={!!card && !showSell && !showGift} onClose={onClose} maxWidth={520}>
        <div style={{ position: 'relative' }}>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: -4, right: -4,
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(255,255,255,0.07)', border: 'none',
              color: 'var(--text3)', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s, color 0.12s', zIndex: 2,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text3)' }}>
            ✕
          </button>

          {/* ── TOP: card image + identity ── */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>

            {/* Card art */}
            <div
              className={card.is_showcase ? 'showcase-border' : ''}
              style={{
                width: 120, flexShrink: 0,
                borderRadius: 10, overflow: 'hidden',
                position: 'relative', paddingTop: `${120 * 1.39}px`,
                boxShadow: card.is_favorite && !card.is_showcase
                  ? '0 0 0 2px rgba(255,200,69,0.55), 0 0 20px rgba(255,200,69,0.20), 0 6px 24px rgba(0,0,0,0.50)'
                  : '0 6px 24px rgba(0,0,0,0.50)',
              }}>
              <CardArtwork
                types={card.types}
                imageUrl={card.image_lg ?? card.image_sm ?? undefined}
                imageAlt={card.name}
                isHolo={isHoloRarity(card.rarity)}
              />
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <h2 style={{ margin: '0 0 5px', fontSize: 16, fontWeight: 800, lineHeight: 1.2, color: 'var(--text)', paddingRight: 32 }}>
                {card.name}
                {card.language === 'JP' && (
                  <span style={{ marginLeft: 7, fontSize: 8, fontWeight: 900, background: '#E53E3E', color: '#fff', padding: '2px 5px', borderRadius: 4, verticalAlign: 'middle' }}>
                    JP
                  </span>
                )}
              </h2>
              {card.rarity && (
                <span style={{
                  display: 'inline-block', marginBottom: 5,
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
                  color: rc,
                  background: isRcAccent ? `${rc}16` : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${isRcAccent ? `${rc}30` : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 100, padding: '2px 8px', lineHeight: 1.5,
                }}>
                  {shortRarity(card.rarity)}
                </span>
              )}
              <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--text3)' }}>
                {card.set_name}{setRef ? ` · ${setRef}` : ''}
              </p>
              {card.artist && (
                <p style={{ margin: '0 0 10px', fontSize: 10, color: 'var(--text3)' }}>
                  Illus. {card.artist}
                </p>
              )}

              {/* Condition (portfolio) or Target at-a-glance (wishlist) */}
              {view === 'portfolio' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                      Condition
                    </span>
                    {card.market_price && (
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                        {CONDITION_LABELS[currentCondition]} · <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatPrice(adjValue)}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {CONDITION_ORDER.map((c, i) => (
                      <button key={c} onClick={() => handleConditionChange(i)} style={{
                        flex: 1, padding: '5px 0', borderRadius: 6,
                        fontSize: 10, fontWeight: 700,
                        border: `1px solid ${i === condition ? 'rgba(255,200,69,0.50)' : 'var(--border)'}`,
                        background: i === condition ? 'rgba(255,200,69,0.12)' : 'transparent',
                        color: i === condition ? 'var(--gold)' : 'var(--text3)',
                        cursor: 'pointer', transition: 'all 0.12s ease',
                      }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {view === 'wishlist' && card.target_price != null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 7,
                  background: atTarget ? 'rgba(69,219,141,0.10)' : 'rgba(156,114,250,0.08)',
                  border: `1px solid ${atTarget ? 'rgba(69,219,141,0.22)' : 'rgba(156,114,250,0.20)'}`,
                }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: atTarget ? 'var(--emerald)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Target
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: atTarget ? 'var(--emerald)' : 'var(--violet)' }}>
                    {formatPrice(card.target_price)}
                  </span>
                  {atTarget && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--emerald)' }}>✓ AT TARGET!</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── DIVIDER ── */}
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

          {/* ── MARKET VALUE ── */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Market Value
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: view === 'wishlist' && atTarget ? 'var(--emerald)' : 'var(--gold)', lineHeight: 1 }}>
                {card.market_price != null ? formatPrice(card.market_price) : '—'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>NM</span>
              {view === 'wishlist' && atTarget && (
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--emerald)', background: 'rgba(69,219,141,0.12)', border: '1px solid rgba(69,219,141,0.25)', padding: '2px 8px', borderRadius: 100 }}>
                  AT TARGET!
                </span>
              )}
            </div>

            {/* NM Low / Mid / High row */}
            {(card.market_low != null || card.market_mid != null || card.market_high != null || card.market_direct_low != null) && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {([
                  { label: 'NM Low',  val: card.market_low },
                  { label: 'Mid',     val: card.market_mid },
                  { label: 'High',    val: card.market_high },
                  { label: 'Direct',  val: card.market_direct_low },
                ] as { label: string; val: number | null | undefined }[]).filter(x => x.val != null).map(({ label, val }) => (
                  <div key={label}>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
                    <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{formatPrice(val!)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 30-DAY PRICE HISTORY ── */}
          {priceHistory.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                  30-Day Price
                </span>
                <span style={{ fontSize: 9, color: 'var(--text3)' }}>
                  {formatPrice(Math.min(...priceHistory))} – {formatPrice(Math.max(...priceHistory))}
                </span>
              </div>
              <Sparkline points={priceHistory} color={sparkColor} height={38} />
            </div>
          )}

          {/* ── CARD LORE ── */}
          {card.flavor_text && (
            <p style={{
              margin: '0 0 16px',
              fontSize: 11.5, lineHeight: 1.65,
              color: 'var(--text3)', fontStyle: 'italic',
              borderLeft: '2px solid var(--border2)', paddingLeft: 10,
            }}>
              "{card.flavor_text}"
            </p>
          )}

          {/* ── MY PURCHASE (portfolio) ── */}
          {view === 'portfolio' && (
            isEditing ? (
              <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: 'var(--s2)', border: '1px solid rgba(93,169,255,0.25)' }}>
                <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                  Edit Purchase
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Price Paid</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>$</span>
                      <input type="number" min="0" step="0.01" value={editPaid} onChange={e => setEditPaid(e.target.value)}
                        style={{ width: '100%', paddingLeft: 18, paddingRight: 8, paddingTop: 7, paddingBottom: 7, borderRadius: 7, fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>From</label>
                    <input type="text" placeholder="eBay, local…" value={editFrom} onChange={e => setEditFrom(e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', borderRadius: 7, fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveEdit} style={{ flex: 1, padding: '7px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'var(--sky)', color: '#0D0F1A', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setIsEditing(false)} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : card.price_paid != null && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                  My Purchase
                </p>
                {/* Single row */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: profit != null ? 8 : 0 }}>
                  <MiniStat label="Paid"       value={formatPrice(card.price_paid)} />
                  {card.market_at_buy != null && <MiniStat label="Mkt at Buy" value={formatPrice(card.market_at_buy)} />}
                  {card.bought_from   && <MiniStat label="From"       value={card.bought_from} />}
                  {card.date_added    && <MiniStat label="Date"        value={formatDate(card.date_added)} />}
                </div>
                {/* Gain/Loss banner */}
                {profit != null && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 7,
                    background: profit >= 0 ? 'rgba(69,219,141,0.10)' : 'rgba(242,69,96,0.10)',
                    border: `1px solid ${profit >= 0 ? 'rgba(69,219,141,0.22)' : 'rgba(242,69,96,0.22)'}`,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: profit >= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
                      {profit >= 0 ? '▲' : '▼'} {formatPrice(Math.abs(profit))} unrealized
                      {profitPct != null && (
                        <span style={{ fontWeight: 600, opacity: 0.75, marginLeft: 4 }}>
                          ({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )
          )}

          {/* ── WHEN ADDED (wishlist) ── */}
          {view === 'wishlist' && (card.market_at_buy != null || card.date_added) && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                When Added
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: wlDelta != null ? 8 : 0 }}>
                {card.market_at_buy != null && <MiniStat label="Market at Add" value={formatPrice(card.market_at_buy)} />}
                {card.date_added && <MiniStat label="Date Added" value={formatDate(card.date_added)} />}
              </div>
              {wlDelta != null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 7,
                  background: wlDelta <= 0 ? 'rgba(69,219,141,0.10)' : 'rgba(242,69,96,0.10)',
                  border: `1px solid ${wlDelta <= 0 ? 'rgba(69,219,141,0.22)' : 'rgba(242,69,96,0.22)'}`,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: wlDelta <= 0 ? 'var(--emerald)' : 'var(--crimson)' }}>
                    {wlDelta <= 0 ? '▼' : '▲'} {Math.abs(wlDelta).toFixed(1)}% since added
                    {wlDelta <= 0
                      ? <span style={{ fontWeight: 500, marginLeft: 4, opacity: 0.75 }}>(dropped — good!)</span>
                      : <span style={{ fontWeight: 500, marginLeft: 4, opacity: 0.75 }}>(rose)</span>
                    }
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── TARGET PRICE (wishlist) ── */}
          {view === 'wishlist' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>Target Price</span>
                {!editingTarget && (
                  <button onClick={startEditTarget} style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    {card.target_price ? 'Edit' : 'Set target'}
                  </button>
                )}
              </div>
              {editingTarget ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>$</span>
                    <input type="number" min="0" step="0.01" placeholder="0.00" value={editTarget}
                      onChange={e => setEditTarget(e.target.value)} autoFocus
                      style={{ width: '100%', paddingLeft: 20, paddingRight: 8, paddingTop: 7, paddingBottom: 7, borderRadius: 7, fontSize: 12, background: 'var(--bg)', border: '1px solid rgba(156,114,250,0.40)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <button onClick={saveTarget} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingTarget(false)} style={{ padding: '7px 10px', borderRadius: 7, fontSize: 11, background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}>×</button>
                </div>
              ) : card.target_price ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', borderRadius: 8,
                  background: atTarget ? 'rgba(69,219,141,0.10)' : 'rgba(156,114,250,0.08)',
                  border: `1px solid ${atTarget ? 'rgba(69,219,141,0.25)' : 'rgba(156,114,250,0.20)'}`,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: atTarget ? 'var(--emerald)' : 'var(--violet)' }}>
                    {formatPrice(card.target_price)}
                  </span>
                  <span style={{ fontSize: 10, color: atTarget ? 'var(--emerald)' : 'var(--text3)', fontWeight: 600 }}>
                    {atTarget
                      ? '✓ AT TARGET!'
                      : card.market_price
                      ? `↓ ${formatPrice(card.market_price - card.target_price)} above target`
                      : 'target'}
                  </span>
                </div>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>No target set — tap "Set target" to track when price drops.</p>
              )}
            </div>
          )}

          {/* ── ACTION BAR ── */}
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            {view === 'wishlist' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Primary: move to portfolio */}
                <button onClick={handleMoveToPortfolio} style={{
                  width: '100%', padding: '10px 0', borderRadius: 9, fontSize: 13, fontWeight: 700,
                  background: 'rgba(69,219,141,0.14)', color: 'var(--emerald)',
                  border: '1px solid rgba(69,219,141,0.25)', cursor: 'pointer',
                }}>
                  ✓ Mark as Owned
                </button>
                {/* Secondary: TCG + alerts + remove */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <TcgLink url={tcgSearchUrl(card.name, card.set_name)} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    color: 'var(--text3)', background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.10)', textDecoration: 'none',
                    textAlign: 'center', display: 'block',
                  }}>↗ TCGPlayer</TcgLink>
                  <button
                    onClick={() => updateCard(card.id, { alerts_enabled: !card.alerts_enabled })}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      background: card.alerts_enabled ? 'rgba(255,200,69,0.12)' : 'transparent',
                      color: card.alerts_enabled ? 'var(--gold)' : 'var(--text3)',
                      border: `1px solid ${card.alerts_enabled ? 'rgba(255,200,69,0.30)' : 'rgba(255,255,255,0.10)'}`,
                      cursor: 'pointer',
                    }}>
                    {card.alerts_enabled ? '🔔 Alerts On' : '🔕 Alerts Off'}
                  </button>
                  <button onClick={handleRemove} style={{
                    width: 36, borderRadius: 8, fontSize: 14, fontWeight: 700,
                    background: 'rgba(242,69,96,0.10)', color: 'var(--crimson)',
                    border: '1px solid rgba(242,69,96,0.20)', cursor: 'pointer',
                  }}>✕</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Row 1: Sell + Gift (locked cards skip this) */}
                {!locked && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowSell(true)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 12, fontWeight: 700,
                      background: 'rgba(242,69,96,0.12)', color: 'var(--crimson)',
                      border: '1px solid rgba(242,69,96,0.22)', cursor: 'pointer',
                    }}>SELL</button>
                    <button onClick={() => setShowGift(true)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 12, fontWeight: 700,
                      background: 'rgba(156,114,250,0.12)', color: 'var(--violet)',
                      border: '1px solid rgba(156,114,250,0.22)', cursor: 'pointer',
                    }}>GIFT</button>
                  </div>
                )}
                {/* Row 2: Toggles (left) + utilities/destructive (right) */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn
                      label={card.is_favorite ? '★ Fav' : '☆ Fav'}
                      color="var(--gold)" accentBg="rgba(255,200,69,0.10)"
                      onClick={() => setFavorite(card.id)} active={card.is_favorite}
                    />
                    <Btn
                      label="◈ Show"
                      color="var(--violet)" accentBg="rgba(156,114,250,0.10)"
                      onClick={handleShowcase} active={card.is_showcase}
                    />
                    <Btn label="Edit" onClick={startEdit} />
                    <Btn label="↗ TCG" href={tcgSearchUrl(card.name, card.set_name ?? '')} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn label="↩ Watch" onClick={handleToWatch} />
                    <Btn label="✕" color="var(--crimson)" onClick={handleRemove} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {showSell && (
        <SellModal card={card} giftMode={false}
          onClose={() => { setShowSell(false); onClose() }}
          onBack={() => setShowSell(false)} />
      )}
      {showGift && (
        <SellModal card={card} giftMode
          onClose={() => { setShowGift(false); onClose() }}
          onBack={() => setShowGift(false)} />
      )}
    </>
  )
}

// ─── Shared small components ──────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{value}</p>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
}

function Btn({ label, color = 'var(--text2)', accentBg, onClick, href, active, wide }: {
  label: string; color?: string; accentBg?: string
  onClick?: () => void; href?: string; active?: boolean; wide?: boolean
}) {
  const style: React.CSSProperties = {
    padding: wide ? '6px 18px' : '6px 10px',
    borderRadius: 7, fontSize: 11, fontWeight: 800, letterSpacing: '0.03em',
    color: active ? '#0D0F1A' : color,
    background: active ? color : (accentBg ?? 'transparent'),
    border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.10)'}`,
    cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
    whiteSpace: 'nowrap', transition: 'all 0.12s ease', lineHeight: 1.4,
  }
  if (href) return <TcgLink url={href} style={style}>{label}</TcgLink>
  return <button onClick={onClick} style={{ ...style, outline: 'none' }}>{label}</button>
}

// ─── Sell / Gift modal ────────────────────────────────────────────────────────

function SellModal({ card, giftMode, onClose, onBack }: {
  card: PokemonCard; giftMode: boolean; onClose: () => void; onBack: () => void
}) {
  const { sellCard } = useCollection()
  const defaultPrice = giftMode ? '' : formatPrice(conditionAdjustedValue(card)).replace('$', '')
  const [soldPrice, setSoldPrice] = useState(defaultPrice)
  const [fees, setFees] = useState('')
  const [shipping, setShipping] = useState('')
  const [saving, setSaving] = useState(false)

  const sp = giftMode ? 0 : (parseFloat(soldPrice) || 0)
  const f = parseFloat(fees) || 0
  const s = parseFloat(shipping) || 0
  const netProfit = sp - f - s - (card.price_paid ?? 0)

  async function confirm() {
    if (!giftMode && !sp) return
    setSaving(true)
    await sellCard(card, { sold_price: sp, fees: f, shipping: s, sale_type: giftMode ? 'gift' : 'sale' })
    setSaving(false)
    onClose()
  }

  return (
    <Modal open title={giftMode ? 'Log Gift' : 'Log Sale'} onClose={onClose} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← {card.name}
        </button>

        {giftMode && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(156,114,250,0.08)', border: '1px solid rgba(156,114,250,0.20)' }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--violet)' }}>
              Card will be removed from your portfolio and logged as gifted.
            </p>
          </div>
        )}

        {!giftMode && (
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
              Sale price *
            </label>
            <PriceInput value={soldPrice} onChange={setSoldPrice} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>Fees</label>
            <PriceInput value={fees} onChange={setFees} placeholder="0.00" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>Shipping</label>
            <PriceInput value={shipping} onChange={setShipping} placeholder="0.00" />
          </div>
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 10, textAlign: 'center', background: 'var(--s2)', border: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            {giftMode ? 'Total Cost' : 'Net Profit'}
          </p>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: netProfit >= 0 && !giftMode ? 'var(--emerald)' : 'var(--crimson)' }}>
            {giftMode
              ? `-${formatPrice(f + s + (card.price_paid ?? 0))}`
              : `${netProfit >= 0 ? '+' : ''}${formatPrice(netProfit)}`}
          </p>
          {card.price_paid != null && (
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text3)' }}>
              Paid {formatPrice(card.price_paid)}{!giftMode ? ` · Sold ${formatPrice(sp)}` : ''}
            </p>
          )}
        </div>

        <button onClick={confirm} disabled={saving || (!giftMode && !sp)} style={{
          width: '100%', padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: giftMode
            ? 'linear-gradient(135deg, var(--violet), var(--sky))'
            : 'linear-gradient(135deg, var(--amber), var(--crimson))',
          color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer',
          opacity: saving || (!giftMode && !sp) ? 0.55 : 1,
          transition: 'opacity 0.12s',
        }}>
          {saving ? 'Saving…' : giftMode ? 'Confirm Gift' : 'Confirm Sale'}
        </button>
      </div>
    </Modal>
  )
}

function PriceInput({ value, onChange, placeholder = '' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, fontSize: 12, color: 'var(--text3)' }}>$</span>
      <input type="number" min="0" step="0.01" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', paddingLeft: 22, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)', boxSizing: 'border-box' }} />
    </div>
  )
}
