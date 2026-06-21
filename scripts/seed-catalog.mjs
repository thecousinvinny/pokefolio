// Seeds card_catalog with modern-era Pokémon cards (SWSH + SV, release date >= 2020).
// Static identity/art only — no prices. Idempotent: upserts on id, safe to re-run
// (run again quarterly when new sets drop).
//
//   node scripts/seed-catalog.mjs
//
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// ── env ───────────────────────────────────────────────────────────────────────
// Real environment wins (GitHub Actions / Vercel); .env.local fills gaps locally.
const env = { ...process.env }
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].trim()
  }
} catch { /* no .env.local in CI — rely on process.env */ }
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY
const TCG_KEY      = env.POKEMONTCG_API_KEY
const MODERN_CUTOFF = '2020-01-01'   // SWSH base onward

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const BASE = 'https://api.pokemontcg.io/v2'
const tcgHeaders = TCG_KEY ? { 'X-Api-Key': TCG_KEY } : {}

// ── helpers ───────────────────────────────────────────────────────────────────
async function tcgGet(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, { headers: tcgHeaders })
      if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === 3) throw err
      await sleep(1000 * (attempt + 1))
    }
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const toDate = s => s ? s.replace(/\//g, '-') : null   // "2023/03/31" → "2023-03-31"

function toRow(c) {
  return {
    id: c.id,
    name: c.name,
    supertype: c.supertype ?? null,
    types: c.types ?? null,
    rarity: c.rarity ?? null,
    number: c.number ?? null,
    printed_total: c.set?.printedTotal ?? null,
    set_id: c.set?.id ?? null,
    set_name: c.set?.name ?? null,
    set_release_date: toDate(c.set?.releaseDate),
    image_sm: c.images?.small ?? null,
    image_lg: c.images?.large ?? null,
    artist: c.artist ?? null,
    hp: c.hp ?? null,
    flavor_text: c.flavorText ?? null,
  }
}

async function upsertBatch(rows) {
  // chunk to keep request bodies sane
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase.from('card_catalog').upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(`upsert failed: ${error.message}`)
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
const SELECT = 'id,name,supertype,types,rarity,number,set,images,artist,hp,flavorText'

console.log('• Fetching set list…')
const setsRes = await tcgGet('/sets?pageSize=250&orderBy=releaseDate')
const modernSets = (setsRes.data ?? [])
  .filter(s => s.releaseDate && toDate(s.releaseDate) >= MODERN_CUTOFF)
  .sort((a, b) => toDate(a.releaseDate) < toDate(b.releaseDate) ? 1 : -1)

console.log(`• ${modernSets.length} modern sets (release >= ${MODERN_CUTOFF})`)

let total = 0
for (const [idx, set] of modernSets.entries()) {
  let page = 1, setCount = 0
  for (;;) {
    const json = await tcgGet(`/cards?q=set.id:${set.id}&select=${SELECT}&page=${page}&pageSize=250`)
    const cards = json.data ?? []
    if (cards.length === 0) break
    await upsertBatch(cards.map(toRow))
    setCount += cards.length
    if (cards.length < 250) break
    page++
  }
  total += setCount
  console.log(`  [${idx + 1}/${modernSets.length}] ${set.name.padEnd(30)} +${setCount}  (running: ${total})`)
}

const { count } = await supabase.from('card_catalog').select('*', { count: 'exact', head: true })
console.log(`\n✓ Done. Seeded ${total} cards this run. card_catalog now holds ${count} rows.`)
