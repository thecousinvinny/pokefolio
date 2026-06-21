import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = {}
for (const l of readFileSync(new URL('../.env.local', import.meta.url),'utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) env[m[1]]=m[2].trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth:{persistSession:false} })
async function all(table, cols){ const out=[]; for(let f=0;;f+=1000){const{data,error}=await sb.from(table).select(cols).range(f,f+999); if(error)throw error; out.push(...data); if(data.length<1000)break} return out }

// ── replicate resolveGroupId exactly ──
const SET_ALIASES = {
  'swsh black star promos': 'Sword & Shield Promo Cards',
  'scarlet & violet black star promos': 'Scarlet & Violet Promo Cards',
  'scarlet & violet promos': 'Scarlet & Violet Promo Cards',
}
const normSet = s => s.toLowerCase().replace(/^[a-z0-9&]+:\s*/,'').replace(/[^a-z0-9]+/g,'')
const ua = { 'User-Agent': 'CATCHM/1.0.0' }
const groups = (await (await fetch('https://tcgcsv.com/tcgplayer/3/groups',{headers:ua})).json()).results || []

function resolve(setName){
  const aliased = SET_ALIASES[setName.toLowerCase().trim()] ?? setName
  const target = normSet(aliased)
  if(!target) return { path:'none' }
  let g = groups.find(x=>normSet(x.name)===target); if(g) return { path:'exact', g }
  const bt = normSet(aliased+' Base Set'); g = groups.find(x=>normSet(x.name)===bt); if(g) return { path:'base', g }
  g = groups.find(x=>{const n=normSet(x.name); return n&&(n.includes(target)||target.includes(n))}); if(g) return { path:'containment', g }
  return { path:'none' }
}

const cat = await all('card_catalog','id,set_name,rarity')
const priced = new Set((await all('price_snapshots','card_id')).map(s=>s.card_id))

// per-set tally
const sets = {}
for(const c of cat){ const s=c.set_name; sets[s]??={total:0,priced:0}; sets[s].total++; if(priced.has(c.id))sets[s].priced++ }

const rows = Object.entries(sets).map(([name,t])=>{
  const r = resolve(name)
  return { name, ...t, cov: t.priced/t.total, path: r.path, group: r.g?.name ?? '—' }
}).sort((a,b)=>a.cov-b.cov)

console.log('=== SETS BY COVERAGE (worst first) ===')
for(const r of rows){
  const flag = r.cov<0.9 ? '⚠ LOW' : r.path==='containment' ? '? containment' : ''
  console.log(`${(100*r.cov).toFixed(0).padStart(3)}%  ${r.priced}/${r.total}  ${r.name.padEnd(38)} → [${r.path}] ${r.group}  ${flag}`)
}

console.log('\n=== CONTAINMENT MATCHES (verify group is correct) ===')
rows.filter(r=>r.path==='containment').forEach(r=>console.log(`  "${r.name}" → "${r.group}"  (${(100*r.cov).toFixed(0)}%)`))
console.log('\n=== UNRESOLVED (no tcgcsv group) ===')
rows.filter(r=>r.path==='none').forEach(r=>console.log(`  "${r.name}" (${r.total} cards)`))
