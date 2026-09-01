import 'server-only'

import {
  SHOP_HIGH_VALUE_INSURANCE_CAD,
} from '@/lib/shop/fees'
import { normalizeCanadianPostalCode } from '@/lib/canadian-postal-province'

/**
 * Platform Shippo client (Phase 2+).
 * Rates, label purchase, void, and tracking.
 */

const SHIPPO_API_BASE = 'https://api.goshippo.com'

export function shippoApiKey(): string | null {
  const key = process.env.SHIPPO_API_KEY?.trim()
  return key || null
}

export function isShippoConfigured(): boolean {
  return Boolean(shippoApiKey())
}

export type ShippoConfigStatus = {
  configured: boolean
  hint: string
}

export function getShippoConfigStatus(): ShippoConfigStatus {
  if (!isShippoConfigured()) {
    return {
      configured: false,
      hint: 'SHIPPO_API_KEY is not set. Add the key before live shipping rates.',
    }
  }
  return {
    configured: true,
    hint: 'SHIPPO_API_KEY is set (platform account). Verify Canada Post is enabled in Shippo.',
  }
}

export type ShippoAddressInput = {
  name: string
  line1: string
  line2?: string | null
  city: string
  province: string
  postal_code: string
  country?: string
  phone?: string | null
}

export type ShippoParcelInput = {
  weight_g: number
  length_cm: number
  width_cm: number
  height_cm: number
}

export type ShippoRateOption = {
  rate_id: string
  shipment_id: string
  amount_cad: number
  currency: string
  carrier: string
  service_level: string
  service_name: string
  estimated_days: number | null
}

type ShippoApiAddress = {
  name: string
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
}

type ShippoApiRate = {
  object_id: string
  amount: string
  currency: string
  provider: string
  servicelevel?: { name?: string; token?: string }
  estimated_days?: number
}

type ShippoApiShipment = {
  object_id: string
  rates: ShippoApiRate[]
}

function toShippoAddress(addr: ShippoAddressInput): ShippoApiAddress {
  const postal = normalizeCanadianPostalCode(addr.postal_code)
  if (!postal) throw new Error('Invalid Canadian postal code for Shippo')
  return {
    name: addr.name.trim(),
    street1: addr.line1.trim(),
    ...(addr.line2?.trim() ? { street2: addr.line2.trim() } : {}),
    city: addr.city.trim(),
    state: addr.province.trim().toUpperCase(),
    zip: postal,
    country: (addr.country ?? 'CA').toUpperCase(),
    ...(addr.phone?.trim() ? { phone: addr.phone.trim() } : {}),
  }
}

async function shippoFetch<T>(path: string, init: RequestInit): Promise<T> {
  const key = shippoApiKey()
  if (!key) throw new Error('SHIPPO_API_KEY is not configured')

  const res = await fetch(`${SHIPPO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  const body = (await res.json().catch(() => ({}))) as T & { detail?: string; message?: string }
  if (!res.ok) {
    const msg =
      (body as { detail?: string }).detail ??
      (body as { message?: string }).message ??
      `Shippo API error (${res.status})`
    throw new Error(msg)
  }
  return body
}

/** Fetch live Canada Post rates for a single parcel. */
export async function fetchShippoRates(params: {
  from: ShippoAddressInput
  to: ShippoAddressInput
  parcel: ShippoParcelInput
  itemSubtotalCad: number
}): Promise<{ shipment_id: string; rates: ShippoRateOption[] }> {
  const highValue =
    params.itemSubtotalCad >= SHOP_HIGH_VALUE_INSURANCE_CAD

  const extra: Record<string, unknown> = {}
  if (highValue) {
    extra.signature_confirmation = 'STANDARD'
    extra.insurance = {
      amount: String(params.itemSubtotalCad.toFixed(2)),
      currency: 'CAD',
      content: 'merchandise',
    }
  }

  const shipment = await shippoFetch<ShippoApiShipment>('/shipments/', {
    method: 'POST',
    body: JSON.stringify({
      address_from: toShippoAddress(params.from),
      address_to: toShippoAddress(params.to),
      parcels: [
        {
          length: String(params.parcel.length_cm),
          width: String(params.parcel.width_cm),
          height: String(params.parcel.height_cm),
          distance_unit: 'cm',
          weight: String(params.parcel.weight_g),
          mass_unit: 'g',
        },
      ],
      async: false,
      ...(Object.keys(extra).length ? { extra } : {}),
    }),
  })

  const rates: ShippoRateOption[] = (shipment.rates ?? [])
    .filter((r) => r.currency?.toUpperCase() === 'CAD')
    .map((r) => ({
      rate_id: r.object_id,
      shipment_id: shipment.object_id,
      amount_cad: Number.parseFloat(r.amount),
      currency: r.currency,
      carrier: r.provider,
      service_level: r.servicelevel?.token ?? r.servicelevel?.name ?? 'standard',
      service_name: r.servicelevel?.name ?? r.provider,
      estimated_days: r.estimated_days ?? null,
    }))
    .filter((r) => Number.isFinite(r.amount_cad) && r.amount_cad >= 0)
    .sort((a, b) => a.amount_cad - b.amount_cad)

  return { shipment_id: shipment.object_id, rates }
}

/** Placeholder — implement with Shippo REST in Phase 3. */
export async function shippoNotImplemented(operation: string): Promise<never> {
  throw new Error(
    `Shippo ${operation} is not implemented yet (Phase 3). Configured=${isShippoConfigured()}`
  )
}
