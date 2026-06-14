import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const toISO = (ms?: number | null) =>
  ms ? new Date(ms).toISOString() : new Date().toISOString()

const num = (v: unknown) => (v != null && v !== '' ? Number(v) : null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOwned(item: any, userId: string) {
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
function mapWishlist(item: any, userId: string) {
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

export async function POST(request: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any
  try {
    data = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const owned: unknown[] = data.owned ?? []
  const watchlist: unknown[] = data.watchlist ?? []
  const ledger: Record<string, unknown> = data.ledger ?? {}

  // Owned array → portfolio
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portfolioRows: any[] = (owned as any[]).map(item => mapOwned(item, user.id))

  // Watchlist entries that were purchased (have copyId + boughtAt) → also portfolio
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownedTcgIds = new Set((owned as any[]).map(o => o.id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of (watchlist as any[])) {
    if (item.copyId && item.boughtAt && !ownedTcgIds.has(item.id)) {
      portfolioRows.push(mapOwned(item, user.id))
    }
  }

  // Ledger entries status=owned but not in owned array (caught-all orphans)
  for (const [tcgId, entry] of Object.entries(ledger)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = entry as any
    if (e.status === 'owned' && !ownedTcgIds.has(tcgId)) {
      portfolioRows.push({
        user_id: user.id,
        tcg_id: tcgId,
        name: e.name,
        set_name: e.set,
        set_code: null,
        set_number: e.number ?? null,
        image_sm: e.img ?? null,
        rarity: e.rarity ?? null,
        set_printed_total: e.total ?? null,
        market_price: num(e.currentMarket),
        price_paid: num(e.purchasePrice),
        market_at_buy: num(e.ownPrice),
        status: 'owned',
        condition: 'NM',
        language: e.isJP ? 'JP' : 'EN',
        date_added: toISO(e.ownAt),
      })
    }
  }

  // Watchlist (not purchased) → wishlist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wishlistRows = (watchlist as any[])
    .filter(item => !(item.copyId && item.boughtAt))
    .map(item => mapWishlist(item, user.id))

  // Ledger sold entries → sales
  const salesRows = []
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

  const results: Record<string, number | string> = {}

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
