import { NextResponse, type NextRequest } from 'next/server'

// Auth disabled — open access during development
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
