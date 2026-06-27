'use client'
import { useState, useRef, useMemo } from 'react'

export interface AreaPoint { t: number; v: number }

interface AreaChartProps {
  points: AreaPoint[]               // sorted ascending by t (epoch ms); x is time-positioned
  color?: string
  height?: number
  stepped?: boolean                 // staircase (cumulative counts) vs smooth line
  format?: (v: number) => string    // value formatter for the scrub tooltip
}

const VW = 300   // internal SVG viewBox width
const X_H = 18   // height reserved below the SVG for date labels

const defaultFormat = (v: number) => String(Math.round(v))

function formatFull(t: number): string {
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Adaptive axis label: short spans show month/day, long spans show month/year.
function makeAxisFormatter(spanMs: number): (t: number) => string {
  const longSpan = spanMs > 120 * 24 * 3600 * 1000
  return (t: number) => {
    const d = new Date(t)
    return longSpan
      ? `${d.toLocaleString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
      : `${d.getMonth() + 1}/${d.getDate()}`
  }
}

export function AreaChart({ points, color = '#45DB8D', height = 120, stepped = false, format = defaultFormat }: AreaChartProps) {
  const [scrubIdx, setScrubIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(`ac${Math.random().toString(36).slice(2, 8)}`)
  const id = idRef.current

  const chartH = Math.max(40, height - X_H)

  const { coords, linePath, fillPath, tMin, tSpan } = useMemo(() => {
    if (points.length < 2) {
      return { coords: [] as { x: number; y: number }[], linePath: '', fillPath: '', tMin: 0, tSpan: 1 }
    }
    const padT = 12, padB = 8
    const h = chartH - padT - padB
    const tMin = points[0].t
    const tMax = points[points.length - 1].t
    const tSpan = tMax - tMin || 1
    const min = Math.min(...points.map(p => p.v))
    const max = Math.max(...points.map(p => p.v))
    const range = max - min || 1
    const coords = points.map(p => ({
      x: ((p.t - tMin) / tSpan) * VW,
      y: padT + h - ((p.v - min) / range) * h,
    }))
    let line = ''
    coords.forEach((c, i) => {
      if (i === 0) line += `M${c.x.toFixed(1)},${c.y.toFixed(1)}`
      else if (stepped) line += ` L${c.x.toFixed(1)},${coords[i - 1].y.toFixed(1)} L${c.x.toFixed(1)},${c.y.toFixed(1)}`
      else line += ` L${c.x.toFixed(1)},${c.y.toFixed(1)}`
    })
    const lastX = coords[coords.length - 1].x
    const firstX = coords[0].x
    const fill = `${line} L${lastX.toFixed(1)},${chartH} L${firstX.toFixed(1)},${chartH} Z`
    return { coords, linePath: line, fillPath: fill, tMin, tSpan }
  }, [points, chartH, stepped])

  const axisLabels = useMemo(() => {
    if (points.length < 2) return [] as { pct: number; label: string; side: 'left' | 'center' | 'right' }[]
    const fmt = makeAxisFormatter(tSpan)
    const last = points[points.length - 1].t
    const isToday = Date.now() - last < 2 * 24 * 3600 * 1000
    const picks: { i: number; side: 'left' | 'center' | 'right' }[] = [
      { i: 0, side: 'left' },
      { i: Math.floor((points.length - 1) / 2), side: 'center' },
      { i: points.length - 1, side: 'right' },
    ]
    return picks.map(({ i, side }) => ({
      pct: ((points[i].t - tMin) / tSpan),
      label: side === 'right' && isToday ? 'Today' : fmt(points[i].t),
      side,
    }))
  }, [points, tMin, tSpan])

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!containerRef.current || coords.length < 2) return
    const rect = containerRef.current.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const targetX = frac * VW
    // Nearest point by x (handles irregular time spacing).
    let best = 0, bestD = Infinity
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - targetX)
      if (d < bestD) { bestD = d; best = i }
    }
    setScrubIdx(best)
  }

  if (!linePath) return null

  const sc = scrubIdx != null ? coords[scrubIdx] : null
  const scrubV = scrubIdx != null ? points[scrubIdx].v : null
  const scrubT = scrubIdx != null ? points[scrubIdx].t : null

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', touchAction: 'pan-y', cursor: 'crosshair', userSelect: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setScrubIdx(null)}
    >
      <svg
        viewBox={`0 0 ${VW} ${chartH}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: chartH, overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={fillPath} fill={`url(#${id})`} />

        {/* Baseline */}
        <line x1="0" y1={chartH - 1} x2={VW} y2={chartH - 1}
          stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

        {/* Main line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {/* Scrub elements */}
        {sc && (
          <>
            <line x1={sc.x} y1={0} x2={sc.x} y2={chartH - 1}
              stroke={color} strokeWidth="0.75" strokeDasharray="3 2" opacity="0.5" />
            <circle cx={sc.x} cy={sc.y} r="5" fill={color} opacity="0.18" />
            <circle cx={sc.x} cy={sc.y} r="2.6" fill={color} />
          </>
        )}
      </svg>

      {/* Scrub tooltip — value + actual date */}
      {sc && scrubV != null && scrubT != null && (
        <div style={{
          position: 'absolute',
          top: Math.max(2, sc.y - 34),
          left: `${(sc.x / VW) * 100}%`,
          transform: `translateX(${sc.x < VW * 0.15 ? '0' : sc.x > VW * 0.85 ? '-100%' : '-50%'})`,
          background: 'rgba(13,15,26,0.92)',
          border: `1px solid ${color}55`,
          borderRadius: 7,
          padding: '4px 8px',
          pointerEvents: 'none',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 10,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color, lineHeight: 1.1 }}>{format(scrubV)}</div>
          <div style={{ fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{formatFull(scrubT)}</div>
        </div>
      )}

      {/* X-axis date labels */}
      <div style={{ position: 'relative', height: X_H, marginTop: 3 }}>
        {axisLabels.map(({ pct, label, side }, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: `${pct * 100}%`,
            transform: side === 'center' ? 'translateX(-50%)' : side === 'right' ? 'translateX(-100%)' : 'none',
            top: 2,
            fontSize: 8.5,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.30)',
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
