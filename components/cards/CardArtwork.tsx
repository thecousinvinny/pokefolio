'use client'
import Image from 'next/image'
import { useState } from 'react'

// From VAULT Theme.swift — CardType.artColors (0–1 → hex)
const ART_COLORS: Record<string, readonly [string, string]> = {
  fire:      ['#FF6B35', '#C71F38'],
  water:     ['#459EFF', '#1A45A8'],
  grass:     ['#5CD976', '#1A7557'],
  lightning: ['#FFD947', '#E08C19'],
  psychic:   ['#D166F2', '#7229A8'],
  fighting:  ['#DB7245', '#80291F'],
  darkness:  ['#576180', '#1A1C2E'],
  metal:     ['#9EADBE', '#4C596E'],
  dragon:    ['#F2B84D', '#57479E'],
  colorless: ['#DBDBE5', '#848A9E'],
  fairy:     ['#F4B8D4', '#B060A8'],
  trainer:   ['#F28C9E', '#8C3875'],
  energy:    ['#73D9D9', '#29738C'],
} as const


export function getArtColors(types?: string[]): readonly [string, string] {
  const t = types?.[0]?.toLowerCase() ?? 'colorless'
  return ART_COLORS[t] ?? ART_COLORS.colorless
}

interface CardArtworkProps {
  types?: string[]
  imageUrl?: string
  imageAlt?: string
  isHolo?: boolean
}

export function CardArtwork({ types, imageUrl, imageAlt, isHolo }: CardArtworkProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const primaryType = types?.[0]?.toLowerCase() ?? 'colorless'
  const [topColor, bottomColor] = ART_COLORS[primaryType] ?? ART_COLORS.colorless
  const showImage = !!imageUrl && !imgFailed

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      background: `linear-gradient(160deg, ${topColor} 0%, ${bottomColor} 100%)`,
    }}>
      {/* Radial highlight — mimics VAULT CardArtwork ambient glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 25%, rgba(255,255,255,0.24) 0%, transparent 58%)',
        pointerEvents: 'none',
      }} />


      {/* Card image */}
      {showImage && (
        <Image
          src={imageUrl}
          alt={imageAlt ?? ''}
          fill
          className="object-contain"
          sizes="(max-width: 640px) 50vw, 25vw"
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Holo foil shimmer — shown for holo/rare cards */}
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

// Small colored dot used in the info row (type icon equivalent to VAULT's SF Symbol)
export function TypeBadge({ type, size = 9 }: { type?: string; size?: number }) {
  const t = type?.toLowerCase() ?? 'colorless'
  const [color] = ART_COLORS[t] ?? ART_COLORS.colorless
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }} />
  )
}
