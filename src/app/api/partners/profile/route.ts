import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const profileSchema = z.object({
  business_name: z.string().min(2).max(100),
  bio: z.string().max(2000).optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  location_address: z.string().max(500).optional(),
  refund_window_hours: z.number().int().min(24).max(8760),
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

    const { error } = await admin
      .from('vendor_profiles')
      .update({
        business_name: data.business_name,
        bio: data.bio || null,
        website_url: data.website_url || null,
        phone: data.phone || null,
        location_address: data.location_address || null,
        refund_window_hours: data.refund_window_hours,
      })
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Profile update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

