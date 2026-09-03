import { addCanadianBusinessDays } from '@/lib/shop/business-days'
import { sendShopSellerDay3Reminder } from '@/lib/emails'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

/** Daily: Day-3 ship-by reminders for unlabeled Marketplace orders. */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Admin client unavailable' }, { status: 500 })

    const { data: orders, error } = await admin
      .from('shop_orders')
      .select(
        'id, product_title, ship_by_business_days, paid_at, vendor_id, day3_reminder_sent_at, vendor_profiles(user_id, business_name)'
      )
      .eq('fulfillment_type', 'ship')
      .eq('status', 'paid_awaiting_fulfillment')
      .is('day3_reminder_sent_at', null)
      .not('paid_at', 'is', null)
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const now = new Date()
    let sent = 0

    for (const order of orders ?? []) {
      if (!order.paid_at) continue
      const day3 = addCanadianBusinessDays(new Date(order.paid_at), 3)
      if (day3 > now) continue

      const vp = Array.isArray(order.vendor_profiles) ? order.vendor_profiles[0] : order.vendor_profiles
      const userId = vp?.user_id as string | undefined
      if (!userId) continue

      try {
        const { data: authUser } = await admin.auth.admin.getUserById(userId)
        const email = authUser?.user?.email
        if (!email) continue
        await sendShopSellerDay3Reminder({
          to: email,
          productTitle: order.product_title,
          shipByDays: order.ship_by_business_days,
          dashboardUrl: `${APP_URL.replace(/\/+$/, '')}/partners/dashboard/marketplace?tab=orders`,
        })
        await admin
          .from('shop_orders')
          .update({ day3_reminder_sent_at: now.toISOString() })
          .eq('id', order.id)
        sent += 1
      } catch (err) {
        console.error('shop day-3 reminder', order.id, err)
      }
    }

    return NextResponse.json({ sent, scanned: orders?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Cron shop-sla-reminders', err)
    return NextResponse.json({ error: message, sent: 0 }, { status: 500 })
  }
}
