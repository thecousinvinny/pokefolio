// ─── Collection types ────────────────────────────────────────────────────────

export type CardStatus = 'owned' | 'wishlist' | 'for_sale'
export type CardCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'

export const CONDITION_MULTIPLIERS: Record<CardCondition, number> = {
  NM: 1.0,
  LP: 0.85,
  MP: 0.68,
  HP: 0.50,
  DMG: 0.32,
}

export const CONDITION_LABELS: Record<CardCondition, string> = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
}

export const CONDITION_ORDER: CardCondition[] = ['NM', 'LP', 'MP', 'HP', 'DMG']

export interface PokemonCard {
  id: string
  user_id: string
  tcg_id: string
  name: string
  set_name: string
  set_code?: string
  set_number?: string
  artist?: string
  supertype?: string
  types?: string[]
  rarity?: string
  image_sm?: string
  image_lg?: string
  language?: 'EN' | 'JP'
  flavor_text?: string
  set_printed_total?: number
  set_release_date?: string
  market_price?: number
  market_low?: number
  market_mid?: number
  market_high?: number
  market_direct_low?: number
  price_yesterday?: number
  price_updated_at?: string
  tcgplayer_url?: string
  status: CardStatus
  condition: CardCondition
  is_showcase?: boolean
  price_paid?: number
  market_at_buy?: number
  bought_from?: string
  target_price?: number
  alerts_enabled: boolean
  is_favorite: boolean
  date_added: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface SaleRecord {
  id: string
  user_id: string
  tcg_id: string
  card_name: string
  set_name?: string
  image_sm?: string
  card_snapshot?: Record<string, unknown>
  sale_type?: 'sale' | 'gift'
  date_sold: string
  sold_price: number
  fees: number
  shipping: number
  cost_basis: number
  net_profit: number
  created_at: string
}

// ─── Pokemon TCG API types ────────────────────────────────────────────────────

export interface TCGPrices {
  holofoil?: { low: number; mid: number; high: number; market: number; directLow?: number }
  reverseHolofoil?: { low: number; mid: number; high: number; market: number }
  normal?: { low: number; mid: number; high: number; market: number }
  '1stEditionHolofoil'?: { low: number; mid: number; high: number; market: number }
  unlimitedHolofoil?: { low: number; mid: number; high: number; market: number }
}

export interface TCGCard {
  id: string
  name: string
  supertype: string
  subtypes?: string[]
  hp?: string
  types?: string[]
  evolvesFrom?: string
  set: {
    id: string
    name: string
    series: string
    printedTotal: number
    total: number
    releaseDate: string
    images: { symbol: string; logo: string }
  }
  number: string
  artist?: string
  rarity?: string
  flavorText?: string
  images: {
    small: string
    large: string
  }
  tcgplayer?: {
    url: string
    updatedAt: string
    prices?: TCGPrices
  }
  cardmarket?: {
    url: string
    updatedAt: string
    prices?: {
      averageSellPrice?: number
      lowPrice?: number
      trendPrice?: number
      reverseHoloTrend?: number
    }
  }
}

export interface TCGSearchResponse {
  data: TCGCard[]
  page: number
  pageSize: number
  count: number
  totalCount: number
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

export function conditionAdjustedValue(card: PokemonCard): number {
  return (card.market_price ?? 0) * CONDITION_MULTIPLIERS[card.condition]
}

export function unrealizedProfit(card: PokemonCard): number {
  if (card.price_paid == null) return 0
  return conditionAdjustedValue(card) - card.price_paid
}

export function getBestTCGPrice(card: TCGCard): number | undefined {
  const prices = card.tcgplayer?.prices
  if (!prices) return undefined
  return (
    prices.holofoil?.market ??
    prices.normal?.market ??
    prices.reverseHolofoil?.market ??
    prices['1stEditionHolofoil']?.market ??
    prices.unlimitedHolofoil?.market
  )
}

export function getBestTCGPriceTiers(card: TCGCard): {
  low?: number; mid?: number; high?: number; market?: number; directLow?: number
} {
  const p = card.tcgplayer?.prices
  if (!p) return {}
  const tier = p.holofoil ?? p.normal ?? p.reverseHolofoil ?? p['1stEditionHolofoil'] ?? p.unlimitedHolofoil
  if (!tier) return {}
  return {
    low: tier.low,
    mid: tier.mid,
    high: tier.high,
    market: tier.market,
    directLow: p.holofoil?.directLow,
  }
}

export function tcgCardToPortfolioCard(tcg: TCGCard): Omit<PokemonCard, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'condition' | 'alerts_enabled' | 'is_favorite' | 'date_added'> {
  const tiers = getBestTCGPriceTiers(tcg)
  return {
    tcg_id: tcg.id,
    name: tcg.name,
    set_name: tcg.set.name,
    set_code: tcg.set.id,
    set_number: tcg.number,
    set_printed_total: tcg.set.printedTotal,
    set_release_date: tcg.set.releaseDate,
    artist: tcg.artist,
    supertype: tcg.supertype,
    types: tcg.types,
    rarity: tcg.rarity,
    flavor_text: tcg.flavorText,
    image_sm: tcg.images.small,
    image_lg: tcg.images.large,
    tcgplayer_url: tcg.tcgplayer?.url,
    market_price: tiers.market,
    market_low: tiers.low,
    market_mid: tiers.mid,
    market_high: tiers.high,
    market_direct_low: tiers.directLow,
    price_updated_at: new Date().toISOString(),
  }
}
