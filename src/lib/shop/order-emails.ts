import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendShopBuyerOrderConfirmation,
  sendShopBuyerShipped,
  sendShopSellerNewOrder,
} from '@/lib/emails'
import {
  currentShopTermsVersion,
  formatSellerDisclosureAddress,
  shopCancelReturnDisclosure,
  shopDeliveryDisclosure,
  SHOP_SELLER_ADDENDUM_URL,
  SHOP_SUPPORT_EMAIL,
  SHOP_TERMS_OF_USE_URL,
} from '@/lib/shop/ontario-disclosures'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

function orderDateLabel(iso: string | null | undefined): string {
  if (!iso) return new Date().toLocaleDateString('en-CA', { dateStyle: 'long' })
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-CA', { dateStyle: 'long', timeZone: 'America/Toronto' })
}

export async function notifyShopOrderCreated(
  admin: SupabaseClient,
  orderId: string
): Promise<void> {
  const { data: order } = await admin
    .from('shop_orders')
    .select(
      'id, buyer_name, buyer_email, product_title, product_id, item_subtotal_cad, shipping_collected_cad, tax_cad, total_cad, fulfillment_type, ship_by_business_days, vendor_id, buyer_confirmation_sent_at, seller_notified_at, paid_at, terms_version'
    )
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return

  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select(
      'id, user_id, business_name, website_url, location_address, shop_pickup_hours, ship_from_line1, ship_from_line2, ship_from_city, ship_from_province, ship_from_postal_code, ship_from_country'
    )
    .eq('id', order.vendor_id)
    .maybeSingle()

  const { data: product } = await admin
    .from('shop_products')
    .select('buyer_remorse_returns, made_to_order')
    .eq('id', order.product_id)
    .maybeSingle()

  const fulfillmentType = order.fulfillment_type === 'pickup' ? 'pickup' : 'ship'
  const sellerAddress = formatSellerDisclosureAddress({
    shipFrom: vendor
      ? {
          line1: vendor.ship_from_line1,
          line2: vendor.ship_from_line2,
          city: vendor.ship_from_city,
          province: vendor.ship_from_province,
          postal_code: vendor.ship_from_postal_code,
          country: vendor.ship_from_country,
        }
      : null,
    locationAddress: vendor?.location_address,
  })

  if (!order.buyer_confirmation_sent_at && order.buyer_email) {
    try {
      await sendShopBuyerOrderConfirmation({
        to: order.buyer_email,
        buyerName: order.buyer_name,
        productTitle: order.product_title,
        vendorName: vendor?.business_name ?? 'Maker',
        orderId: order.id,
        orderDateLabel: orderDateLabel(order.paid_at),
        itemSubtotalCad: Number(order.item_subtotal_cad ?? 0),
        shippingCad: Number(order.shipping_collected_cad ?? 0),
        taxCad: Number(order.tax_cad ?? 0),
        totalCad: Number(order.total_cad),
        fulfillmentType,
        deliveryDisclosure: shopDeliveryDisclosure({
          fulfillmentType,
          shipByDays: order.ship_by_business_days,
          madeToOrder: product?.made_to_order === true,
          pickupHours: vendor?.shop_pickup_hours,
        }),
        cancelReturnDisclosure: shopCancelReturnDisclosure({
          fulfillmentType,
          buyerRemorseReturns: product?.buyer_remorse_returns !== false,
        }),
        sellerAddress,
        sellerWebsite: vendor?.website_url?.trim() || null,
        supportEmail: SHOP_SUPPORT_EMAIL,
        termsVersion: (order.terms_version as string | null)?.trim() || currentShopTermsVersion(),
        termsUrl: SHOP_TERMS_OF_USE_URL,
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
          fulfillmentType,
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

/** Re-export for checkout UI copy if needed server-side. */
export { SHOP_SELLER_ADDENDUM_URL, SHOP_SUPPORT_EMAIL, SHOP_TERMS_OF_USE_URL }
