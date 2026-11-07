import { verifyAdmin } from '@/lib/admin-auth'
import {
  currentTorontoQuarter,
  PLATFORM_TAX_ACTIVE_STATUSES,
  PLATFORM_TAX_REFUNDED_STATUSES,
  quarterDateRange,
  torontoYmdParts,
  type CalendarQuarter,
} from '@/lib/shop/marketplace-tax-report'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe((process.env.STRIPE_SECRET_KEY ?? 'sk_build_placeholder'), {
  apiVersion: '2026-04-22.dahlia',
})

type OrderRow = {
  id: string
  product_title: string | null
  status: string
  tax_cad: number | string | null
  total_cad: number | string | null
  item_subtotal_cad: number | string | null
  shipping_collected_cad: number | string | null
  paid_at: string | null
  refunded_at: string | null
  tax_remitter: string | null
  stripe_payment_intent_id: string | null
  stripe_tax_transaction_id: string | null
  vendor_id: string
  vendor_profiles:
    | { business_name: string | null }
    | { business_name: string | null }[]
    | null
}

function vendorName(row: OrderRow): string {
  const vp = row.vendor_profiles
  const one = Array.isArray(vp) ? vp[0] : vp
  return one?.business_name?.trim() || 'Maker'
}

function num(v: number | string | null | undefined): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function parseQuarterParams(request: NextRequest): { year: number; quarter: CalendarQuarter } {
  const { year: cy, quarter: cq } = currentTorontoQuarter()
  const yRaw = Number(request.nextUrl.searchParams.get('year') ?? cy)
  const qRaw = Number(request.nextUrl.searchParams.get('quarter') ?? cq)
  const year = Number.isFinite(yRaw) && yRaw >= 2024 && yRaw <= 2100 ? Math.floor(yRaw) : cy
  const quarter = ([1, 2, 3, 4].includes(qRaw) ? qRaw : cq) as CalendarQuarter
  return { year, quarter }
}

function inTorontoQuarter(paidAt: string, year: number, quarter: CalendarQuarter): boolean {
  const { year: y, month } = torontoYmdParts(new Date(paidAt))
  if (y !== year) return false
  return Math.ceil(month / 3) === quarter
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const { year, quarter } = parseQuarterParams(request)
  const { startIso, endExclusiveIso, label } = quarterDateRange(year, quarter)

  const { data, error } = await admin
    .from('shop_orders')
    .select(
      'id, product_title, status, tax_cad, total_cad, item_subtotal_cad, shipping_collected_cad, paid_at, refunded_at, tax_remitter, stripe_payment_intent_id, stripe_tax_transaction_id, vendor_id, vendor_profiles(business_name)'
    )
    .eq('tax_remitter', 'platform')
    .not('paid_at', 'is', null)
    .gte('paid_at', startIso)
    .lt('paid_at', endExclusiveIso)
    .order('paid_at', { ascending: true })
    .limit(2000)

  if (error) {
    // Column may not exist until migration is applied.
    if (/tax_remitter/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            'tax_remitter column missing. Apply migration 20261107150000_shop_orders_tax_remitter.sql on production, then reload.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = ((data ?? []) as OrderRow[]).filter(
    (o) => o.paid_at && inTorontoQuarter(o.paid_at, year, quarter)
  )

  const activeSet = new Set<string>(PLATFORM_TAX_ACTIVE_STATUSES)
  const refundedSet = new Set<string>(PLATFORM_TAX_REFUNDED_STATUSES)

  let collectedCad = 0
  let refundedCad = 0
  const orders = rows.map((o) => {
    const taxCad = Math.round(num(o.tax_cad) * 100) / 100
    const isRefunded = refundedSet.has(o.status)
    const isActive = activeSet.has(o.status)
    if (isRefunded) refundedCad += taxCad
    else if (isActive) collectedCad += taxCad
    return {
      id: o.id,
      paid_at: o.paid_at,
      refunded_at: o.refunded_at,
      status: o.status,
      product_title: o.product_title,
      vendor_name: vendorName(o),
      item_subtotal_cad: num(o.item_subtotal_cad),
      shipping_collected_cad: num(o.shipping_collected_cad),
      tax_cad: taxCad,
      total_cad: num(o.total_cad),
      stripe_tax_transaction_id: o.stripe_tax_transaction_id,
      counts_toward_remittance: isActive && taxCad > 0,
    }
  })

  collectedCad = Math.round(collectedCad * 100) / 100
  refundedCad = Math.round(refundedCad * 100) / 100
  const netRemittableCad = Math.round((collectedCad - refundedCad) * 100) / 100

  const { count: unknownRemitterCount } = await admin
    .from('shop_orders')
    .select('id', { count: 'exact', head: true })
    .is('tax_remitter', null)
    .gt('tax_cad', 0)
    .not('paid_at', 'is', null)
    .gte('paid_at', startIso)
    .lt('paid_at', endExclusiveIso)

  return NextResponse.json({
    year,
    quarter,
    label,
    timezone: 'America/Toronto',
    summary: {
      order_count: orders.length,
      active_order_count: orders.filter((o) => o.counts_toward_remittance).length,
      refunded_order_count: orders.filter((o) => refundedSet.has(o.status)).length,
      collected_tax_cad: collectedCad,
      refunded_tax_cad: refundedCad,
      /** Net GST/HST for CRA from unregistered Marketplace sales this quarter. */
      net_remittable_tax_cad: Math.max(0, netRemittableCad),
      unknown_remitter_with_tax_count: unknownRemitterCount ?? 0,
    },
    orders,
    note:
      'Platform remitter = unregistered Marketplace sellers. Remit net_remittable_tax_cad via CRA GST/HST return. Confirm against Stripe → Tax → Transactions on the platform account.',
  })
}

/** Backfill tax_remitter from PaymentIntent metadata for older orders. */
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

  const { data, error } = await admin
    .from('shop_orders')
    .select('id, stripe_payment_intent_id')
    .is('tax_remitter', null)
    .not('stripe_payment_intent_id', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(75)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let updated = 0
  let skipped = 0
  const failures: string[] = []

  for (const row of data ?? []) {
    const piId = row.stripe_payment_intent_id?.trim()
    if (!piId) {
      skipped += 1
      continue
    }
    try {
      const pi = await stripe.paymentIntents.retrieve(piId)
      const remitter = pi.metadata?.tax_remitter === 'platform' ? 'platform' : 'vendor'
      const { error: upErr } = await admin
        .from('shop_orders')
        .update({ tax_remitter: remitter })
        .eq('id', row.id)
        .is('tax_remitter', null)
      if (upErr) {
        failures.push(row.id)
      } else {
        updated += 1
      }
    } catch {
      failures.push(row.id)
    }
  }

  return NextResponse.json({
    scanned: data?.length ?? 0,
    updated,
    skipped,
    failures: failures.length,
  })
}
