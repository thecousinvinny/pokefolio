import { NextRequest, NextResponse } from 'next/server'

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Vision API not configured' }, { status: 503 })
  }

  const { imageBase64 } = await req.json() as { imageBase64?: string }
  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const visionRes = await fetch(`${VISION_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ image: { content: imageBase64 }, features: [{ type: 'TEXT_DETECTION', maxResults: 50 }] }],
    }),
  })

  if (!visionRes.ok) {
    console.error('Vision API error', visionRes.status, await visionRes.text())
    return NextResponse.json({ error: `Vision API ${visionRes.status}` }, { status: 502 })
  }

  const body = await visionRes.json()
  // annotations[0].description is all detected text in reading order (top→bottom, left→right)
  // The card name is at the top of the card so it appears first
  const fullText: string = body.responses?.[0]?.textAnnotations?.[0]?.description ?? ''
  console.log('Vision raw:', JSON.stringify(fullText.slice(0, 300)))

  const name = fullText
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 1 && /^[A-Za-zÀ-ö]/.test(l))
    .at(0)
    ?.replace(/\s+HP\s*\d.*/i, '')
    .replace(/\s+\d{1,3}\s*$/, '')
    .trim() ?? ''

  console.log('Extracted name:', JSON.stringify(name))
  return NextResponse.json({ name })
}
