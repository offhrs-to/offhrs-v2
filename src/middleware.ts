import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Supabase session refresh (must run first to keep tokens fresh)
  const supabaseResponse = await updateSession(request)

  // Check if the path starts with /admin
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Get the Authorization header
    const authHeader = request.headers.get('authorization')

    // Get admin credentials from environment variables
    const adminUser = process.env.ADMIN_USER
    const adminPassword = process.env.ADMIN_PASSWORD

    // If credentials are not configured, deny access
    if (!adminUser || !adminPassword) {
      return new NextResponse('Admin credentials not configured', {
        status: 500,
      })
    }

    // If no authorization header, request authentication
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
      })
    }

    // Extract and decode credentials
    try {
      const base64Credentials = authHeader.split(' ')[1]
      if (!base64Credentials) {
        return new NextResponse('Authentication required', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Secure Area"',
          },
        })
      }

      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
      const [username, password] = credentials.split(':')

      // Verify credentials
      if (!username || !password || username !== adminUser || password !== adminPassword) {
        return new NextResponse('Invalid credentials', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="Secure Area"',
          },
        })
      }
    } catch (error) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
      })
    }
  }

  // Allow request to proceed (use supabaseResponse to preserve auth cookies)
  return supabaseResponse
}

// Run on all routes except static files (for Supabase session refresh and route protection)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
