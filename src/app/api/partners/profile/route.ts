import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeInstagramHandle } from '@/lib/instagram-handle'
import { normalizeLocationUnit } from '@/lib/venue-address'

/** For dashboard forms (e.g. session location default from onboarding). */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const { data: vendor, error } = await admin
      .from('vendor_profiles')
      .select(
        'location_address, location_unit, location_lat, location_lng, default_workshop_image_url'
      )
      .eq('user_id', user.id)
      .single()

    if (error || !vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      location_address: vendor.location_address ?? '',
      location_unit: vendor.location_unit ?? '',
      location_lat: vendor.location_lat ?? null,
      location_lng: vendor.location_lng ?? null,
      default_workshop_image_url: vendor.default_workshop_image_url ?? '',
    })
  } catch (err) {
    console.error('Profile GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const profileSchema = z.object({
  business_name: z.string().min(2).max(100),
  bio: z.string().max(2000).optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  instagram_handle: z.string().max(200).optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  location_address: z.string().max(500).optional(),
  location_unit: z.string().max(80).optional().nullable(),
  refund_window_hours: z.number().int().min(24).max(8760).optional(),
  strict_no_refund: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (!data.strict_no_refund && data.refund_window_hours == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Refund window is required unless strict no-refund policy is enabled.',
      path: ['refund_window_hours'],
    })
  }
  if (
    data.instagram_handle &&
    data.instagram_handle.trim() &&
    !normalizeInstagramHandle(data.instagram_handle)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid Instagram handle (letters, numbers, periods, underscores).',
      path: ['instagram_handle'],
    })
  }
})

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

    const raw = await request.json()
    const parsed = profileSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { data } = parsed

    const strictNoRefund = data.strict_no_refund === true
    const refundWindowHours = strictNoRefund ? 48 : (data.refund_window_hours ?? 48)
    const instagramHandle =
      data.instagram_handle !== undefined ? normalizeInstagramHandle(data.instagram_handle) : undefined

    const updatePayload: Record<string, unknown> = {
      business_name: data.business_name,
      bio: data.bio || null,
      website_url: data.website_url || null,
      phone: data.phone || null,
      location_address: data.location_address || null,
      location_unit: normalizeLocationUnit(data.location_unit),
      refund_window_hours: refundWindowHours,
      strict_no_refund: strictNoRefund,
    }
    if (instagramHandle !== undefined) {
      updatePayload.instagram_handle = instagramHandle
    }

    const { error } = await admin
      .from('vendor_profiles')
      .update(updatePayload)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Profile update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

