import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
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

  // Allow request to proceed
  return NextResponse.next()
}

// Configure the matcher to only run on /admin paths
export const config = {
  matcher: '/admin/:path*',
}
