// Records one market-price row per catalog card for today into price_snapshots.
// Idempotent (upsert on card_id+day) — safe to re-run. Builds price history
// over time. Run daily via .github/workflows/snapshot-prices.yml.
//
//   node scripts/snapshot-prices.mjs
//
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// ── env (process.env wins; .env.local fills gaps locally) ─────────────────────
const env = { ...process.env }
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
} catch { /* CI: rely on process.env */ }

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const today = new Date().toISOString().slice(0, 10)

// ── tcgcsv (mirrors lib/tcgcsv.ts; standalone so the script has no TS deps) ────
const TCGCSV = 'https://tcgcsv.com'
const ua = { 'User-Agent': 'CATCHM/1.0.0' }
const SET_ALIASES = {
  'swsh black star promos': 'Sword & Shield Promo Cards',
  'scarlet & violet black star promos': 'Scarlet & Violet Promo Cards',
  'scarlet & violet promos': 'Scarlet & Violet Promo Cards',
}
const normSet = s => s.toLowerCase().replace(/^[a-z0-9&]+:\s*/, '').replace(/[^a-z0-9]+/g, '')
const normNum = s => s.split('/')[0].trim().replace(/^0+(?=\d)/, '')

async function csvGet(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`${TCGCSV}${path}`, { headers: ua })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      return Array.isArray(d) ? d : (d.results ?? d)
    } catch {
      if (attempt === 3) return null
      await new Promise(res => setTimeout(res, 1000 * (attempt + 1)))
    }
  }
}

let _groups = null
async function groups() { if (!_groups) _groups = (await csvGet('/tcgplayer/3/groups')) ?? []; return _groups }

async function resolveGroupId(setName) {
  const aliased = SET_ALIASES[setName.toLowerCase().trim()] ?? setName
  const target = normSet(aliased)
  if (!target) return null
  const g = await groups()
  const exact = g.find(x => normSet(x.name) === target)
  if (exact) return exact.groupId
  return g.find(x => { const n = normSet(x.name); return n && (n.includes(target) || target.includes(n)) })?.groupId ?? null
}

function pickBest(prices) {
  if (!prices.length) return null
  const pool = prices.filter(p => p.marketPrice != null)
  const src = pool.length ? pool : prices
  return src.find(p => /holo/i.test(p.subTypeName) && !/reverse/i.test(p.subTypeName))
    ?? src.find(p => /normal/i.test(p.subTypeName)) ?? src[0]
}

// set name → Map(cardNumber → market)
async function setPriceMap(setName) {
  const out = new Map()
  const gid = await resolveGroupId(setName)
  if (!gid) return out
  const [prices, products] = await Promise.all([
    csvGet(`/tcgplayer/3/${gid}/prices`),
    csvGet(`/tcgplayer/3/${gid}/products`),
  ])
  if (!prices?.length || !products?.length) return out
  const byProduct = new Map()
  for (const p of prices) { const a = byProduct.get(p.productId); if (a) a.push(p); else byProduct.set(p.productId, [p]) }
  for (const prod of products) {
    const num = prod.extendedData?.find(e => e.name === 'Number')?.value
    if (!num) continue
    const best = pickBest(byProduct.get(prod.productId) ?? [])
    if (best?.marketPrice != null) out.set(normNum(num), best.marketPrice)
  }
  return out
}

// ── main ──────────────────────────────────────────────────────────────────────
async function allCatalogCards() {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('card_catalog').select('id,number,set_name').range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

console.log(`• Snapshot date: ${today}`)
const cards = await allCatalogCards()
console.log(`• ${cards.length} catalog cards`)

// group by set so we fetch each set's prices once
const bySet = new Map()
for (const c of cards) {
  if (!c.set_name || !c.number) continue
  if (!bySet.has(c.set_name)) bySet.set(c.set_name, [])
  bySet.get(c.set_name).push(c)
}

const rows = []
let setIdx = 0
for (const [setName, setCards] of bySet) {
  setIdx++
  const map = await setPriceMap(setName)
  let priced = 0
  for (const c of setCards) {
    const market = map.get(normNum(c.number))
    if (market != null) { rows.push({ card_id: c.id, day: today, market }); priced++ }
  }
  console.log(`  [${setIdx}/${bySet.size}] ${setName.padEnd(34)} ${priced}/${setCards.length} priced`)
}

console.log(`• Writing ${rows.length} snapshots…`)
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('price_snapshots').upsert(rows.slice(i, i + 500), { onConflict: 'card_id,day' })
  if (error) { console.error('✗ upsert failed:', error.message); process.exit(1) }
}
console.log(`✓ Done. Recorded ${rows.length} price snapshots for ${today}.`)
