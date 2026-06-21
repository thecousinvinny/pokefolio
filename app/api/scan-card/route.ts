import { NextRequest, NextResponse } from 'next/server'
import { searchCardsFlexible } from '@/lib/tcg'
import { searchCatalog, resolveCatalogByNumberTotal, catalogNameExists } from '@/lib/catalog'

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

// --- Pokémon species name dictionary for fuzzy OCR correction ---
// Fetched once from PokéAPI on first scan request, then held in memory for the lifetime
// of the serverless instance (equivalent to localStorage for server-side code).
let _pokemonNames: string[] | null = null

async function getPokemonNames(): Promise<string[]> {
  if (_pokemonNames) return _pokemonNames
  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1200', {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return []
    const data = await res.json() as { results: { name: string }[] }
    // "mr-mime" → "Mr Mime", "ho-oh" → "Ho Oh" (close enough for Levenshtein matching)
    _pokemonNames = data.results.map(p =>
      p.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    )
  } catch {
    _pokemonNames = []
  }
  return _pokemonNames!
}

function levenshtein(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      next[j] = a[i - 1] === b[j - 1]
        ? row[j - 1]
        : 1 + Math.min(row[j - 1], row[j], next[j - 1])
    }
    row = next
  }
  return row[b.length]
}

// Snaps the OCR'd name to the nearest Pokémon species name when the edit distance
// is small enough to be a plausible OCR error. Preserves any trailing suffix (ex/VMAX…).
async function fuzzySnapName(raw: string): Promise<string> {
  if (!raw || raw.length < 3) return raw
  const names = await getPokemonNames()
  if (!names.length) return raw

  const suffixMatch = raw.match(SUFFIX_RE)
  const base = suffixMatch ? raw.slice(0, suffixMatch.index) : raw
  const suffix = suffixMatch ? suffixMatch[0] : ''

  const input = base.toLowerCase()
  let bestName = ''
  let bestDist = Infinity

  for (const name of names) {
    const d = levenshtein(input, name.toLowerCase())
    if (d < bestDist) { bestDist = d; bestName = name }
  }

  // Threshold: at most 3 edits, and no more than 35% of the base name length.
  // Keeps trainer/energy names (longer, more unique) from snapping to a Pokémon name.
  const threshold = Math.min(3, Math.floor(base.length * 0.35))
  if (bestDist <= threshold) return bestName + suffix

  // Full-string snap failed — try each token individually (longest first).
  // Catches "VATAR Leafeon" where the corrupted suffix token survived zone filtering
  // but the real Pokémon name is right there as another token.
  const tokens = base.split(/\s+/).filter(t => t.length >= 3).sort((a, b) => b.length - a.length)
  for (const token of tokens) {
    const tInput = token.toLowerCase()
    let tBest = '', tBestDist = Infinity
    for (const name of names) {
      const d = levenshtein(tInput, name.toLowerCase())
      if (d < tBestDist) { tBestDist = d; tBest = name }
    }
    const tThreshold = Math.min(3, Math.floor(token.length * 0.35))
    if (tBestDist <= tThreshold) return tBest + suffix
  }

  return raw
}

const SUFFIX_RE = /\s+(VMAX|VSTAR|V-?UNION|GX|EX|ex|V|TAG\s*TEAM)\s*$/i
// Standalone tokens that are never the Pokémon's base name — used to skip whole lines
// in the line-based fallback. Includes bare "V" (Leafeon V, etc.).
const STAGE_RE = /^(BASIC|STAGE\s*\d+|V|V-?UNION|VMAX|VSTAR|GX|EX|TAG\s*TEAM)$/i
// Evolution-stage labels only — these are dropped outright (never a card-name suffix).
const BASIC_STAGE_RE = /^(BASIC|STAGE\s*\d+)$/i
const HP_TOKEN_RE = /^(HP|\d+)$/i
// Splits fused suffix tokens: "ReshiramEX" → "Reshiram EX", "CharizardVMAX" → "Charizard VMAX"
const FUSED_SUFFIX_RE = /([A-Za-z])(VMAX|VSTAR|VUNION|GX|EX|ex)(?=\s|$)/g

