import { createClient } from '@supabase/supabase-js'
import type { TCGCard, TCGSearchResponse } from '@/types'
import { fetchSetPriceMap, normalizeCardNumber } from './tcgcsv'

// Catalog is public-read (RLS allows SELECT to anon), so the anon key is enough.
// The service-role key is seed-only and never used at runtime.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
)

// Narrows a query to one rarity bucket server-side so each page comes back dense
// (matters for sparse premium rarities like SIR/IR — otherwise the client throws
// away most of every catalog page). Substring/ilike matching folds legacy era
// names into the nearest modern tier (e.g. legacy "Rare Ultra" → Ultra Rare).
// MUST stay in sync with rarityGroupMatch() in app/(app)/browse/page.tsx.
type RarityFilterBuilder = ReturnType<ReturnType<typeof supabase.from>['select']>
function applyRarityGroup(q: RarityFilterBuilder, group: string): RarityFilterBuilder {
  switch (group) {
    case 'promo':    return q.ilike('rarity', '%promo%')
    case 'secret':   return q.ilike('rarity', '%secret%')
    case 'hyper':    return q.or('rarity.ilike.%hyper%,rarity.ilike.%rainbow%')
    case 'sir':      return q.ilike('rarity', '%special illustration%')
    case 'ir':       return q.ilike('rarity', '%illustration rare%').not('rarity', 'ilike', '%special%')
    case 'ultra':    return q.ilike('rarity', '%ultra%')
    case 'double':   return q.ilike('rarity', '%double rare%')
    case 'uncommon': return q.ilike('rarity', '%uncommon%')
    case 'common':   return q.ilike('rarity', 'common')   // no %: exact (avoids "Uncommon")
    case 'rare':     return q.ilike('rarity', '%rare%')
      .not('rarity', 'ilike', '%secret%')
      .not('rarity', 'ilike', '%hyper%')
      .not('rarity', 'ilike', '%rainbow%')
      .not('rarity', 'ilike', '%illustration%')
      .not('rarity', 'ilike', '%ultra%')
      .not('rarity', 'ilike', '%double%')
      .not('rarity', 'ilike', '%promo%')
    default:         return q
  }
}

interface CatalogRow {
  id: string
  name: string
  supertype: string | null
  types: string[] | null
  rarity: string | null
  number: string | null
  printed_total: number | null
  set_id: string | null
  set_name: string | null
  set_release_date: string | null
  image_sm: string | null
  image_lg: string | null
  artist: string | null
  hp: string | null
  flavor_text: string | null
}

// Maps a catalog row into the TCGCard shape the UI already consumes. Prices are
// filled in separately by enrichCatalogPrices — rows themselves hold no price.
function rowToTCG(r: CatalogRow): TCGCard {
  return {
    id: r.id,
    name: r.name,
    supertype: r.supertype ?? 'Pokémon',
    hp: r.hp ?? undefined,
    types: r.types ?? undefined,
    set: {
      id: r.set_id ?? '',
      name: r.set_name ?? '',
      series: '',
      printedTotal: r.printed_total ?? 0,
      total: r.printed_total ?? 0,
      // Postgres DATE comes back "2023-03-31"; UI expects the API's "2023/03/31"
      releaseDate: r.set_release_date ? r.set_release_date.replace(/-/g, '/') : '',
      images: { symbol: '', logo: '' },
    },
    number: r.number ?? '',
    artist: r.artist ?? undefined,
    rarity: r.rarity ?? undefined,
    flavorText: r.flavor_text ?? undefined,
    images: { small: r.image_sm ?? '', large: r.image_lg ?? '' },
  }
}

// PostgREST .or() and .ilike() treat % , and () as operators — strip them.
function sanitize(s: string): string {
  return s.replace(/[%,()*]/g, ' ').trim()
}

export interface CatalogSearchParams {
  query?: string
  set?: string
  number?: string
  rarityGroup?: string   // bucket key: promo|secret|hyper|sir|ir|ultra|double|rare|uncommon|common
  page?: number
  pageSize?: number
}

