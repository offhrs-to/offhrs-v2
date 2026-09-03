import { applyShopOrderTracking, recordShopOrderApvAdjustment } from '@/lib/shop/fulfillment'
import { notifyShopOrderShipped } from '@/lib/shop/order-emails'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

function webhookAuthorized(request: NextRequest): boolean {
  const secret = process.env.SHIPPO_WEBHOOK_SECRET?.trim()
  if (!secret) return true
  const header = request.headers.get('authorization')
  const query = request.nextUrl.searchParams.get('token')
  return header === `Bearer ${secret}` || query === secret
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nestedString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value
    const nested = asRecord(value)
    if (nested) {
      const id = nested.object_id ?? nested.id
      if (typeof id === 'string' && id.trim()) return id
    }
  }
  return null
}

function parseTrackingStatus(data: Record<string, unknown>): string | null {
  const tracking = data.tracking_status
  if (typeof tracking === 'string' && tracking.trim()) return tracking
  const nested = asRecord(tracking)
  if (nested && typeof nested.status === 'string') return nested.status
  if (typeof data.status === 'string' && data.status.trim()) return data.status
  return null
}

function parseApvAdjustmentCad(data: Record<string, unknown>): number | null {
  const extra = asRecord(data.extra)
  const metadata = asRecord(data.metadata)
  const candidates = [
    data.apv_adjustment_cad,
    data.amount_difference,
    data.adjustment_amount,
    data.adjustment,
    extra?.apv,
    extra?.amount_difference,
    metadata?.apv_adjustment_cad,
    metadata?.amount_difference,
  ]
  for (const raw of candidates) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

/**
 * Shippo tracking + APV hooks.
 * Configure the webhook URL in Shippo to POST here (optional token via SHIPPO_WEBHOOK_SECRET).
 */
export async function POST(request: NextRequest) {
  if (!webhookAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server error' }, { status: 500 })

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = String(payload.event ?? payload.type ?? '')
  const data = asRecord(payload.data) ?? payload
  const trackingStatus = parseTrackingStatus(data)
  const trackingNumber =
    typeof data.tracking_number === 'string' && data.tracking_number.trim()
      ? data.tracking_number
      : null
  const transactionId =
    nestedString(data, ['transaction']) ??
    (typeof data.object_id === 'string' && event.toLowerCase().includes('transaction')
      ? data.object_id
      : null)

  if (event.toLowerCase().includes('track') || trackingStatus || trackingNumber) {
    const result = await applyShopOrderTracking({
      admin,
      trackingNumber,
      transactionId,
      status: trackingStatus,
    })

    if (result.applied && result.orderId) {
      await notifyShopOrderShipped(admin, result.orderId)
    }
  }

  const adjustmentCad = parseApvAdjustmentCad(data)
  if (adjustmentCad != null) {
    await recordShopOrderApvAdjustment(admin, {
      transactionId,
      trackingNumber,
      adjustmentCad,
    })
  }

  return NextResponse.json({ received: true, event })
}
