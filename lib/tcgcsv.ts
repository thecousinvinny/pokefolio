const BASE = 'https://tcgcsv.com'
const POKEMON_CAT = 3

function ua(): HeadersInit {
  return { 'User-Agent': 'CATCHM/1.0.0' }
}

// ─── TCGCSV response shapes ───────────────────────────────────────────────────

interface Group {
  groupId: number
  name: string
  abbreviation?: string
}

interface CSVPrice {
  productId: number
  subTypeName: string
  lowPrice: number | null
  midPrice: number | null
  highPrice: number | null
  marketPrice: number | null
  directLowPrice: number | null
}

interface CSVProduct {
  productId: number
  name: string
  cleanName?: string
  extendedData?: { name: string; displayName?: string; value: string }[]
}

// Normalizes a card number for cross-source matching: tcgcsv stores "054/091",
// pokemontcg.io stores "54". Take the part before "/" and drop leading zeros.
// "234/091"→"234", "054/091"→"54", "TG01/TG30"→"TG01", "54"→"54".
export function normalizeCardNumber(s: string): string {
  const head = s.split('/')[0].trim()
  return head.replace(/^0+(?=\d)/, '')
}

// tcgcsv puts the printed card number inside extendedData, not a top-level field.
function productCardNumber(p: CSVProduct): string | null {
  const v = p.extendedData?.find(e => e.name === 'Number')?.value
  return v ? normalizeCardNumber(v) : null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: ua(),
      next: { revalidate },
    })
    if (!res.ok) return null
    const data = await res.json()
    // TCGCSV returns either { results: [...] } or a bare array
    return (Array.isArray(data) ? data : (data.results ?? data)) as T
  } catch {
    return null
  }
}

async function getGroups(): Promise<Group[]> {
  return (await fetchJSON<Group[]>(`${BASE}/tcgplayer/${POKEMON_CAT}/groups`, 21600)) ?? []
}

async function getGroupPrices(groupId: number): Promise<CSVPrice[]> {
  return (await fetchJSON<CSVPrice[]>(`${BASE}/tcgplayer/${POKEMON_CAT}/${groupId}/prices`, 3600)) ?? []
}

async function getGroupProducts(groupId: number): Promise<CSVProduct[]> {
  return (await fetchJSON<CSVProduct[]>(`${BASE}/tcgplayer/${POKEMON_CAT}/${groupId}/products`, 21600)) ?? []
}

function extractProductId(url: string): number | null {
  const m = url.match(/\/product\/(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

// Normalizes a set name for cross-source matching. tcgcsv prefixes an era code
// ("SWSH: Crown Zenith") and uses a colon before subsets ("Crown Zenith: Galarian
// Gallery"), while pokemontcg.io has neither ("Crown Zenith Galarian Gallery").
// Strip the leading era prefix, then drop all punctuation/whitespace.
function normSetName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^[a-z0-9&]+:\s*/, '')   // era prefix: "swsh: ", "sv: ", "swsh12: "
    .replace(/[^a-z0-9]+/g, '')        // "crown zenith: galarian gallery" → "crownzenithgalariangallery"
}

// pokemontcg.io ↔ tcgcsv name mismatches that normalization can't bridge
// (different words entirely). Keyed by lowercased pokemontcg.io set name.
const SET_NAME_ALIASES: Record<string, string> = {
  'swsh black star promos': 'Sword & Shield Promo Cards',
  'scarlet & violet black star promos': 'Scarlet & Violet Promo Cards',
}

function resolveGroupId(groups: Group[], setName: string): number | null {
  const aliased = SET_NAME_ALIASES[setName.toLowerCase().trim()] ?? setName
  const target = normSetName(aliased)
  if (!target) return null
  // Exact normalized match first — keeps base "Crown Zenith" from grabbing the
  // "Crown Zenith Galarian Gallery" group (and vice-versa).
  const exact = groups.find(g => normSetName(g.name) === target)
  if (exact) return exact.groupId
  // Containment fallback for legacy/partial names.
  const partial = groups.find(g => {
    const n = normSetName(g.name)
    return n.length > 0 && (n.includes(target) || target.includes(n))
  })
  return partial?.groupId ?? null
}

function pickBestPrice(prices: CSVPrice[]): CSVPrice | null {
  if (!prices.length) return null
  // Prefer entries that actually have a market price
  const pool = prices.filter(p => p.marketPrice != null)
  const src = pool.length ? pool : prices
  return (
    // Holofoil but not reverse
    src.find(p => /holo/i.test(p.subTypeName) && !/reverse/i.test(p.subTypeName)) ??
    src.find(p => /normal/i.test(p.subTypeName)) ??
    src[0]
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PriceTiers {
  market?: number
  low?: number
  mid?: number
  high?: number
  directLow?: number
}

export async function fetchFallbackPrices(
  setName: string,
  tcgplayerUrl: string | undefined,
  cardNumber: string,
): Promise<PriceTiers | null> {
  const groups = await getGroups()
  const groupId = resolveGroupId(groups, setName)
  if (!groupId) return null

  const allPrices = await getGroupPrices(groupId)
  if (!allPrices.length) return null

  // Prefer product ID extracted from the TCGPlayer URL (most accurate)
  let productId = tcgplayerUrl ? extractProductId(tcgplayerUrl) : null

  // Fall back to looking up product ID by card number (from extendedData)
  if (!productId) {
    const products = await getGroupProducts(groupId)
    const want = normalizeCardNumber(cardNumber)
    productId = products.find(p => productCardNumber(p) === want)?.productId ?? null
  }

  if (!productId) return null

  const matching = allPrices.filter(p => p.productId === productId)
  const best = pickBestPrice(matching)
  if (!best) return null

  const n = (v: number | null): number | undefined => v ?? undefined
  return {
    market:    n(best.marketPrice),
    low:       n(best.lowPrice),
    mid:       n(best.midPrice),
    high:      n(best.highPrice),
    directLow: n(best.directLowPrice),
  }
}

// Batch variant: fetches an entire set's prices once and returns a
// card-number → PriceTiers map. Lets the catalog enrich a whole page of
// results with one fetch per unique set instead of one per card.
export async function fetchSetPriceMap(setName: string): Promise<Map<string, PriceTiers>> {
  const out = new Map<string, PriceTiers>()
  const groups = await getGroups()
  const groupId = resolveGroupId(groups, setName)
  if (!groupId) return out

  const [prices, products] = await Promise.all([
    getGroupPrices(groupId),
    getGroupProducts(groupId),
  ])
  if (!prices.length || !products.length) return out

  const byProduct = new Map<number, CSVPrice[]>()
  for (const p of prices) {
    const arr = byProduct.get(p.productId)
    if (arr) arr.push(p)
    else byProduct.set(p.productId, [p])
  }

  const n = (v: number | null): number | undefined => v ?? undefined
  for (const prod of products) {
    const num = productCardNumber(prod)
    if (!num) continue
    const best = pickBestPrice(byProduct.get(prod.productId) ?? [])
    if (!best) continue
    out.set(num, {
      market:    n(best.marketPrice),
      low:       n(best.lowPrice),
      mid:       n(best.midPrice),
      high:      n(best.highPrice),
      directLow: n(best.directLowPrice),
    })
  }
  return out
}
