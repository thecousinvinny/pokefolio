import { NextRequest, NextResponse } from 'next/server'
import { searchCardsFlexible } from '@/lib/tcg'

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

const SUFFIX_RE = /\s+(ex|V|VMAX|VSTAR|VUNION|GX|EX|TAG\s*TEAM)\s*$/i
// Only actual stage-of-evolution labels — NOT card-name suffixes like EX/GX/VMAX/V
const STAGE_LABEL_RE = /^(BASIC|STAGE\s*\d+)$/i
// Full list used only for skipping standalone lines in line-based fallback
const STAGE_RE = /^(BASIC|STAGE\s*\d+|V-?UNION|VMAX|VSTAR|GX|EX|TAG\s*TEAM)$/i
const HP_TOKEN_RE = /^(HP|\d+)$/i
// Splits fused suffix tokens: "ReshiramEX" → "Reshiram EX", "CharizardVMAX" → "Charizard VMAX"
const FUSED_SUFFIX_RE = /([A-Za-z])(VMAX|VSTAR|VUNION|GX|EX|ex)(?=\s|$)/g

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

// Parse name from the top zone and number from the bottom zone using bounding boxes.
// Falls back to line-based parsing when no position data is available.
function parseCardText(annotations: WordAnnotation[], fullText: string): { rawName: string; rawNumber: string } {
  if (annotations.length < 2) return parseLinesBased(fullText)

  const words = annotations.slice(1)
  const allY = words.flatMap(w => w.boundingPoly.vertices.map(v => v.y ?? 0))
  const imgHeight = Math.max(...allY, 1)

  // TOP zone: top 22% — card name lives here
  const topWords = words
    .filter(w => midY(w) < imgHeight * 0.22)
    .sort((a, b) => {
      const dy = midY(a) - midY(b)
      return Math.abs(dy) > 8 ? dy : minX(a) - minX(b)
    })

  const nameTokens = topWords
    .map(w => w.description)
    .filter(t => !STAGE_LABEL_RE.test(t) && !HP_TOKEN_RE.test(t))
  const rawName = nameTokens
    .join(' ')
    .replace(FUSED_SUFFIX_RE, '$1 $2')
    .replace(/\s+HP\s*\d.*/i, '')
    .replace(/\s+\d{1,3}\s*$/, '')
    .trim()

  // BOTTOM zone: bottom 15% — card number (e.g. 025/198, TG01/TG30, SV001/SV122)
  const bottomText = words
    .filter(w => midY(w) > imgHeight * 0.85)
    .sort((a, b) => minX(a) - minX(b))
    .map(w => w.description)
    .join(' ')

  // Flexible number regex: handles plain digits, and prefixes up to 6 chars (SWSH, TG, SV, GG…)
  const numMatch = bottomText.match(/([A-Z]{0,6}\d{1,3})\/[A-Z]{0,6}\d{2,3}/)
  const rawNumber = numMatch ? numMatch[1] : ''

  // If position parsing found nothing, fall back
  if (!rawName) return parseLinesBased(fullText)

  return { rawName, rawNumber }
}

function parseLinesBased(fullText: string): { rawName: string; rawNumber: string } {
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 1 && /^[A-Za-z]/.test(l))
  const nameLine = lines.find(l => !STAGE_RE.test(l)) ?? lines[0] ?? ''
  const rawName = nameLine
    .replace(/^(BASIC|STAGE\s*\d+)\s+/i, '')
    .replace(FUSED_SUFFIX_RE, '$1 $2')
    .replace(/\s+HP\s*\d.*/i, '')
    .replace(/\s+\d{1,3}\s*$/, '')
    .trim()
  const numMatch = fullText.match(/([A-Z]{0,6}\d{1,3})\/[A-Z]{0,6}\d{2,3}/)
  const rawNumber = numMatch ? numMatch[1] : ''
  return { rawName, rawNumber }
}

async function trySearch(query: string, number?: string): Promise<boolean> {
  try {
    const r = await searchCardsFlexible({ query, number, pageSize: 1, skipEnrich: true })
    return r.data.length > 0
  } catch {
    return false
  }
}

async function verifyName(name: string, number: string): Promise<{ name: string; number: string }> {
  if (!name) return { name, number }

  // 1. Exact: name + card number
  if (number && await trySearch(name, number)) return { name, number }

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

    const { rawName, rawNumber } = parseCardText(annotations, fullText)
    const { name, number } = await verifyName(rawName, rawNumber)

    const debug = `ocr:${rawName}#${rawNumber} | verified:${name}#${number} | raw:${fullText.slice(0, 60)}`
    console.log(debug)
    return NextResponse.json({ name, number, debug })
  } catch (err) {
    console.error('scan-card error:', err)
    return NextResponse.json({ name: '', number: '', debug: String(err) })
  }
}