// Queries the local catalog. Returns null when the catalog can't serve this
// request (DB error, or zero hits) so the caller can fall back to the live API.
export async function searchCatalog(params: CatalogSearchParams): Promise<TCGSearchResponse | null> {
  const { query, set, number, rarityGroup, page = 1, pageSize = 50 } = params

  let q = supabase
    .from('card_catalog')
    .select('*', { count: 'exact' })

  const term = query ? sanitize(query) : ''
  if (term) {
    // name prefix OR set-name prefix — mirrors the live "(name OR set.name)" query
    q = q.or(`name.ilike.${term}%,set_name.ilike.${term}%`)
  }
  if (set) {
    const s = sanitize(set)
    if (s) q = q.ilike('set_name', `${s}%`)
  }
  if (number) {
    q = q.eq('number', number)
  }
  // Honor a rarity bucket whenever requested — ANDs cleanly with any
  // name/set/number predicate above so pages come back dense.
  if (rarityGroup && rarityGroup !== 'all') {
    q = applyRarityGroup(q, rarityGroup)
  }

  const from = (page - 1) * pageSize
  q = q
    .order('set_release_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, from + pageSize - 1)

  const { data, count, error } = await q
  if (error || !data || data.length === 0) return null

  return {
    data: (data as CatalogRow[]).map(rowToTCG),
    page,
    pageSize,
    count: data.length,
    totalCount: count ?? data.length,
  }
}

// Scan helper: card number + printed total uniquely identifies a card. Returns the
// authoritative catalog name when exactly one card matches. Plain-digit only
// (promos/subsets have no clean total). Instant — used to verify/correct OCR.
export async function resolveCatalogByNumberTotal(number: string, total: string): Promise<string | null> {
  if (!/^\d+$/.test(number) || !/^\d+$/.test(total)) return null
  const { data, error } = await supabase
    .from('card_catalog')
    .select('name')
    .eq('number', number)
    .eq('printed_total', Number(total))
    .limit(2)
  if (error || !data || data.length !== 1) return null
  return (data[0] as { name: string }).name
}

// Scan helper: does any catalog card match this name (prefix)? Instant existence
// check that replaces a live API round-trip when confirming an OCR'd name.
export async function catalogNameExists(name: string): Promise<boolean> {
  const term = sanitize(name)
  if (!term) return false
  const { data, error } = await supabase
    .from('card_catalog')
    .select('id')
    .ilike('name', `${term}%`)
    .limit(1)
  return !error && !!data && data.length > 0
}

// Fills in live prices for catalog cards: groups by set, fetches each unique
// set's tcgcsv price map in parallel, then matches each card by number.
// Best-effort — any set that fails just leaves those cards priceless.
export async function enrichCatalogPrices(cards: TCGCard[]): Promise<TCGCard[]> {
  const setNames = [...new Set(cards.map(c => c.set.name).filter(Boolean))]
  if (setNames.length === 0) return cards

  const maps = new Map<string, Map<string, import('./tcgcsv').PriceTiers>>()
  await Promise.all(setNames.map(async name => {
    try { maps.set(name, await fetchSetPriceMap(name)) } catch { /* leave unpriced */ }
  }))

  return cards.map(c => {
    const tiers = maps.get(c.set.name)?.get(normalizeCardNumber(c.number))
    if (!tiers?.market) return c
    return {
      ...c,
      tcgplayer: {
        url: '',
        updatedAt: new Date().toISOString(),
        prices: {
          holofoil: {
            low: tiers.low ?? 0,
            mid: tiers.mid ?? 0,
            high: tiers.high ?? 0,
            market: tiers.market,
            directLow: tiers.directLow,
          },
        },
      },
    }
  })
}

// Wraps enrichment in a hard time cap so slow tcgcsv never delays results —
// on timeout the cards return unpriced (UI shows "—", client caches what landed).
export async function enrichWithTimeout(cards: TCGCard[], capMs: number): Promise<TCGCard[]> {
  return Promise.race([
    enrichCatalogPrices(cards),
    new Promise<TCGCard[]>(resolve => setTimeout(() => resolve(cards), capMs)),
  ])
}
