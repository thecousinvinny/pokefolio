import { NextRequest, NextResponse } from 'next/server'
import { searchCardsFlexible } from '@/lib/tcg'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  try {
    const data = await searchCardsFlexible({
      query: searchParams.get('q') ?? undefined,
      set: searchParams.get('set') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      rarity: searchParams.get('rarity') ?? undefined,
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 20),
    })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
