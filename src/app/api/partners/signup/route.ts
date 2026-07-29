import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORY_ENUM } from '@/constants/categories'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { uploadVendorWorkshopImage } from '@/lib/vendor-workshop-image-storage'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { consumeRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { logSecurityEvent } from '@/lib/security-monitor'

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const SIGNUP_RATE_LIMIT_PER_MINUTE = 5

const signupSchema = z
  .object({
    business_name: z.string().min(2).max(100),
    website_url: z.string().max(500).optional().nullable(),
    categories: z.array(z.enum(CATEGORY_ENUM)).min(1).max(4),
    category_other_detail: z.string().max(200).optional().nullable(),
    location_address: z.string().min(3).max(500),
    location_lat: z.number().finite().optional().nullable(),
    location_lng: z.number().finite().optional().nullable(),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    phone: z.string().max(30).optional().nullable(),
    workshop_logo: z
      .object({
        base64: z.string().min(1),
        mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      })
      .optional(),
    turnstile_token: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.categories.includes('Other') && !data.category_other_detail?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Describe your service when you select Other',
        path: ['category_other_detail'],
      })
    }
    const hasLat = data.location_lat != null
    const hasLng = data.location_lng != null
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        message: 'Location coordinates must include both latitude and longitude',
        path: ['location_lat'],
      })
    }
  })

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function getAppUrl(request: NextRequest): string {
  // Prefer request origin so preview signups stay on the same deployment host.
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  if (host) return `${proto}://${host}`

  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

async function rollbackSignup(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  options: { deleteAuthUser: boolean }
) {
  // Always remove the vendor row we just inserted.
  await admin.from('vendor_profiles').delete().eq('user_id', userId)
  // Only delete the auth.users row if THIS request created it. Otherwise we'd
  // wipe out an existing consumer account that shares the same email.
  if (options.deleteAuthUser) {
    await admin.auth.admin.deleteUser(userId)
  }
}

/**
 * Verify a (email, password) pair against an existing Supabase auth user without
 * mutating server-side cookies/session. Returns the matching user on success.
 */
async function verifyExistingCredentials(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { error: 'auth-not-configured' as const }
  const ephemeral = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await ephemeral.auth.signInWithPassword({ email, password })
  if (error || !data?.user) return { error: 'invalid-credentials' as const }
  return { user: data.user }
}

function isAlreadyRegisteredError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? ''
  return /already.*registered/.test(message) || /already.*exists/.test(message)
}

/**
 * Look up an existing Supabase auth user by email using the admin recovery-link
 * API. We discard the resulting recovery token; the call is only used to fetch
 * the user record (including their identity providers) without paginating
 * listUsers. Returns null if no such user exists.
 */
async function lookupExistingUserByEmail(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  email: string
) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  })
  if (error || !data?.user) return null
  return data.user
}

function hasPasswordIdentity(user: {
  identities?: Array<{ provider?: string }> | null
}): boolean {
  return (user.identities ?? []).some((i) => i?.provider === 'email')
}

