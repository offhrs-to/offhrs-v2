import { resolveApiUser } from '@/lib/api-auth-user'
import { createShopOrderClaim, type ShopClaimReason } from '@/lib/shop/claims'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  reason: z.enum(['damaged', 'snad', 'other']),
  description: z.string().min(10).max(4000),
  photo_urls: z.array(z.string().url()).max(6).optional(),
})

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const user = await resolveApiUser(request)
    if (!user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const { data: order } = await admin
      .from('shop_orders')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await admin
      .from('shop_order_claims')
      .select('id, reason, description, photo_urls, status, seller_response, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ claims: data ?? [] })
  } catch (err) {
    console.error('shop claims GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const user = await resolveApiUser(request)
    if (!user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid claim' }, { status: 400 })
    }

    const result = await createShopOrderClaim({
      admin,
      orderId: id,
      buyerUserId: user.id,
      reason: parsed.data.reason as ShopClaimReason,
      description: parsed.data.description,
      photoUrls: parsed.data.photo_urls,
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ success: true, claim_id: result.id })
  } catch (err) {
    console.error('shop claims POST', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
