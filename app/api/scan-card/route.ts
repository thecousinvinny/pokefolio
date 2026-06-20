import { NextRequest, NextResponse } from 'next/server'
import { searchCardsFlexible } from '@/lib/tcg'

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

// Strip trailing card type suffixes that OCR might misread, causing 0 results
const SUFFIX_RE = /\s+(ex|V|VMAX|VSTAR|VUNION|GX|EX|TAG\s*TEAM)\s*$/i

async function trySearch(query: string, number?: string): Promise<boolean> {
  try {
    const r = await searchCardsFlexible({ query, number, pageSize: 1, skipEnrich: true })
    return r.data.length > 0
  } catch {
    return false
  }
}

// Returns the name+number pair that actually yields TCG results,
// falling back through progressively looser queries.
async function verifyName(name: string, number: string): Promise<{ name: string; number: string }> {
  if (!name) return { name, number }

  // 1. Exact: name + card number
  if (number && await trySearch(name, number)) return { name, number }

  // 2. Name only (number may be misread)
  if (await trySearch(name)) return { name, number: '' }

  // 3. Strip trailing suffix (ex/V/VMAX etc.) — OCR misread or absent suffix
  const stripped = name.replace(SUFFIX_RE, '').trim()
  if (stripped && stripped !== name && await trySearch(stripped)) return { name: stripped, number: '' }

  // 4. Nothing matched — return original so user can edit
  return { name, number }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_VISION_API_KEY
    if (!apiKey) {
      return NextResponse.json({ name: '', number: '', debug: 'no api key' })
    }

    const { imageBase64 } = await req.json() as { imageBase64?: string }
    if (!imageBase64) {
      return NextResponse.json({ name: '', number: '', debug: 'no image' })
    }

    const visionRes = await fetch(`${VISION_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ image: { content: imageBase64 }, features: [{ type: 'TEXT_DETECTION', maxResults: 50 }] }],
      }),
    })

    if (!visionRes.ok) {
      return NextResponse.json({ name: '', number: '', debug: `vision ${visionRes.status}` })
    }

    const body = await visionRes.json()
    const fullText: string = body.responses?.[0]?.textAnnotations?.[0]?.description ?? ''

    const STAGE_ONLY = /^(BASIC|STAGE\s*\d+|V-?UNION|VMAX|VSTAR|GX|EX|TAG\s*TEAM)$/i
    const lines = fullText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 1 && /^[A-Za-z]/.test(l))
    const nameLine = lines.find(l => !STAGE_ONLY.test(l)) ?? lines[0] ?? ''
    const rawName = nameLine
      .replace(/^(BASIC|STAGE\s*\d+|V-?UNION|VMAX|VSTAR|GX|EX|TAG\s*TEAM)\s+/i, '')
      .replace(/\s+HP\s*\d.*/i, '')
      .replace(/\s+\d{1,3}\s*$/, '')
      .trim()

    const numberMatch = fullText.match(/\b([A-Z]{0,3}\d{1,3})\/[A-Z]{0,3}\d{2,3}\b/)
    const rawNumber = numberMatch ? numberMatch[1] : ''

    const { name, number } = await verifyName(rawName, rawNumber)

    const debug = `raw:${fullText.slice(0, 80)} | ocr:${rawName}#${rawNumber} | verified:${name}#${number}`
    console.log(debug)
    return NextResponse.json({ name, number, debug })
  } catch (err) {
    console.error('scan-card error:', err)
    return NextResponse.json({ name: '', number: '', debug: String(err) })
  }
}
