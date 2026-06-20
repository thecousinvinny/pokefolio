import { NextRequest, NextResponse } from 'next/server'

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

type Vertex = { x?: number; y?: number }
type Annotation = { description: string; boundingPoly: { vertices: Vertex[] } }

function extractCardName(annotations: Annotation[], imageHeight: number): string {
  // annotations[0] is the full text blob — skip it, use [1..N] for individual words
  const words = annotations.slice(1).filter(a =>
    a.description.length > 1 && /^[A-Za-zÀ-ö]/.test(a.description)
  )
  if (!words.length) return ''

  const withSize = words.map(a => {
    const ys = a.boundingPoly.vertices.map(v => v.y ?? 0)
    const xs = a.boundingPoly.vertices.map(v => v.x ?? 0)
    const h = Math.max(...ys) - Math.min(...ys)
    return { text: a.description, h, midY: (Math.max(...ys) + Math.min(...ys)) / 2, minX: Math.min(...xs), maxY: Math.max(...ys) }
  })

  // Ignore bottom third — attacks, flavor text, set number are all down there
  const upper = withSize.filter(w => w.maxY < imageHeight * 0.67)
  if (!upper.length) return ''

  // Anchor on tallest word (largest font = card name)
  const anchor = [...upper].sort((a, b) => b.h - a.h)[0]

  const line = upper
    .filter(w => Math.abs(w.midY - anchor.midY) < anchor.h * 0.65 && w.h > anchor.h * 0.45)
    .sort((a, b) => a.minX - b.minX)
    .map(w => w.text)
    .join(' ')
    .replace(/\s+HP\s*\d.*/i, '')
    .replace(/\s+\d{1,3}\s*$/, '')
    .trim()

  return line || anchor.text
}

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
    return NextResponse.json({ error: `Vision API ${visionRes.status}` }, { status: 502 })
  }

  const body = await visionRes.json()
  const annotations: Annotation[] = body.responses?.[0]?.textAnnotations ?? []
  if (!annotations.length) return NextResponse.json({ name: '' })

  const imageHeight = Math.max(...annotations[0].boundingPoly.vertices.map(v => v.y ?? 0))
  const name = extractCardName(annotations, imageHeight)
  return NextResponse.json({ name })
}
