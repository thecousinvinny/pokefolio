import { NextRequest, NextResponse } from 'next/server'
import { searchCardsFlexible } from '@/lib/tcg'
import { searchCatalog, enrichWithTimeout } from '@/lib/catalog'

// Bound worst case: 12s default attempt + 8s fallback attempt ≈ 20s
export const maxDuration = 25

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q') ?? undefined
  const set = searchParams.get('set') ?? undefined
  const number = searchParams.get('number') ?? undefined
  const type = searchParams.get('type') ?? undefined
  const rarity = searchParams.get('rarity') ?? undefined
  const fullArtOnly = searchParams.get('fullArtOnly') === 'true'
  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? 24)
  const isDefault = !q && !set

  // ── Catalog-first: instant local search for the cases it covers ──────────────
  // (default full-art browse, name queries, set queries, name+number scans).
  // Type/rarity filters aren't in the catalog path → those skip straight to live.
  if (!type && !rarity) {
    try {
      const hit = await searchCatalog({ query: q, set, number, fullArtOnly, page, pageSize })
      if (hit && hit.data.length > 0) {
        // Few sets per query → enrich fast; default browse spans many → allow more.
        const enriched = await enrichWithTimeout(hit.data, isDefault ? 7_000 : 4_000)
        return NextResponse.json(
          { ...hit, data: enriched, source: 'catalog' },
          {
            headers: {
              'Cache-Control': isDefault
                ? 'public, s-maxage=3600, stale-while-revalidate=86400'
                : 'public, s-maxage=1800, stale-while-revalidate=86400',
            },
          },
        )
      }
    } catch (err) {
      console.error('catalog search failed, falling back to live:', err)
    }
  }

  // ── Fallback: live pokemontcg.io (unchanged behavior) ────────────────────────
  console.log('TCG search (live):', { q, set, number })
  try {
    const data = await searchCardsFlexible({
      query: q,
      set,
      type,
      rarity,
      number,
      page,
      pageSize,
      skipEnrich: true,
      fullArtOnly,
      // Initial default browse is the heaviest query → longer budget; the cheaper
      // 2-term fallback filter inside searchCardsFlexible acts as its retry.
      // Active user searches stay snappy with a tighter single-attempt budget.
      timeoutMs: isDefault ? 12_000 : 9_000,
      retries: 0,
    })
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': isDefault
          ? 'public, s-maxage=3600, stale-while-revalidate=86400'
          : 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    const n = (err as Error)?.name
    if (n === 'TimeoutError' || n === 'AbortError') {
      return NextResponse.json({ error: 'timeout', data: [], totalCount: 0 }, { status: 504 })
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
