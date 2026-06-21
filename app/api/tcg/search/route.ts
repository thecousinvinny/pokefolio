import { NextRequest, NextResponse } from 'next/server'
import { searchCardsFlexible } from '@/lib/tcg'

// Bound worst case: 12s default attempt + 8s fallback attempt ≈ 20s
export const maxDuration = 25

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q') ?? undefined
  const set = searchParams.get('set') ?? undefined
  const isDefault = !q && !set

  console.log('TCG search:', { q, set, number: searchParams.get('number') })
  try {
    const data = await searchCardsFlexible({
      query: q,
      set,
      type: searchParams.get('type') ?? undefined,
      rarity: searchParams.get('rarity') ?? undefined,
      number: searchParams.get('number') ?? undefined,
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 24),
      skipEnrich: true,
      fullArtOnly: searchParams.get('fullArtOnly') === 'true',
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