export async function POST(request: NextRequest) {
  try {
    const appUrl = getAppUrl(request)

    const rateLimitKey = getRateLimitKey(request)
    const rl = consumeRateLimit(`partner-signup:${rateLimitKey}`, SIGNUP_RATE_LIMIT_PER_MINUTE)
    if (!rl.allowed) {
      logSecurityEvent('warn', {
        type: 'rate_limited',
        route: '/api/partners/signup',
        ipKey: rateLimitKey,
      })
      return NextResponse.json(
        { error: 'Too many signup attempts. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      )
    }

    const raw = await request.json()
    const parsed = signupSchema.safeParse(raw)
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? 'Validation failed'
      return NextResponse.json(
        { error: first, fields: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const {
      business_name,
      website_url,
      categories,
      category_other_detail,
      location_address,
      location_lat,
      location_lng,
      email,
      password,
      phone,
      workshop_logo,
      turnstile_token,
    } = parsed.data

    const turnstileResult = await verifyTurnstileToken(turnstile_token, rateLimitKey)
    if (!turnstileResult.ok) {
      logSecurityEvent('warn', {
        type: 'bot_check_failed',
        route: '/api/partners/signup',
        ipKey: rateLimitKey,
        details: { reason: turnstileResult.reason },
      })
      return NextResponse.json(
        { error: 'Bot verification failed. Please refresh the page and try again.' },
        { status: 400 }
      )
    }

    let logoBuffer: Buffer | null = null
    if (workshop_logo) {
      try {
        logoBuffer = Buffer.from(workshop_logo.base64, 'base64')
      } catch {
        return NextResponse.json({ error: 'Invalid workshop logo encoding' }, { status: 400 })
      }
      if (logoBuffer.length > LOGO_MAX_BYTES) {
        return NextResponse.json({ error: 'Workshop logo must be 2 MB or smaller' }, { status: 400 })
      }
    }

    const bioTrim = category_other_detail?.trim() || null

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Try to create a new Supabase auth user (email + password, not OAuth).
    // If the email is already registered (e.g. as a consumer on mobile), we'll
    // fall back to attaching a vendor profile to the existing user — provided
    // the supplied password matches.
    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    })

    let userId: string
    let createdNewAuthUser = false
    let existingUserEmailConfirmed = false

    if (!createError && authData?.user) {
      userId = authData.user.id
      createdNewAuthUser = true
    } else if (isAlreadyRegisteredError(createError)) {
      // Dual-role path: same person, second role.
      const verified = await verifyExistingCredentials(email, password)
      if ('error' in verified) {
        // Password did not match. Distinguish OAuth-only accounts (e.g. Google
        // consumer signup with no password identity) from real password
        // mismatches so the OAuth case can still progress.
        const existing = await lookupExistingUserByEmail(admin, email)
        if (!existing) {
          return NextResponse.json(
            { error: 'Failed to verify existing account' },
            { status: 500 }
          )
        }
        if (hasPasswordIdentity(existing)) {
          return NextResponse.json(
            {
              error:
                'An account with this email already exists. The password you entered doesn\u2019t match. Sign in with your existing password (or reset it) and we\u2019ll add a vendor profile to that account.',
            },
            { status: 409 }
          )
        }
        // OAuth-only account: attach a password identity using the one supplied
        // in the signup form, so the partner dashboard (currently password-
        // only) is usable. Intent is still gated by the verification email
        // sent below — the vendor profile stays unverified, blocking checkout,
        // until the actual inbox owner clicks the link.
        const { error: setPwError } = await admin.auth.admin.updateUserById(existing.id, {
          password,
        })
        if (setPwError) {
          console.error('Failed to set password on OAuth-only user:', setPwError.message)
          return NextResponse.json(
            {
              error:
                'Could not link a vendor profile to this account. Please try again or contact support.',
            },
            { status: 500 }
          )
        }
        userId = existing.id
        // Force the verification-email step even though the OAuth provider
        // already confirmed the address, so the vendor profile cannot be used
        // until the actual inbox owner consents to adding a vendor role.
        existingUserEmailConfirmed = false
      } else {
        userId = verified.user.id
        existingUserEmailConfirmed = Boolean(verified.user.email_confirmed_at)
      }

      // Refuse if a vendor profile already exists for this user.
      const { data: existingVendor } = await admin
        .from('vendor_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      if (existingVendor) {
        return NextResponse.json(
          {
            error:
              'A vendor account already exists for this email. Sign in to your offhrs Partners dashboard instead.',
          },
          { status: 409 }
        )
      }
    } else {
      return NextResponse.json(
        { error: createError?.message ?? 'Failed to create user' },
        { status: 500 }
      )
    }

    // Generate unique slug from business name
    const baseSlug = slugify(business_name)
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

    // Create vendor profile. If the user already confirmed their email as a
    // consumer, the vendor row inherits that verified state so the wizard can
    // jump straight to billing.
    const websiteTrim = website_url?.trim()
    const { data: insertedProfile, error: profileError } = await admin
      .from('vendor_profiles')
      .insert({
        user_id: userId,
        business_name,
        slug,
        phone: phone?.trim() || null,
        website_url: websiteTrim ? websiteTrim : null,
        category: categories,
        location_address: location_address.trim(),
        location_lat: location_lat ?? null,
        location_lng: location_lng ?? null,
        bio: bioTrim,
        status: 'pending',
        email_verified: existingUserEmailConfirmed,
      })
      .select('id')
      .single()

    if (profileError || !insertedProfile) {
      console.error('Partner signup vendor profile insert failed:', profileError)
      await rollbackSignup(admin, userId, { deleteAuthUser: createdNewAuthUser })
      return NextResponse.json({ error: 'Failed to create vendor profile' }, { status: 500 })
    }

    if (logoBuffer && workshop_logo) {
      const uploaded = await uploadVendorWorkshopImage(admin, {
        pathPrefix: `vendors/${insertedProfile.id}/onboarding`,
        buffer: logoBuffer,
        contentType: workshop_logo.mime_type,
      })
      if ('error' in uploaded) {
        await rollbackSignup(admin, userId, { deleteAuthUser: createdNewAuthUser })
        return NextResponse.json({ error: uploaded.error }, { status: 400 })
      }
      const { error: logoUpdateErr } = await admin
        .from('vendor_profiles')
        .update({ default_workshop_image_url: uploaded.publicUrl })
        .eq('id', insertedProfile.id)
      if (logoUpdateErr) {
        await rollbackSignup(admin, userId, { deleteAuthUser: createdNewAuthUser })
        return NextResponse.json({ error: 'Failed to save workshop logo' }, { status: 500 })
      }
    }

    // Skip the verification email when we attached to an already-verified
    // consumer account — they own the inbox, no need to re-prove it.
    if (existingUserEmailConfirmed) {
      return NextResponse.json(
        { success: true, attachedToExistingAccount: true },
        { status: 201 }
      )
    }

    // Verification email is mandatory before checkout for brand-new auth users.
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      await rollbackSignup(admin, userId, { deleteAuthUser: createdNewAuthUser })
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
        redirectTo: `${appUrl}/partners/auth/callback`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Signup generateLink failed:', linkError?.message ?? 'Missing action link')
      await rollbackSignup(admin, userId, { deleteAuthUser: createdNewAuthUser })
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
      await rollbackSignup(admin, userId, { deleteAuthUser: createdNewAuthUser })
      return NextResponse.json(
        { error: 'Failed to create verification link. Please try again.' },
        { status: 502 }
      )
    }

    // Always verify on our app domain (not Supabase auth domain).
    const verifyUrl = `${appUrl}/api/partners/verify-email?token_hash=${encodeURIComponent(otpToken)}&type=${encodeURIComponent(otpType)}`

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
          <p style="color:#555;font-size:14px;line-height:1.6;margin-top:16px;">
            Once you&apos;re in the dashboard: if you&apos;re GST/HST-registered with the CRA, enable
            <strong>Settings → Workshop sales tax</strong> before your first paid booking. Small suppliers
            should leave it off and save their choice.
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
      await rollbackSignup(admin, userId, { deleteAuthUser: createdNewAuthUser })
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

