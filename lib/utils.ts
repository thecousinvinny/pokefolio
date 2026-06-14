import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatPrice(value: number, compact = false): string {
  if (compact && value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`
  }
  if (value >= 100) return `$${value.toFixed(0)}`
  return `$${value.toFixed(2)}`
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' })
}

export function profitColor(value: number): string {
  return value >= 0 ? '#45DB8D' : '#F24560'
}

// Generate a plausible 30-day price history from a current price
export function generatePriceHistory(currentPrice: number, points = 30): number[] {
  const history: number[] = []
  let price = currentPrice * (0.85 + Math.random() * 0.15)
  for (let i = 0; i < points; i++) {
    price = price * (1 + (Math.random() - 0.48) * 0.04)
    history.push(Math.max(0.01, price))
  }
  history[history.length - 1] = currentPrice
  return history
}

// Type rarity → gradient for card art background
export function rarityGradient(rarity?: string): string {
  if (!rarity) return 'from-surface to-elevated'
  const r = rarity.toLowerCase()
  if (r.includes('special art') || r.includes('sar')) return 'from-violet/20 to-sky/20'
  if (r.includes('secret')) return 'from-gold/20 to-amber/20'
  if (r.includes('ultra') || r.includes('vmax') || r.includes('vstar')) return 'from-amber/20 to-crimson/20'
  if (r.includes('holo')) return 'from-sky/20 to-violet/20'
  return 'from-surface to-elevated'
}

// Type → accent color
export function typeColor(types?: string[]): string {
  const t = types?.[0]?.toLowerCase()
  const map: Record<string, string> = {
    fire: '#FF6B35',
    water: '#5DA9FF',
    grass: '#45DB8D',
    lightning: '#FFC845',
    psychic: '#9C72FA',
    fighting: '#D4845A',
    darkness: '#8B8FA8',
    metal: '#9BA8B5',
    dragon: '#8B72BD',
    colorless: '#A8A8A8',
    fairy: '#F4B8D4',
  }
  return map[t ?? ''] ?? '#5DA9FF'
}
