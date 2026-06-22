import { NextResponse } from 'next/server'

// The list of sets for the FIND set-filter dropdown. Heavily cached — sets change
// only when a new expansion drops.
const BASE = 'https://api.pokemontcg.io/v2'

export async function GET() {
  try {
    const key = process.env.POKEMONTCG_API_KEY
    const res = await fetch(`${BASE}/sets?pageSize=250&orderBy=-releaseDate&select=name,releaseDate`, {
      headers: key ? { 'X-Api-Key': key } : {},
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return NextResponse.json({ sets: [] })
    const j = await res.json()
    // Dedupe by name (a couple of sets share names across regions), newest first.
    const seen = new Set<string>()
    const sets: { name: string; releaseDate?: string }[] = []
    for (const s of (j.data ?? [])) {
      if (s.name && !seen.has(s.name)) { seen.add(s.name); sets.push({ name: s.name, releaseDate: s.releaseDate }) }
    }
    return NextResponse.json({ sets }, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch {
    return NextResponse.json({ sets: [] })
  }
}
