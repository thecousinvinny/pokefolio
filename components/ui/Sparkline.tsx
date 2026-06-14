'use client'
import { useMemo } from 'react'

interface SparklineProps {
  points: number[]
  color?: string
  height?: number
  fill?: boolean
}

export function Sparkline({ points, color = '#45DB8D', height = 40, fill = true }: SparklineProps) {
  const { path, fillPath, width } = useMemo(() => {
    const w = 120
    const h = height - 4
    if (points.length < 2) return { path: '', fillPath: '', width: w }

    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1

    const coords = points.map((p, i) => ({
      x: (i / (points.length - 1)) * w,
      y: h - ((p - min) / range) * h + 2,
    }))

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
    const areaPath = `${linePath} L${w},${h + 2} L0,${h + 2} Z`

    return { path: linePath, fillPath: areaPath, width: w }
  }, [points, height])

  if (!path) return null

  const id = `spark-${Math.random().toString(36).slice(2)}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
      style={{ width: '100%', height }} className="overflow-visible">
      {fill && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={fillPath} fill={`url(#${id})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
