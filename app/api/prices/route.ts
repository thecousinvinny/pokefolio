import { NextRequest, NextResponse } from 'next/server'
import { getCard } from '@/lib/tcg'
import { getBestTCGPrice } from '@/types'

// Batch current-price lookup for collection cards (esp. ones missing a price).
// getCard returns the live pokemontcg.io card (inline TCGplayer price) and
// tcgcsv-enriches when that's missing. Returns { [tcg_id]: market }.

export const maxDuration = 30

async function priceFor(id: string): Promise<number | null> {
  try {
    const card = await Promise.race([
      getCard(id),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 7_000)),
    ])
    return card ? (getBestTCGPrice(card) ?? null) : null
  } catch {
    return null
  }
}

// Bounded concurrency — firing all lookups at once gets rate-limited by
// pokemontcg.io (cold cards then time out and are lost for the session).
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

export async function POST(req: NextRequest) {
  let ids: string[] = []
  try { ids = (await req.json() as { ids?: string[] }).ids ?? [] } catch {}
  ids = [...new Set(ids.filter(Boolean))].slice(0, 40)
  if (ids.length === 0) return NextResponse.json({ prices: {} })

  const entries = await mapLimit(ids, 10, async id => [id, await priceFor(id)] as const)
  const prices: Record<string, number> = {}
  for (const [id, m] of entries) if (m != null) prices[id] = m
  return NextResponse.json({ prices })
}