// Canonical card-name suffixes. Long ones (VMAX/VSTAR/VUNION) tolerate 1 OCR edit
// so garbled reads like "VATAR"/"VSTAF"/"VMAk" still snap; short ones (V/GX/EX)
// require an exact match since a 1-edit window would swallow real letters.
const FUZZY_SUFFIXES = ['VSTAR', 'VMAX', 'VUNION']

// Maps a single OCR token to a canonical suffix, or null if it isn't one.
// Preserves ex/EX casing (modern "ex" vs legacy "EX" are different cards).
function normalizeSuffix(token: string): string | null {
  if (/^ex$/.test(token)) return 'ex'
  if (/^EX$/.test(token)) return 'EX'
  const t = token.toUpperCase().replace(/[^A-Z]/g, '')
  if (!t) return null
  if (t === 'V') return 'V'
  if (t === 'GX') return 'GX'
  if (t === 'VUNION') return 'V-UNION'
  if (t === 'VSTAR' || t === 'VMAX') return t
  for (const s of FUZZY_SUFFIXES) {
    if (t.length >= 4 && levenshtein(t, s) <= 1) return s === 'VUNION' ? 'V-UNION' : s
  }
  return null
}

// Strips HP (label + its 2–3 digit value, whether spaced or fused like "Garchompex320"),
// splits fused suffixes ("Garchompex" → "Garchomp ex"), and tidies whitespace.
// Pokémon/Trainer/Energy names contain no 2–3 digit numbers, so removing them is safe.
function cleanNameString(s: string): string {
  return s
    .replace(/\bHP\b/gi, ' ')             // HP label
    .replace(/(\d{2,3})(?=\D|$)/g, ' ')    // HP value — fused or standalone
    .replace(FUSED_SUFFIX_RE, '$1 $2')     // "Garchompex" → "Garchomp ex"
    .replace(/\s+\d\s*$/, '')              // stray trailing single digit
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Pulls any suffix token out of a name, drops every suffix-like token, and reattaches
// the canonical suffix at the end. "VSTAR Leafeon" / "Leafeon VSTAR" → "Leafeon VSTAR";
// a plain "Leafeon" is returned unchanged (no suffix detected).
function canonicalizeSuffix(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean)
  let suffix: string | null = null
  const base: string[] = []
  for (const t of tokens) {
    const s = normalizeSuffix(t)
    if (s) { if (!suffix) suffix = s; continue }
    base.push(t)
  }
  const baseName = base.join(' ').trim()
  if (!baseName) return name.trim()   // all tokens looked like suffixes — bail, keep original
  return suffix ? `${baseName} ${suffix}` : baseName
}

interface WordAnnotation {
  description: string
  boundingPoly: { vertices: Array<{ x?: number; y?: number }> }
}

function midY(w: WordAnnotation): number {
  const ys = w.boundingPoly.vertices.map(v => v.y ?? 0)
  return (Math.min(...ys) + Math.max(...ys)) / 2
}

function minX(w: WordAnnotation): number {
  return Math.min(...w.boundingPoly.vertices.map(v => v.x ?? 0))
}

// Bounding-box height ≈ font size. The card name is the largest text up top;
// "Evolves from …", HP, set codes and description text are all smaller.
function boxH(w: WordAnnotation): number {
  const ys = w.boundingPoly.vertices.map(v => v.y ?? 0)
  return Math.max(...ys) - Math.min(...ys)
}

