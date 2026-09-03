import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendShopBuyerOrderConfirmation,
  sendShopBuyerShipped,
  sendShopSellerNewOrder,
} from '@/lib/emails'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export async function notifyShopOrderCreated(
  admin: SupabaseClient,
  orderId: string
): Promise<void> {
  const { data: order } = await admin
    .from('shop_orders')
    .select(
      'id, buyer_name, buyer_email, product_title, total_cad, fulfillment_type, ship_by_business_days, vendor_id, buyer_confirmation_sent_at, seller_notified_at'
    )
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('id, user_id, business_name, shop_pickup_hours')
    .eq('id', order.vendor_id)
    .maybeSingle()

  if (!order.buyer_confirmation_sent_at && order.buyer_email) {
    try {
      await sendShopBuyerOrderConfirmation({
        to: order.buyer_email,
        buyerName: order.buyer_name,
        productTitle: order.product_title,
        vendorName: vendor?.business_name ?? 'Maker',
        totalCad: Number(order.total_cad),
        fulfillmentType: order.fulfillment_type === 'pickup' ? 'pickup' : 'ship',
        shipByDays: order.ship_by_business_days,
        pickupHours: vendor?.shop_pickup_hours ?? null,
      })
      await admin
        .from('shop_orders')
        .update({ buyer_confirmation_sent_at: new Date().toISOString() })
        .eq('id', orderId)
    } catch (err) {
      console.error('shop buyer confirmation email', err)
    }
  }

  if (!order.seller_notified_at && vendor?.user_id) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(vendor.user_id)
      const sellerEmail = authUser?.user?.email
      if (sellerEmail) {
        await sendShopSellerNewOrder({
          to: sellerEmail,
          businessName: vendor.business_name ?? 'Maker',
          buyerName: order.buyer_name,
          productTitle: order.product_title,
          totalCad: Number(order.total_cad),
          fulfillmentType: order.fulfillment_type === 'pickup' ? 'pickup' : 'ship',
          shipByDays: order.ship_by_business_days,
          dashboardUrl: `${APP_URL.replace(/\/+$/, '')}/partners/dashboard/marketplace?tab=orders`,
        })
        await admin
          .from('shop_orders')
          .update({ seller_notified_at: new Date().toISOString() })
          .eq('id', orderId)
      }
    } catch (err) {
      console.error('shop seller new-order email', err)
    }
  }
}

export async function notifyShopOrderShipped(
  admin: SupabaseClient,
  orderId: string
): Promise<void> {
  const { data: order } = await admin
    .from('shop_orders')
    .select(
      'buyer_email, buyer_name, product_title, tracking_number, tracking_url, first_scan_at, buyer_shipped_sent_at'
    )
    .eq('id', orderId)
    .maybeSingle()

  if (!order?.buyer_email || !order.first_scan_at || order.buyer_shipped_sent_at) return

  try {
    await sendShopBuyerShipped({
      to: order.buyer_email,
      buyerName: order.buyer_name,
      productTitle: order.product_title,
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_url,
    })
    await admin
      .from('shop_orders')
      .update({ buyer_shipped_sent_at: new Date().toISOString() })
      .eq('id', orderId)
  } catch (err) {
    console.error('shop shipped email', err)
  }
}
