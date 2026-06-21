import type { ReactNode } from 'react'
import { RollingNumber } from '@/components/ui/RollingNumber'

// Shared headline stat tile used on DASH, CATCHM, and WISH.
export function StatCard({ label, value, icon, color }: {
  label: string
  value: string
  icon: ReactNode
  color: string
}) {
  return (
    <div className="stat-card">
      <div className="mb-2" style={{ color }}>{icon}</div>
      <p className="text-2xl font-extrabold pv" style={{ color }}><RollingNumber value={value} /></p>
      <p className="section-label mt-1">{label.toUpperCase()}</p>
    </div>
  )
}
