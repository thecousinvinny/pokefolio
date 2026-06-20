import { NextRequest, NextResponse } from 'next/server'

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

type Vertex = { x?: number; y?: number }
type Annotation = { description: string; boundingPoly: { vertices: Vertex[] } }

// Primary: find the card name by locating the tallest word bounding box
function extractBySize(annotations: Annotation[], imageHeight: number): string {
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

  const upper = withSize.filter(w => w.maxY < imageHeight * 0.67)
  if (!upper.length) return ''

  const anchor = [...upper].sort((a, b) => b.h - a.h)[0]

  return upper
    .filter(w => Math.abs(w.midY - anchor.midY) < anchor.h * 0.65 && w.h > anchor.h * 0.45)
    .sort((a, b) => a.minX - b.minX)
    .map(w => w.text)
    .join(' ')
    .replace(/\s+HP\s*\d.*/i, '')
    .replace(/\s+\d{1,3}\s*$/, '')
    .trim() || anchor.text
}

// Fallback: Vision reads top-to-bottom so the card name is typically the first line
function extractByFirstLine(fullText: string): string {
  return fullText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1 && /^[A-Za-zÀ-ö]/.test(l))
    .at(0)
    ?.replace(/\s+HP\s*\d.*/i, '')
    .replace(/\s+\d{1,3}\s*$/, '')
    .trim() ?? ''
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
    const errBody = await visionRes.text()
    console.error('Vision API error', visionRes.status, errBody)
    return NextResponse.json({ error: `Vision API ${visionRes.status}` }, { status: 502 })
  }

  const body = await visionRes.json()
  const annotations: Annotation[] = body.responses?.[0]?.textAnnotations ?? []

  if (!annotations.length) {
    console.log('Vision returned no text annotations')
    return NextResponse.json({ name: '' })
  }

  const fullText: string = annotations[0].description ?? ''
  console.log('Vision full text:', JSON.stringify(fullText.slice(0, 200)))

  const imageHeight = Math.max(...annotations[0].boundingPoly.vertices.map(v => v.y ?? 0))
  const bySize = extractBySize(annotations, imageHeight)
  const name = bySize || extractByFirstLine(fullText)

  console.log('imageHeight:', imageHeight, '| bySize:', bySize, '| final:', name)
  return NextResponse.json({ name })
}