// Parse name from the top zone and number from the bottom zone using bounding boxes.
// Falls back to line-based parsing when no position data is available.
function parseCardText(annotations: WordAnnotation[], fullText: string): { rawName: string; rawNumber: string; rawTotal: string } {
  if (annotations.length < 2) return parseLinesBased(fullText)

  const words = annotations.slice(1)
  const allY = words.flatMap(w => w.boundingPoly.vertices.map(v => v.y ?? 0))
  const imgHeight = Math.max(...allY, 1)

  // TOP zone: top 30%. Within it the name is the LARGEST font — keep only
  // name-sized tokens so "Evolves from Gabite", HP, set codes and any stray
  // middle-description text that creeps in are dropped (fixes Garchomp→Gabite
  // and middle-text captures).
  const topWords = words.filter(w => midY(w) < imgHeight * 0.30)
  const maxH = topWords.length ? Math.max(...topWords.map(boxH)) : 0
  const bigWords = topWords.filter(w => maxH > 0 && boxH(w) >= maxH * 0.6)

  // The name sits on the topmost big-text line; read it left-to-right.
  let nameTokens: string[] = []
  if (bigWords.length) {
    bigWords.sort((a, b) => midY(a) - midY(b))
    const nameY = midY(bigWords[0])
    nameTokens = bigWords
      .filter(w => Math.abs(midY(w) - nameY) <= maxH * 0.7)   // same line as the name
      .sort((a, b) => minX(a) - minX(b))
      .map(w => w.description)
      .filter(t => !BASIC_STAGE_RE.test(t) && !HP_TOKEN_RE.test(t))
  }
  const rawName = canonicalizeSuffix(cleanNameString(nameTokens.join(' ')))

  // BOTTOM zone: bottom 15% — card number (e.g. 025/198, TG01/TG30, SV001/SV122)
  const bottomText = words
    .filter(w => midY(w) > imgHeight * 0.85)
    .sort((a, b) => minX(a) - minX(b))
    .map(w => w.description)
    .join(' ')

  const { rawNumber, rawTotal } = parseNumber(bottomText)

  // If position parsing found nothing, fall back
  if (!rawName) return parseLinesBased(fullText)

  return { rawName, rawNumber, rawTotal }
}

// Card number from the bottom text. Handles the standard "025/198" form and the
// promo form with no denominator ("SWSH291", "SVP123", "SM210").
function parseNumber(text: string): { rawNumber: string; rawTotal: string } {
  const slash = text.match(/([A-Z]{0,6}\d{1,3})\/([A-Z]{0,6}\d{2,3})/)
  if (slash) return { rawNumber: slash[1], rawTotal: slash[2].replace(/^[A-Z]+/, '') }
  // Promo: 2–5 uppercase letters + digits, no "/total"
  const promo = text.match(/\b([A-Z]{2,5}\d{1,3})\b/)
  return { rawNumber: promo ? promo[1] : '', rawTotal: '' }
}

function parseLinesBased(fullText: string): { rawName: string; rawNumber: string; rawTotal: string } {
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 1 && /^[A-Za-z]/.test(l))
  const nameLine = lines.find(l => !STAGE_RE.test(l)) ?? lines[0] ?? ''
  const rawName = canonicalizeSuffix(
    cleanNameString(nameLine.replace(/^(BASIC|STAGE\s*\d+)\s+/i, ''))
  )
  const { rawNumber, rawTotal } = parseNumber(fullText)
  return { rawName, rawNumber, rawTotal }
}

async function trySearch(query: string, number?: string): Promise<boolean> {
  try {
    const r = await searchCardsFlexible({ query, number, pageSize: 1, skipEnrich: true })
    return r.data.length > 0
  } catch {
    return false
  }
}

// set.total + card number → returns the API name when exactly one card matches.
// Only runs for plain-digit numbers (skips TG01, SV001 subsets).
async function resolveBySetTotal(cardNumber: string, total: string): Promise<string | null> {
  if (!/^\d+$/.test(cardNumber) || !/^\d+$/.test(total)) return null
  try {
    const r = await searchCardsFlexible({ setTotal: total, number: cardNumber, pageSize: 3, skipEnrich: true })
    return r.data.length === 1 ? r.data[0].name : null
  } catch {
    return null
  }
}

