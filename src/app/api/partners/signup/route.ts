import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'

const signupSchema = z.object({
  business_name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().max(30).optional(),
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

async function rollbackSignup(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string) {
  // Remove profile first, then auth user, so retries are clean.
  await admin.from('vendor_profiles').delete().eq('user_id', userId)
  await admin.auth.admin.deleteUser(userId)
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const parsed = signupSchema.safeParse(raw)
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors
      return NextResponse.json({ error: 'Validation failed', fields: msg }, { status: 400 })
    }

    const { business_name, email, password, phone } = parsed.data

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Create Supabase auth user (email + password, not OAuth)
    // createUser returns an error if the email is already registered
    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    })

    if (createError || !authData.user) {
      if (createError?.message?.includes('already registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 500 })
    }

    const userId = authData.user.id

    // Generate unique slug from business name
    let baseSlug = slugify(business_name)
    let slug = baseSlug
    let attempt = 0
    while (true) {
      const { data: conflict } = await admin
        .from('vendor_profiles')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!conflict) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    // Create vendor profile
    const { error: profileError } = await admin.from('vendor_profiles').insert({
      user_id: userId,
      business_name,
      slug,
      phone: phone ?? null,
      status: 'pending',
    })

    if (profileError) {
      // Clean up auth user on profile failure
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Failed to create vendor profile' }, { status: 500 })
    }

    // Verification email is mandatory before checkout.
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      await rollbackSignup(admin, userId)
      return NextResponse.json(
        { error: 'Email service is not configured. Please contact support.' },
        { status: 503 }
      )
    }

    const resend = new Resend(resendKey)
    const from = process.env.RESEND_FROM_EMAIL ?? 'offhrs <noreply@offhrs.app>'

    // Generate a Supabase email verification token
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: `${APP_URL}/partners/auth/callback`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Signup generateLink failed:', linkError?.message ?? 'Missing action link')
      await rollbackSignup(admin, userId)
      return NextResponse.json(
        { error: 'Failed to create verification link. Please try again.' },
        { status: 502 }
      )
    }

    const actionUrl = new URL(linkData.properties.action_link)
    const token = actionUrl.searchParams.get('token')
    const tokenHash = actionUrl.searchParams.get('token_hash')
    const otpToken = tokenHash ?? token
    const otpType = actionUrl.searchParams.get('type') ?? 'signup'

    if (!otpToken) {
      console.error('Signup generateLink failed: Missing token/token_hash')
      await rollbackSignup(admin, userId)
      return NextResponse.json(
        { error: 'Failed to create verification link. Please try again.' },
        { status: 502 }
      )
    }

    // Always verify on our app domain (not Supabase auth domain).
    const verifyUrl = `${APP_URL}/api/partners/verify-email?token_hash=${encodeURIComponent(otpToken)}&type=${encodeURIComponent(otpType)}`

    const { error: sendError } = await resend.emails.send({
      from,
      to: email,
      subject: `Verify your email — offhrs Partners`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="font-size:22px;font-weight:700;color:#1a1a1a;margin-bottom:8px;">
            Welcome to offhrs, ${business_name}!
          </h2>
          <p style="color:#555;font-size:14px;line-height:1.6;">
            Click the button below to verify your email address and continue setting up your account.
          </p>
          <a href="${verifyUrl}"
             style="display:inline-block;margin-top:24px;padding:12px 28px;background:#5D755D;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
            Verify email
          </a>
          <p style="margin-top:32px;color:#999;font-size:12px;">
            If you didn't sign up for offhrs Partners, you can safely ignore this email.
          </p>
        </div>
      `,
    })

    if (sendError) {
      console.error('Signup verification email failed:', sendError.message)
      await rollbackSignup(admin, userId)
      return NextResponse.json(
        { error: 'Could not send verification email. Please try again in a minute.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Partner signup error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

