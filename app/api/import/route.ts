import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function getSupabaseUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

const toISO = (ms?: number | null) =>
  ms ? new Date(ms).toISOString() : new Date().toISOString()

const num = (v: unknown): number | null =>
  v != null && v !== '' ? Number(v) : null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToPortfolio(item: any, userId: string) {
  return {
    user_id: userId,
    tcg_id: item.id,
    name: item.name,
    set_name: item.set,
    set_code: item.setId ?? null,
    set_number: item.number ?? null,
    image_sm: item.img ?? null,
    image_lg: item.imgLg ?? null,
    rarity: item.rarity ?? null,
    types: item.types ?? null,
    flavor_text: item.flavorText ?? null,
    set_printed_total: item.total ?? null,
    set_release_date: item.releaseDate ?? null,
    tcgplayer_url: item.tcgUrl ?? null,
    market_price: num(item.nmMarket ?? item.market),
    market_low: num(item.nmLow),
    market_mid: num(item.nmMid),
    market_high: num(item.nmHigh),
    market_direct_low: num(item.directLow),
    price_paid: num(item.purchasePrice),
    market_at_buy: num(item.nmMarket ?? item.market),
    bought_from: item.boughtFrom ?? null,
    is_favorite: !!item.isFav,
    status: 'owned',
    condition: 'NM',
    language: item.isJP ? 'JP' : 'EN',
    notes: item.notes ?? null,
    date_added: toISO(item.boughtAt ?? item.addedAt),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToWishlist(item: any, userId: string) {
  return {
    user_id: userId,
    tcg_id: item.id,
    name: item.name,
    set_name: item.set,
    set_code: item.setId ?? null,
    set_number: item.number ?? null,
    image_sm: item.img ?? null,
    rarity: item.rarity ?? null,
    set_printed_total: item.total ?? null,
    set_release_date: item.releaseDate ?? null,
    market_price: num(item.nmMarket ?? item.market),
    market_low: num(item.nmLow),
    market_mid: num(item.nmMid),
    market_high: num(item.nmHigh),
    market_direct_low: num(item.directLow),
    status: 'wishlist',
    condition: 'NM',
    language: 'EN',
    date_added: toISO(item.addedAt),
  }
}

// DELETE — clear all user's imported data before re-importing
export async function DELETE() {
  const { supabase, user } = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [cardsRes, salesRes] = await Promise.all([
    supabase.from('pokemon_cards').delete().eq('user_id', user.id),
    supabase.from('pokemon_sales').delete().eq('user_id', user.id),
  ])

  if (cardsRes.error) return NextResponse.json({ error: cardsRes.error.message }, { status: 500 })
  if (salesRes.error) return NextResponse.json({ error: salesRes.error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// POST — import folio JSON
export async function POST(request: NextRequest) {
  const { supabase, user } = await getSupabaseUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try {
    data = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owned: any[] = data.owned ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const watchlist: any[] = data.watchlist ?? []
  const ledger: Record<string, unknown> = data.ledger ?? {}

  // 1. owned[] → portfolio (each entry is a distinct physical copy)
  const portfolioRows = owned.map(item => mapToPortfolio(item, user.id))

  // 2. watchlist entries that were actually purchased (have copyId + boughtAt)
  //    but don't already appear in owned[] by tcg_id
  const ownedTcgIds = new Set(owned.map(o => o.id as string))
  for (const item of watchlist) {
    if (item.copyId && item.boughtAt && !ownedTcgIds.has(item.id)) {
      portfolioRows.push(mapToPortfolio(item, user.id))
    }
  }

  // 3. watchlist entries NOT purchased → wishlist
  const wishlistRows = watchlist
    .filter(item => !(item.copyId && item.boughtAt))
    .map(item => mapToWishlist(item, user.id))

  // 4. Ledger sold entries → pokemon_sales
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const salesRows: any[] = []
  for (const [tcgId, entry] of Object.entries(ledger)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = entry as any
    if (e.status === 'sold' && e.soldAt && e.soldPrice != null) {
      salesRows.push({
        user_id: user.id,
        tcg_id: tcgId,
        card_name: e.name,
        set_name: e.set ?? null,
        image_sm: e.img ?? null,
        date_sold: toISO(e.soldAt),
        sold_price: Number(e.soldPrice),
        cost_basis: 0,
        fees: 0,
        shipping: 0,
        sale_type: 'sale',
      })
    }
  }

  const results: Record<string, number> = {}

  if (portfolioRows.length > 0) {
    const { error } = await supabase.from('pokemon_cards').insert(portfolioRows)
    if (error) return NextResponse.json({ error: `portfolio: ${error.message}` }, { status: 500 })
    results.portfolio = portfolioRows.length
  }

  if (wishlistRows.length > 0) {
    const { error } = await supabase.from('pokemon_cards').insert(wishlistRows)
    if (error) return NextResponse.json({ error: `wishlist: ${error.message}` }, { status: 500 })
    results.wishlist = wishlistRows.length
  }

  if (salesRows.length > 0) {
    const { error } = await supabase.from('pokemon_sales').insert(salesRows)
    if (error) return NextResponse.json({ error: `sales: ${error.message}` }, { status: 500 })
    results.sales = salesRows.length
  }

  return NextResponse.json({ success: true, imported: results })
}
