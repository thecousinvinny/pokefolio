'use client'
import { useState, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Sparkline } from '@/components/ui/Sparkline'
import { CardArtwork } from '@/components/cards/CardArtwork'
import { useCollection } from '@/components/CollectionContext'
import { formatPrice, formatDate, generatePriceHistory } from '@/lib/utils'
import { conditionAdjustedValue, CONDITION_ORDER, CONDITION_LABELS, CONDITION_MULTIPLIERS } from '@/types'
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
}

export function CardDetailModal({ card, onClose, initialView = 'detail' }: CardDetailModalProps) {
  const { updateCard, setFavorite, removeCard, giftCard } = useCollection()
  const [condition, setCondition] = useState<number>(
    card ? CONDITION_ORDER.indexOf(card.condition) : 0
  )
  const [showSell, setShowSell] = useState(initialView === 'sell')
  const [showGift, setShowGift] = useState(initialView === 'gift')
  const [isEditing, setIsEditing] = useState(false)
  const [editPaid, setEditPaid] = useState('')
  const [editFrom, setEditFrom] = useState('')

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
  const sparkColor = profit == null ? '#5DA9FF' : profit >= 0 ? '#45DB8D' : '#F24560'
  const setRef = [
    card.set_number ? `#${card.set_number}${card.set_printed_total ? `/${card.set_printed_total}` : ''}` : null,
    card.set_release_date ? formatSetDate(card.set_release_date) : null,
  ].filter(Boolean).join(' · ')

  async function handleConditionChange(idx: number) {
    setCondition(idx)
    await updateCard(card!.id, { condition: CONDITION_ORDER[idx] })
  }

  function handleShowcase() {
    updateCard(card!.id, { is_showcase: !card!.is_showcase })
  }

  function handleToWatch() {
    updateCard(card!.id, { status: 'wishlist' })
    onClose()
  }

  function handleRemove() {
    removeCard(card!.id)
    onClose()
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

  // Left panel action button
  function ActionBtn({ label, color, href, onClick: cb, active }: {
    label: string; color: string; href?: string; onClick?: () => void; active?: boolean
  }) {
    const s: React.CSSProperties = {
      padding: '7px 4px', borderRadius: 8, fontSize: 10.5, fontWeight: 800,
      letterSpacing: '0.03em', textAlign: 'center',
      color: active ? '#0D0F1A' : color,
      background: active ? color : `${color}14`,
      border: `1px solid ${color}30`,
      cursor: 'pointer', textDecoration: 'none', display: 'block',
      transition: 'all 0.12s ease',
    }
    if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={s}>{label}</a>
    return <button onClick={cb} style={{ ...s, width: '100%' }}>{label}</button>
  }

  return (
    <>
      <Modal open={!!card && !showSell && !showGift} onClose={onClose} maxWidth={700}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ── TWO-PANEL HERO ── */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

            {/* LEFT PANEL */}
            <div style={{ width: 188, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Card image */}
              <div style={{ position: 'relative' }}>
                <div
                  className={card.is_showcase ? 'showcase-border' : ''}
                  style={{
                    borderRadius: 14, overflow: 'hidden', position: 'relative',
                    width: '100%', paddingTop: '139%',
                    boxShadow: card.is_favorite && !card.is_showcase
                      ? '0 0 0 2px rgba(255,200,69,0.65), 0 0 20px rgba(255,200,69,0.30), 0 8px 24px rgba(0,0,0,0.45)'
                      : '0 8px 24px rgba(0,0,0,0.45)',
                  }}>
                  <CardArtwork
                    types={card.types}
                    imageUrl={card.image_lg ?? card.image_sm ?? undefined}
                    imageAlt={card.name}
                    isHolo={isHoloRarity(card.rarity)}
                  />
                </div>
              </div>

              {/* Name + badges */}
              <div>
                <h2 style={{
                  margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.25,
                  color: 'var(--text)',
                }}>
                  {card.name}
                  {card.language === 'JP' && (
                    <span style={{
                      marginLeft: 7, fontSize: 9, fontWeight: 900,
                      background: '#E53E3E', color: '#fff',
                      padding: '2px 5px', borderRadius: 4, verticalAlign: 'middle',
                    }}>JP</span>
                  )}
                </h2>
                {card.rarity && (
                  <span style={{
                    display: 'inline-block', marginTop: 5,
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '3px 9px', borderRadius: 100,
                    background: 'var(--s2)', color: 'var(--text2)',
                  }}>
                    {card.rarity}
                  </span>
                )}
                {card.artist && (
                  <p style={{ margin: '5px 0 0', fontSize: 10.5, color: 'var(--text3)' }}>
                    Illus. {card.artist}
                  </p>
                )}
              </div>

              {/* SET INFO */}
              <div style={{
                padding: '10px', borderRadius: 10,
                background: 'var(--s2)', border: '1px solid var(--border)',
              }}>
                <p className="section-label" style={{ marginBottom: 6 }}>SET INFO</p>
                <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {card.set_name}
                </p>
                {setRef && (
                  <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--text3)' }}>{setRef}</p>
                )}
              </div>

              {/* ACTIONS 2-col grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <ActionBtn label="↗ TCG"    color="var(--text2)"   href={card.tcgplayer_url ?? undefined} />
                <ActionBtn label="✎ EDIT"   color="var(--sky)"     onClick={startEdit} />
                <ActionBtn label="SELL"     color="var(--crimson)" onClick={() => setShowSell(true)} />
                <ActionBtn label="GIFT"     color="var(--sky)"     onClick={() => setShowGift(true)} />
                <ActionBtn label="◈ SHOW"   color="var(--violet)"  onClick={handleShowcase} active={card.is_showcase} />
                <ActionBtn label="★ FAV"    color="var(--gold)"    onClick={() => setFavorite(card.id)} active={card.is_favorite} />
                <ActionBtn label="↩ WATCH"  color="var(--text2)"   onClick={handleToWatch} />
                <ActionBtn label="✕ REMOVE" color="var(--crimson)" onClick={handleRemove} />
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* MARKET VALUE */}
              <div style={{
                padding: '14px', borderRadius: 14,
                background: 'var(--s2)', border: '1px solid var(--border)',
              }}>
                <p className="section-label" style={{ marginBottom: 10 }}>MARKET VALUE</p>
                <p style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>
                  {card.market_price != null ? formatPrice(card.market_price) : '—'}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginLeft: 6 }}>NM</span>
                </p>

                {/* Price tiers table */}
                {(card.market_low != null || card.market_mid != null || card.market_high != null || card.market_direct_low != null) && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '6px 12px',
                  }}>
                    {[
                      { label: 'NM LOW',    val: card.market_low },
                      { label: 'NM MID',    val: card.market_mid },
                      { label: 'NM HIGH',   val: card.market_high },
                      { label: 'DIRECT LOW', val: card.market_direct_low },
                    ].map(({ label, val }) => val != null && (
                      <div key={label}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text3)', textTransform: 'uppercase' }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginLeft: 6 }}>
                          {formatPrice(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sparkline */}
              {priceHistory.length > 1 && (
                <div style={{
                  padding: '12px 14px 10px', borderRadius: 12,
                  background: 'var(--s2)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="section-label">30-DAY PRICE</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                      {formatPrice(Math.min(...priceHistory))} – {formatPrice(Math.max(...priceHistory))}
                    </span>
                  </div>
                  <Sparkline points={priceHistory} color={sparkColor} height={40} />
                </div>
              )}

              {/* CARD LORE */}
              {card.flavor_text && (
                <div style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: 'var(--s2)', border: '1px solid var(--border)',
                }}>
                  <p className="section-label" style={{ marginBottom: 7 }}>CARD LORE</p>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.65, color: 'var(--text2)', fontStyle: 'italic' }}>
                    "{card.flavor_text}"
                  </p>
                </div>
              )}

              {/* MY PURCHASE */}
              {isEditing ? (
                <div style={{
                  padding: '12px 14px', borderRadius: 12,
                  background: 'var(--s2)', border: '1px solid rgba(93,169,255,0.30)',
                }}>
                  <p className="section-label" style={{ marginBottom: 10 }}>EDIT PURCHASE</p>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        Price Paid
                      </label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>$</span>
                        <input type="number" min="0" step="0.01" value={editPaid} onChange={e => setEditPaid(e.target.value)}
                          style={{ width: '100%', paddingLeft: 20, paddingRight: 8, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 13, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                        From
                      </label>
                      <input type="text" placeholder="eBay, local…" value={editFrom} onChange={e => setEditFrom(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: 8, fontSize: 13, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveEdit} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--sky)', color: '#0D0F1A', border: 'none', cursor: 'pointer' }}>
                      Save
                    </button>
                    <button onClick={() => setIsEditing(false)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--s2)', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                (card.price_paid != null || card.market_at_buy != null || card.bought_from || card.date_added) && (
                  <div style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'var(--s2)', border: '1px solid var(--border)',
                  }}>
                    <p className="section-label" style={{ marginBottom: 10 }}>MY PURCHASE</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginBottom: 8 }}>
                      {card.price_paid != null && <PurchaseStat label="Paid" value={formatPrice(card.price_paid)} />}
                      {card.market_at_buy != null && <PurchaseStat label="Mkt at Buy" value={formatPrice(card.market_at_buy)} />}
                      {card.bought_from && <PurchaseStat label="From" value={card.bought_from} />}
                      {card.date_added && <PurchaseStat label="Date" value={formatDate(card.date_added)} />}
                    </div>
                    {profit != null && (
                      <div style={{
                        padding: '7px 10px', borderRadius: 8,
                        background: profit >= 0 ? 'rgba(69,219,141,0.10)' : 'rgba(242,69,96,0.10)',
                        border: `1px solid ${profit >= 0 ? 'rgba(69,219,141,0.22)' : 'rgba(242,69,96,0.22)'}`,
                      }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: profit >= 0 ? 'var(--emerald)' : 'var(--crimson)',
                        }}>
                          {profit >= 0 ? '▲' : '▼'} {formatPrice(Math.abs(profit))} unrealized
                          {profitPct != null && ` (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(1)}%)`}
                        </span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* ── CONDITION (full width) ── */}
          <div style={{
            marginTop: 18, padding: '12px 14px',
            borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="section-label">CONDITION</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
                {currentCondition} · {CONDITION_LABELS[currentCondition]}
                {card.market_price && (
                  <span style={{ fontWeight: 500, color: 'var(--text3)', marginLeft: 6 }}>
                    = {formatPrice(adjValue)}
                  </span>
                )}
              </span>
            </div>
            <input
              type="range" min={0} max={4} value={condition}
              onChange={e => handleConditionChange(Number(e.target.value))}
              className="w-full"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              {CONDITION_ORDER.map((c, i) => (
                <span key={c} style={{
                  fontSize: 10, fontWeight: i === condition ? 700 : 400,
                  color: i === condition ? 'var(--gold)' : 'var(--text3)',
                }}>
                  {c}
                </span>
              ))}
            </div>
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

function PurchaseStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)' }}>
        {label}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</p>
    </div>
  )
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
    <Modal open title={giftMode ? 'Log Gift' : 'Log Sale / Trade'} onClose={onClose} maxWidth={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}>
          ← Back to {card.name}
        </button>

        {giftMode && (
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(93,169,255,0.08)', border: '1px solid rgba(93,169,255,0.20)',
          }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--sky)' }}>
              Card will be removed from your portfolio and logged as gifted (sold for $0).
            </p>
          </div>
        )}

        {!giftMode && (
          <div>
            <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>Sale price *</label>
            <PriceInput value={soldPrice} onChange={setSoldPrice} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>Fees</label>
            <PriceInput value={fees} onChange={setFees} placeholder="0.00" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>Shipping</label>
            <PriceInput value={shipping} onChange={setShipping} placeholder="0.00" />
          </div>
        </div>

        <div style={{
          padding: '14px', borderRadius: 12, textAlign: 'center',
          background: 'var(--s2)', border: '1px solid var(--border)',
        }}>
          <p className="section-label" style={{ marginBottom: 6 }}>
            {giftMode ? 'TOTAL COST' : 'NET PROFIT'}
          </p>
          <p style={{
            margin: 0, fontSize: 24, fontWeight: 900,
            color: netProfit >= 0 && !giftMode ? 'var(--emerald)' : 'var(--crimson)',
          }}>
            {giftMode ? `-${formatPrice(f + s + (card.price_paid ?? 0))}` : `${netProfit >= 0 ? '+' : ''}${formatPrice(netProfit)}`}
          </p>
          {card.price_paid != null && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text3)' }}>
              Paid {formatPrice(card.price_paid)}{!giftMode ? ` · Sold ${formatPrice(sp)}` : ''}
            </p>
          )}
        </div>

        <button
          onClick={confirm}
          disabled={saving || (!giftMode && !sp)}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: giftMode
              ? 'linear-gradient(135deg, var(--sky), var(--violet))'
              : 'linear-gradient(135deg, var(--amber), var(--crimson))',
            color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer',
            opacity: saving || (!giftMode && !sp) ? 0.6 : 1,
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
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, fontSize: 13, color: 'var(--text3)' }}>$</span>
      <input
        type="number" min="0" step="0.01" placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', paddingLeft: 24, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
          borderRadius: 10, fontSize: 14, outline: 'none',
          background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)',
        }}
      />
    </div>
  )
}
