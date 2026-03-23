import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proxy = auth((req: NextRequest & { auth: any }) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  // Allow public auth API routes
  if (pathname.startsWith("/api/auth")) return NextResponse.next()

  // Protect API routes
  if (pathname.startsWith("/api") && !isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Protect dashboard and trades routes
  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/trades")) && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
