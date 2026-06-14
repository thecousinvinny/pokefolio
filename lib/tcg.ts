import type { TCGCard, TCGSearchResponse } from '@/types'

const BASE = 'https://api.pokemontcg.io/v2'

function headers(): HeadersInit {
  const key = process.env.POKEMONTCG_API_KEY
  return key ? { 'X-Api-Key': key } : {}
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
  return res.json()
}

export async function getCard(id: string): Promise<TCGCard> {
  const res = await fetch(`${BASE}/cards/${id}`, {
    headers: headers(),
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`TCG API error: ${res.status}`)
  const data = await res.json()
  return data.data
}

function buildQuery(input: string): string {
  const q = input.trim()
  if (!q) return 'hp:[1 TO *]'

  // Check if the input looks like a set code (e.g. "sv1", "swsh4")
  if (/^[a-z]{1,4}\d{1,3}$/i.test(q)) {
    return `set.id:${q}`
  }

  // Default: search by name (partial match)
  return `name:"${q}*"`
}

// Called from the API route to handle flexible queries
export async function searchCardsFlexible(params: {
  query?: string
  set?: string
  type?: string
  rarity?: string
  minPrice?: number
  maxPrice?: number
  page?: number
  pageSize?: number
}): Promise<TCGSearchResponse> {
  const { query, set, type, rarity, page = 1, pageSize = 20 } = params

  const parts: string[] = []

  if (query && query.trim()) {
    parts.push(`name:"${query.trim()}*"`)
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

  // Always exclude energy cards from main browse unless explicitly filtered
  const q = parts.length > 0 ? parts.join(' ') : 'hp:[1 TO *]'

  const url = `${BASE}/cards?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}&orderBy=-set.releaseDate`
  const res = await fetch(url, { headers: headers(), next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`TCG API ${res.status}`)
  return res.json()
}
