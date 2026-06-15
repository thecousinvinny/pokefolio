'use client'
import { useState, useRef, useMemo } from 'react'

interface SparklineProps {
  points: number[]
  color?: string
  height?: number
  fill?: boolean
}

const VW = 300   // internal SVG viewBox width
const X_H = 20  // height reserved below SVG for date labels

export function Sparkline({ points, color = '#45DB8D', height = 80, fill = true }: SparklineProps) {
  const [scrubIdx, setScrubIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(`sg${Math.random().toString(36).slice(2, 8)}`)
  const id = idRef.current

  const chartH = Math.max(20, height - X_H)

  const { coords, linePath, fillPath } = useMemo(() => {
    if (points.length < 2) return { coords: [] as { x: number; y: number }[], linePath: '', fillPath: '' }
    const padT = 8, padB = 4
    const h = chartH - padT - padB
    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1
    const coords = points.map((p, i) => ({
      x: (i / (points.length - 1)) * VW,
      y: padT + h - ((p - min) / range) * h,
    }))
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
    const fillPath = `${linePath} L${VW},${chartH} L0,${chartH} Z`
    return { coords, linePath, fillPath }
  }, [points, chartH])

  const dateLabels = useMemo(() => {
    const n = points.length
    if (n < 2) return [] as { pct: number; label: string; side: 'left' | 'center' | 'right' }[]
    const now = new Date()
    const picks = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(n * 3 / 4), n - 1]
    return picks.map(i => {
      const d = new Date(now)
      d.setDate(d.getDate() - (n - 1 - i))
      const label = i === n - 1 ? 'Today' : `${d.getMonth() + 1}/${d.getDate()}`
      const side: 'left' | 'center' | 'right' = i === 0 ? 'left' : i === n - 1 ? 'right' : 'center'
      return { pct: i / (n - 1), label, side }
    })
  }, [points.length])

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!containerRef.current || points.length < 2) return
    const rect = containerRef.current.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setScrubIdx(Math.round(frac * (points.length - 1)))
  }

  if (!linePath) return null

  const scrubX = scrubIdx != null && coords[scrubIdx] ? coords[scrubIdx].x : null
  const scrubY = scrubIdx != null && coords[scrubIdx] ? coords[scrubIdx].y : null
  const scrubPrice = scrubIdx != null ? points[scrubIdx] : null

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', touchAction: 'pan-y', cursor: 'crosshair', userSelect: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setScrubIdx(null)}
    >
      {/* Chart SVG */}
      <svg
        viewBox={`0 0 ${VW} ${chartH}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: chartH, overflow: 'visible' }}
      >
        <defs>
          {fill && (
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          )}
        </defs>

        {fill && <path d={fillPath} fill={`url(#${id})`} />}

        {/* Baseline */}
        <line x1="0" y1={chartH - 1} x2={VW} y2={chartH - 1}
          stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

        {/* Main line — thin, uniform */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="1" strokeLinejoin="round" />

        {/* Scrub elements */}
        {scrubX != null && scrubY != null && (
          <>
            <line x1={scrubX} y1={0} x2={scrubX} y2={chartH - 1}
              stroke={color} strokeWidth="0.75" strokeDasharray="3 2" opacity="0.5" />
            <circle cx={scrubX} cy={scrubY} r="5" fill={color} opacity="0.15" />
            <circle cx={scrubX} cy={scrubY} r="2.5" fill={color} />
          </>
        )}
      </svg>

      {/* Scrub price tooltip */}
      {scrubPrice != null && scrubX != null && scrubY != null && (
        <div style={{
          position: 'absolute',
          top: Math.max(2, scrubY - 24),
          left: `${(scrubX / VW) * 100}%`,
          transform: 'translateX(-50%)',
          background: 'rgba(13,15,26,0.90)',
          border: `1px solid ${color}55`,
          borderRadius: 5,
          padding: '2px 7px',
          fontSize: 10,
          fontWeight: 700,
          color,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 10,
        }}>
          {scrubPrice >= 100 ? `$${scrubPrice.toFixed(0)}` : `$${scrubPrice.toFixed(2)}`}
        </div>
      )}

      {/* X-axis date labels */}
      <div style={{ position: 'relative', height: X_H, marginTop: 3 }}>
        {dateLabels.map(({ pct, label, side }, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: `${pct * 100}%`,
            transform: side === 'center' ? 'translateX(-50%)' : side === 'right' ? 'translateX(-100%)' : 'none',
            top: 2,
            fontSize: 8,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.28)',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