async function verifyName(name: string, number: string, total: string): Promise<{ name: string; number: string }> {
  // ── Catalog-first: instant local verification (covers virtually all modern scans) ──
  try {
    // a. number + printed total → authoritative exact card
    if (number && total) {
      const hit = await resolveCatalogByNumberTotal(number, total)
      if (hit) return { name: hit, number }
    }
    // b. name + number → confirm/correct against the exact printing
    if (name && number) {
      const r = await searchCatalog({ query: name, number, pageSize: 2 })
      if (r && r.data.length) return { name: r.data[0].name, number }
    }
    // c. name exists in catalog → trust the OCR name. Drop the number so the
    //    client's follow-up search stays name-only (a promo number not in the
    //    catalog would otherwise force a slow live lookup).
    if (name && await catalogNameExists(name)) return { name, number: '' }
  } catch { /* catalog unavailable — fall through to live */ }

  // ── Live fallback: pokemontcg.io cascade for cards not in the catalog ──
  return verifyNameLive(name, number, total)
}

async function verifyNameLive(name: string, number: string, total: string): Promise<{ name: string; number: string }> {
  // Steps 0 + 1 run in parallel — most successful scans exit here in one round-trip
  const [resolved, exactHit] = await Promise.all([
    number && total ? resolveBySetTotal(number, total) : Promise.resolve(null),
    name && number  ? trySearch(name, number)           : Promise.resolve(false),
  ])
  if (resolved) return { name: resolved, number }
  if (exactHit)  return { name, number }

  if (!name) return { name, number }

  // 2. Name only (number may be misread)
  if (await trySearch(name)) return { name, number: '' }

  // 3. Strip known trailing suffix (ex/V/VMAX etc. misread entirely)
  const stripped = name.replace(SUFFIX_RE, '').trim()
  if (stripped && stripped !== name && await trySearch(stripped)) return { name: stripped, number: '' }

  // 4. First word only — handles suffix OCR'd as garbage word ("Reshiram X" → "Reshiram")
  const firstWord = name.split(/\s+/)[0]
  if (firstWord !== name && firstWord.length >= 3 && await trySearch(firstWord)) {
    return { name: firstWord, number: '' }
  }

  // 5. Progressive right-trim — handles garbage fused to name ("ReshiramX" → "Reshiram")
  //    Only when there's no space (step 4 already handles the spaced case)
  if (!name.includes(' ')) {
    for (let trim = 1; trim <= 3; trim++) {
      const shorter = name.slice(0, -trim)
      if (shorter.length >= 4 && await trySearch(shorter)) return { name: shorter, number: '' }
    }
  }

  // 6. Nothing matched — return original so user can edit
  return { name, number }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_VISION_API_KEY
    if (!apiKey) return NextResponse.json({ name: '', number: '', debug: 'no api key' })

    const { imageBase64 } = await req.json() as { imageBase64?: string }
    if (!imageBase64) return NextResponse.json({ name: '', number: '', debug: 'no image' })

    const visionRes = await fetch(`${VISION_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ image: { content: imageBase64 }, features: [{ type: 'TEXT_DETECTION', maxResults: 50 }] }],
      }),
    })

    if (!visionRes.ok) return NextResponse.json({ name: '', number: '', debug: `vision ${visionRes.status}` })

    const body = await visionRes.json()
    const annotations: WordAnnotation[] = body.responses?.[0]?.textAnnotations ?? []
    const fullText: string = annotations[0]?.description ?? ''

    const { rawName, rawNumber, rawTotal } = parseCardText(annotations, fullText)
    const snappedName = rawName ? await fuzzySnapName(rawName) : rawName
    // 10-second budget for the entire verify cascade; falls back to the snapped OCR name
    const { name, number } = await Promise.race([
      verifyName(snappedName, rawNumber, rawTotal),
      new Promise<{ name: string; number: string }>(resolve =>
        setTimeout(() => resolve({ name: snappedName, number: rawNumber }), 10_000)
      ),
    ])

    const debug = `ocr:${rawName}→snap:${snappedName} #${rawNumber}/${rawTotal} | verified:${name}#${number} | raw:${fullText.slice(0, 60)}`
    console.log(debug)
    return NextResponse.json({ name, number, debug })
  } catch (err) {
    console.error('scan-card error:', err)
    return NextResponse.json({ name: '', number: '', debug: String(err) })
  }
}
