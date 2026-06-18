'use client'
import { useState } from 'react'
import Image from 'next/image'
import { UserSvg } from '@/components/layout/ProfileSheet'
import { getArtColors } from '@/components/cards/CardArtwork'
import { formatPrice } from '@/lib/utils'
import type { PokemonCard } from '@/types'

interface ShareRow {
  id: string
  display_name: string | null
  avatar_data: string | null
  cards_data: PokemonCard[] | null
  wishlist_data: PokemonCard[] | null
  include_collection: boolean
  include_wishlist: boolean
  updated_at: string
}

const CONDITION_COLOR: Record<string, string> = {
  NM: '#45DB8D', LP: '#a3e635', MP: '#facc15', HP: '#fb923c', DMG: '#f43f5e',
}

export function ShareView({ share }: { share: ShareRow }) {
  const hasBoth = share.include_collection && share.include_wishlist &&
    (share.cards_data?.length ?? 0) > 0 && (share.wishlist_data?.length ?? 0) > 0
  const [tab, setTab] = useState<'collection' | 'wishlist'>(
    share.include_collection ? 'collection' : 'wishlist'
  )

  const cards = tab === 'collection' ? (share.cards_data ?? []) : (share.wishlist_data ?? [])
  const displayName = share.display_name || 'A Collector'
  const initials = share.display_name
    ? share.display_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : null

  const collectionValue = (share.cards_data ?? []).reduce((s, c) => s + (c.market_price ?? 0), 0)
  const updatedDate = new Date(share.updated_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px 0',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--gold)' }}>
          CATCHM
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Updated {updatedDate}</div>
      </div>

      {/* ── Profile header ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 10, padding: '24px 20px 20px',
      }}>
        {/* Avatar */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          background: share.avatar_data ? 'transparent' : 'linear-gradient(135deg, var(--violet) 0%, var(--gold) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: initials ? 26 : 20, fontWeight: 700, color: '#fff',
          boxShadow: '0 4px 24px rgba(156,114,250,0.4)',
        }}>
          {share.avatar_data
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={share.avatar_data} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (initials ?? <UserSvg />)
          }
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{displayName}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Pokémon TCG Collector</div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
          {share.include_collection && (
            <>
              <Stat value={share.cards_data?.length ?? 0} label="cards" />
              {collectionValue > 0 && <Stat value={formatPrice(collectionValue)} label="value" />}
            </>
          )}
          {share.include_wishlist && (
            <Stat value={share.wishlist_data?.length ?? 0} label="wish list" />
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      {hasBoth && (
        <div style={{
          display: 'flex', gap: 8, padding: '0 20px 16px', justifyContent: 'center',
        }}>
          {(['collection', 'wishlist'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 20px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: tab === t ? 'var(--gold)' : 'var(--surface)',
                color: tab === t ? '#0D0F1A' : 'var(--text2)',
                transition: 'background 0.15s, color 0.15s',
              }}>
              {t === 'collection' ? 'Collection' : 'Wish List'}
            </button>
          ))}
        </div>
      )}

      {/* ── Card grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        padding: '0 14px 40px',
        maxWidth: 600,
        margin: '0 auto',
      }}>
        {cards.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1', textAlign: 'center',
            padding: '48px 0', color: 'var(--text3)', fontSize: 14,
          }}>
            Nothing here yet
          </div>
        ) : (
          cards.map(card => (
            <ShareCardTile key={card.id} card={card} isWishlist={tab === 'wishlist'} />
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{
        textAlign: 'center', padding: '0 20px 32px',
        fontSize: 11, color: 'var(--text3)', lineHeight: 1.6,
      }}>
        Shared with{' '}
        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>CATCHM</span>
        {' '}· Pokémon TCG Portfolio Tracker
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{label}</div>
    </div>
  )
}

function ShareCardTile({ card, isWishlist }: { card: PokemonCard; isWishlist: boolean }) {
  const [colors] = useState(() => getArtColors(card.types ?? undefined))
  const hasImage = !!card.image_sm

  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid var(--border)',
    }}>
      {/* Artwork */}
      <div style={{
        position: 'relative',
        aspectRatio: '0.72',
        background: hasImage ? 'transparent' : `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        overflow: 'hidden',
      }}>
        {hasImage && (
          <Image
            src={card.image_sm!}
            alt={card.name}
            fill
            sizes="(max-width: 600px) 45vw, 280px"
            style={{ objectFit: 'contain' }}
          />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{
          fontSize: 12, fontWeight: 700, lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {card.name}
        </div>
        <div style={{
          fontSize: 10, color: 'var(--text3)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {card.set_name}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          {isWishlist ? (
            <>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                {card.target_price ? 'Target' : 'Market'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>
                {card.target_price
                  ? formatPrice(card.target_price)
                  : card.market_price ? formatPrice(card.market_price) : '—'}
              </span>
            </>
          ) : (
            <>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
                color: CONDITION_COLOR[card.condition] ?? 'var(--text3)',
              }}>
                {card.condition}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {card.market_price ? formatPrice(card.market_price) : '—'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
