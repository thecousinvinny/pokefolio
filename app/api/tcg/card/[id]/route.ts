import { NextRequest, NextResponse } from 'next/server'
import { getCard } from '@/lib/tcg'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const card = await getCard(id)
    return NextResponse.json(card)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
