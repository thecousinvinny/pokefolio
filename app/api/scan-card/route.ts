import { NextRequest, NextResponse } from 'next/server'

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

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
    const name = nameLine
      .replace(/^(BASIC|STAGE\s*\d+|V-?UNION|VMAX|VSTAR|GX|EX|TAG\s*TEAM)\s+/i, '')
      .replace(/\s+HP\s*\d.*/i, '')
      .replace(/\s+\d{1,3}\s*$/, '')
      .trim()

    const numberMatch = fullText.match(/\b([A-Z]{0,3}\d{1,3})\/[A-Z]{0,3}\d{2,3}\b/)
    const number = numberMatch ? numberMatch[1] : ''

    const debug = `raw:${fullText.slice(0, 80)} | name:${name} | num:${number}`
    console.log(debug)
    return NextResponse.json({ name, number, debug })
  } catch (err) {
    console.error('scan-card error:', err)
    return NextResponse.json({ name: '', number: '', debug: String(err) })
  }
}
