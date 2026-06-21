import type { TCGCard, TCGSearchResponse } from '@/types'
import { getBestTCGPrice } from '@/types'
import { fetchFallbackPrices } from './tcgcsv'

const BASE = 'https://api.pokemontcg.io/v2'

function headers(): HeadersInit {
  const key = process.env.POKEMONTCG_API_KEY
  return key ? { 'X-Api-Key': key } : {}
}

// Silently fills in price data from TCGCSV when TCGPlayer prices are missing
async function enrichCardPrices(card: TCGCard): Promise<TCGCard> {
  if (getBestTCGPrice(card) != null) return card

  try {
    const prices = await fetchFallbackPrices(
      card.set.name,
      card.tcgplayer?.url,
      card.number,
    )
    if (!prices?.market) return card

    return {
      ...card,
      tcgplayer: {
        url: card.tcgplayer?.url ?? '',
        updatedAt: new Date().toISOString(),
        prices: {
          holofoil: {
            low: prices.low ?? 0,
            mid: prices.mid ?? 0,
            high: prices.high ?? 0,
            market: prices.market,
            directLow: prices.directLow,
          },
        },
      },
    }
  } catch {
    return card
  }
}

export async function searchCards(
  query: string,
  page = 1,
  pageSize = 20
): Promise<TCGSearchResponse> {
  const q = buildQuery(query)
  const url = `${BASE}/cards?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}&orderBy=-set.releaseDate`
  const res = await fetch(url, { headers: headers(), next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`)
  const json: TCGSearchResponse = await res.json()
  const enriched = await Promise.all(json.data.map(enrichCardPrices))
  return { ...json, data: enriched }
}

export async function getCard(id: string): Promise<TCGCard> {
  const res = await fetch(`${BASE}/cards/${id}`, {
    headers: headers(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`)
  const data = await res.json()
  return enrichCardPrices(data.data)
}

function buildQuery(input: string): string {
  const q = input.trim()
  if (!q) return 'hp:[1 TO *]'

  if (/^[a-z]{1,4}\d{1,3}$/i.test(q)) {
    return `set.id:${q}`
  }

  return `name:"${q}*"`
}

// Full-art rarities for the default "no query" browse.
// Covers SV era (SIR, IR, Hyper Rare) and SWSH era (Rare Rainbow / Rainbow Rare).
// All of these have rarityWeight >= 80 in our system.
const FULL_ART_FILTER =
  '(rarity:"Special Illustration Rare" OR rarity:"Illustration Rare" OR rarity:"Hyper Rare" OR rarity:"Rare Rainbow" OR rarity:"Rainbow Rare")'

// Cheaper two-term variant used only when the full filter above times out —
// fewer OR clauses, still full-art, so the FIND tab never lands empty.
const FULL_ART_FALLBACK_FILTER =
  '(rarity:"Special Illustration Rare" OR rarity:"Illustration Rare")'

// Single fetch attempt with an abort timeout, retried on timeout only.
// HTTP errors (4xx/5xx) are thrown immediately — retrying won't fix them.
async function fetchTcgJson(
  url: string,
  revalidate: number,
  timeoutMs: number,
  retries: number,
): Promise<TCGSearchResponse> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: headers(),
        next: { revalidate },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new Error(`TCG API ${res.status}`)
      return await res.json() as TCGSearchResponse
    } catch (err) {
      lastErr = err
      const n = (err as Error)?.name
      if (n !== 'TimeoutError' && n !== 'AbortError') throw err
    }
  }
  throw lastErr
}

// Called from the API route to handle flexible queries
export async function searchCardsFlexible(params: {
  query?: string
  set?: string
  type?: string
  rarity?: string
  number?: string
  setTotal?: string
  minPrice?: number
  maxPrice?: number
  page?: number
  pageSize?: number
  skipEnrich?: boolean
  fullArtOnly?: boolean
  timeoutMs?: number
  retries?: number
}): Promise<TCGSearchResponse> {
  const {
    query, set, type, rarity, number, setTotal,
    page = 1, pageSize = 20, skipEnrich = false, fullArtOnly = false,
    timeoutMs = 8_000, retries = 0,
  } = params

  const parts: string[] = []

  if (query && query.trim()) {
    const q = query.trim()
    if (number) {
      // When we have a card number, search by name + number for an exact match
      parts.push(`name:"${q}*"`)
    } else {
      // Search by card name AND set name so "Perfect Order" or "Surging Sparks" finds the whole set
      parts.push(`(name:"${q}*" OR set.name:"${q}*")`)
    }
  }
  if (number) {
    parts.push(`number:${number}`)
  }
  if (set) {
    parts.push(`set.name:"${set}*"`)
  }
  if (type) {
    parts.push(`types:${type}`)
  }
  if (rarity) {
    parts.push(`rarity:"${rarity}"`)
  }
  if (setTotal) {
    parts.push(`set.total:${setTotal}`)
  }

  // Default browse (no query): show full arts only, newest set first.
  // When a query is present, show all matching cards of any rarity.
  const isDefault = !query && !set && !type && !rarity && !number && !setTotal
  const q = parts.length > 0 ? parts.join(' ') : (fullArtOnly ? FULL_ART_FILTER : 'hp:[1 TO *]')

  const buildUrl = (lucene: string) =>
    `${BASE}/cards?q=${encodeURIComponent(lucene)}&page=${page}&pageSize=${pageSize}&orderBy=-set.releaseDate`
  // Default full-art browse is static data — cache for 1 hour. User searches cache for 5 min.
  const revalidate = isDefault ? 3600 : 300

  let json: TCGSearchResponse
  try {
    json = await fetchTcgJson(buildUrl(q), revalidate, timeoutMs, retries)
  } catch (err) {
    // Default-browse fallback: the 5-term full-art filter is the slowest query.
    // One last attempt with the cheaper 2-term filter on a shorter 8s budget so
    // total server time stays bounded and the client can fall back to its cache.
    if (isDefault && fullArtOnly) {
      json = await fetchTcgJson(buildUrl(FULL_ART_FALLBACK_FILTER), revalidate, 8_000, 0)
    } else {
      throw err
    }
  }

  const enriched = skipEnrich ? json.data : await Promise.all(json.data.map(enrichCardPrices))
  return { ...json, data: enriched }
}
