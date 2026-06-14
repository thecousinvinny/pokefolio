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

function rarityColor(rarity?: string | null): string {
  if (!rarity) return 'rgba(255,255,255,0.38)'
  const r = rarity.toLowerCase()
  if (r.includes('special illustration')) return '#FFC845'
  if (r.includes('illustration rare'))    return '#D166F2'
  if (r.includes('hyper rare') || r.includes('rainbow')) return '#73D9D9'
  if (r.includes('secret'))     return '#5DA9FF'
  if (r.includes('vmax') || r.includes('vstar')) return '#FF9E2E'
  if (r.includes('amazing'))    return '#73D9D9'
  if (r.includes('ultra rare') || r.includes(' ex') || r.includes(' gx')) return '#FF9E2E'
  if (r.includes('holo'))       return 'rgba(200,210,255,0.75)'
  return 'rgba(255,255,255,0.38)'
}

interface CardDetailModalProps {
  card: PokemonCard | null
  onClose: () => void
  initialView?: 'detail' | 'sell' | 'gift'
}

export function CardDetailModal({ card, onClose, initialView = 'detail' }: CardDetailModalProps) {
  const { updateCard, setFavorite, setShowcase, removeCard } = useCollection()
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
  const sparkColor = profit == null ? 'var(--sky)' : profit >= 0 ? 'var(--emerald)' : 'var(--crimson)'
  const locked = card.is_favorite || card.is_showcase

  const setRef = [
    card.set_number
      ? `#${card.set_number}${card.set_printed_total ? `/${card.set_printed_total}` : ''}`
      : null,
    card.set_release_date ? formatSetDate(card.set_release_date) : null,
  ].filter(Boolean).join(' · ')

  async function handleConditionChange(idx: number) {
    setCondition(idx)
    await updateCard(card!.id, { condition: CONDITION_ORDER[idx] })
  }
  function handleShowcase() { setShowcase(card!.id) }
  function handleToWatch() { updateCard(card!.id, { status: 'wishlist' }); onClose() }
  function handleRemove() { removeCard(card!.id); onClose() }
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

  const rc = rarityColor(card.rarity)
  const isRcAccent = !rc.startsWith('rgba')

  return (
    <>
      <Modal open={!!card && !showSell && !showGift} onClose={onClose} maxWidth={720}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── TWO-PANEL HERO ── */}
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>

            {/* LEFT: image + metadata */}
            <div style={{ width: 176, flexShrink: 0 }}>
              {/* Card image */}
              <div
                className={card.is_showcase ? 'showcase-border' : ''}
                style={{
                  borderRadius: 12, overflow: 'hidden', position: 'relative',
                  width: '100%', paddingTop: '139%',
                  boxShadow: card.is_favorite && !card.is_showcase
                    ? '0 0 0 2px rgba(255,200,69,0.60), 0 0 24px rgba(255,200,69,0.25), 0 8px 28px rgba(0,0,0,0.50)'
                    : '0 8px 28px rgba(0,0,0,0.50)',
                }}>
                <CardArtwork
                  types={card.types}
                  imageUrl={card.image_lg ?? card.image_sm ?? undefined}
                  imageAlt={card.name}
                  isHolo={isHoloRarity(card.rarity)}
                />
              </div>

              {/* Name + rarity + artist */}
              <div style={{ marginTop: 12 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, lineHeight: 1.25, color: 'var(--text)' }}>
                  {card.name}
                  {card.language === 'JP' && (
                    <span style={{ marginLeft: 6, fontSize: 8, fontWeight: 900, background: '#E53E3E', color: '#fff', padding: '2px 5px', borderRadius: 4, verticalAlign: 'middle' }}>
                      JP
                    </span>
                  )}
                </h2>
                {card.rarity && (
                  <span style={{
                    display: 'inline-block', marginTop: 5,
                    fontSize: 8, fontWeight: 900, letterSpacing: '0.07em',
                    color: rc,
                    background: isRcAccent ? `${rc}16` : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isRcAccent ? `${rc}35` : 'rgba(255,255,255,0.10)'}`,
                    borderRadius: 100, padding: '2px 8px', lineHeight: 1.5,
                    maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {card.rarity.toUpperCase()}
                  </span>
                )}
                {card.artist && (
                  <p style={{ margin: '5px 0 0', fontSize: 10, color: 'var(--text3)' }}>
                    Illus. {card.artist}
                  </p>
                )}
              </div>

              {/* Set info */}
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--border)' }}>
                <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                  {card.set_name}
                </p>
                {setRef && (
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--text3)' }}>{setRef}</p>
                )}
              </div>
            </div>

            {/* RIGHT: market data + purchase + lore */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>

              {/* Market value */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                  Market Value
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>
                    {card.market_price != null ? formatPrice(card.market_price) : '—'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>NM</span>
                </div>

                {(card.market_low != null || card.market_mid != null || card.market_high != null || card.market_direct_low != null) && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {([
                      { label: 'Low',    val: card.market_low },
                      { label: 'Mid',    val: card.market_mid },
                      { label: 'High',   val: card.market_high },
                      { label: 'Direct', val: card.market_direct_low },
                    ] as { label: string; val: number | null | undefined }[]).filter(x => x.val != null).map(({ label, val }) => (
                      <div key={label}>
                        <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)' }}>{label}</p>
                        <p style={{ margin: '1px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{formatPrice(val!)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sparkline */}
              {priceHistory.length > 1 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>30-Day Price</span>
                    <span style={{ fontSize: 9, color: 'var(--text3)' }}>
                      {formatPrice(Math.min(...priceHistory))} – {formatPrice(Math.max(...priceHistory))}
                    </span>
                  </div>
                  <Sparkline points={priceHistory} color={sparkColor} height={38} />
                </div>
              )}

              {/* MY PURCHASE */}
              {isEditing ? (
                <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--s2)', border: '1px solid rgba(93,169,255,0.25)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                    Edit Purchase
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Price Paid</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>$</span>
                        <input type="number" min="0" step="0.01" value={editPaid} onChange={e => setEditPaid(e.target.value)}
                          style={{ width: '100%', paddingLeft: 18, paddingRight: 8, paddingTop: 7, paddingBottom: 7, borderRadius: 7, fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>From</label>
                      <input type="text" placeholder="eBay, local…" value={editFrom} onChange={e => setEditFrom(e.target.value)}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: 7, fontSize: 12, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveEdit} style={{ flex: 1, padding: '7px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'var(--sky)', color: '#0D0F1A', border: 'none', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setIsEditing(false)} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'transparent', color: 'var(--text3)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : card.price_paid != null && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
                    My Purchase
                  </p>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: profit != null ? 8 : 0 }}>
                    <Stat label="Paid"        value={formatPrice(card.price_paid)} />
                    {card.market_at_buy != null && <Stat label="Mkt at Buy" value={formatPrice(card.market_at_buy)} />}
                    {card.bought_from   && <Stat label="From"       value={card.bought_from} />}
                    {card.date_added    && <Stat label="Date"       value={formatDate(card.date_added)} />}
                  </div>
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
              )}

              {/* Card lore */}
              {card.flavor_text && (
                <p style={{ margin: '14px 0 0', fontSize: 11.5, lineHeight: 1.65, color: 'var(--text3)', fontStyle: 'italic', borderLeft: '2px solid var(--border2)', paddingLeft: 10 }}>
                  "{card.flavor_text}"
                </p>
              )}
            </div>
          </div>

          {/* ── CONDITION ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>Condition</span>
              {card.market_price && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {CONDITION_LABELS[currentCondition]} · <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatPrice(adjValue)}</span>
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {CONDITION_ORDER.map((c, i) => (
                <button key={c} onClick={() => handleConditionChange(i)} style={{
                  flex: 1, padding: '6px 0', borderRadius: 7,
                  fontSize: 11, fontWeight: 700,
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

          {/* ── ACTION BAR ── */}
          <div style={{
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap',
          }}>
            {/* Utility */}
            <Btn label="✎ Edit" onClick={startEdit} />
            {card.tcgplayer_url && <Btn label="↗ TCG" href={card.tcgplayer_url} />}

            <div style={{ flex: 1 }} />

            {/* Primary — hidden when locked */}
            {!locked && (
              <>
                <Btn label="SELL" color="var(--crimson)" accentBg="rgba(242,69,96,0.12)" onClick={() => setShowSell(true)} wide />
                <Btn label="GIFT" color="var(--violet)"  accentBg="rgba(156,114,250,0.12)" onClick={() => setShowGift(true)} wide />
                <Divider />
              </>
            )}

            {/* Toggles */}
            <Btn
              label={card.is_favorite ? 'UNFAV ★' : '★ FAV'}
              color="var(--gold)" accentBg="rgba(255,200,69,0.10)"
              onClick={() => setFavorite(card.id)} active={card.is_favorite}
            />
            <Btn
              label={card.is_showcase ? 'UNSHOW' : '◈ SHOW'}
              color="var(--violet)" accentBg="rgba(156,114,250,0.10)"
              onClick={handleShowcase} active={card.is_showcase}
            />

            <Divider />

            {/* Nav / danger */}
            <Btn label="↩ Watch" onClick={handleToWatch} />
            <Btn label="✕" color="var(--crimson)" onClick={handleRemove} />
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

function Stat({ label, value }: { label: string; value: string }) {
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
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{label}</a>
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
        style={{ width: '100%', paddingLeft: 22, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
    </div>
  )
}
