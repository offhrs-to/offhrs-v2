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

/** Shippo carrier object ids / provider names for Canada Post. */
const CANADA_POST_CARRIER_IDS = new Set(['canada_post', 'canadapost'])

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
  amount_local?: string
  currency_local?: string
  provider: string
  servicelevel?: { name?: string; token?: string }
  estimated_days?: number
}

type ShippoApiMessage = {
  source?: string
  code?: string
  text?: string
}

type ShippoApiShipment = {
  object_id: string
  rates: ShippoApiRate[]
  messages?: ShippoApiMessage[]
}

type ShippoCarrierAccount = {
  object_id: string
  carrier: string
  active?: boolean
  account_id?: string
}

function toShippoAddress(addr: ShippoAddressInput): ShippoApiAddress {
  const postal = normalizeCanadianPostalCode(addr.postal_code)
  if (!postal) throw new Error('Invalid Canadian postal code for Shippo')
  // Canada Post prefers compact postal (no space) in some rate paths.
  const zip = postal.replace(/\s+/g, '')
  return {
    name: addr.name.trim(),
    street1: addr.line1.trim(),
    ...(addr.line2?.trim() ? { street2: addr.line2.trim() } : {}),
    city: addr.city.trim(),
    state: addr.province.trim().toUpperCase(),
    zip,
    country: (addr.country ?? 'CA').toUpperCase(),
    ...(addr.phone?.trim() ? { phone: addr.phone.trim() } : {}),
  }
}

async function shippoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = shippoApiKey()
  if (!key) throw new Error('SHIPPO_API_KEY is not configured')

  const res = await fetch(`${SHIPPO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
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

function isCanadaPostCarrier(carrier: string | undefined | null): boolean {
  if (!carrier) return false
  const normalized = carrier.trim().toLowerCase().replace(/[\s_-]+/g, '')
  return (
    normalized === 'canadapost' ||
    normalized.includes('canadapost') ||
    CANADA_POST_CARRIER_IDS.has(carrier.trim().toLowerCase())
  )
}

function isCanadaPostProvider(provider: string | undefined | null): boolean {
  if (!provider) return false
  return /canada\s*post/i.test(provider) || isCanadaPostCarrier(provider)
}

/** Resolve active Canada Post carrier account object_ids for rate requests. */
export async function listCanadaPostCarrierAccountIds(): Promise<string[]> {
  const fromEnv = process.env.SHIPPO_CANADA_POST_CARRIER_ACCOUNT_ID?.trim()
  if (fromEnv) return [fromEnv]

  const listed = await shippoFetch<{ results?: ShippoCarrierAccount[] }>(
    '/carrier_accounts/?results=100'
  )
  const accounts = listed.results ?? []
  const ids = accounts
    .filter((a) => a.active !== false && isCanadaPostCarrier(a.carrier))
    .map((a) => a.object_id)
    .filter(Boolean)

  return [...new Set(ids)]
}

function rateAmountCad(r: ShippoApiRate): number | null {
  const currency = (r.currency ?? '').toUpperCase()
  const localCurrency = (r.currency_local ?? '').toUpperCase()
  if (currency === 'CAD') {
    const n = Number.parseFloat(r.amount)
    return Number.isFinite(n) ? n : null
  }
  if (localCurrency === 'CAD' && r.amount_local) {
    const n = Number.parseFloat(r.amount_local)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function formatShippoMessages(messages: ShippoApiMessage[] | undefined): string | null {
  if (!messages?.length) return null

  // Prefer Canada Post / approval messages; ignore irrelevant UK carriers etc.
  const preferred = messages.filter((m) => {
    const src = (m.source ?? '').toLowerCase()
    const text = (m.text ?? '').toLowerCase()
    if (src.includes('canada') || text.includes('canada post')) return true
    if (text.includes('not approved') || text.includes('shared account')) return true
    if (text.includes('restricted from using this carrier')) return true
    return false
  })

  const pool = preferred.length ? preferred : messages
  const texts = pool
    .map((m) => m.text?.trim())
    .filter((t): t is string => Boolean(t))
    // Drop Hermes UK / unrelated EU noise when we have better signal
    .filter((t) => !/hermes_uk|evri/i.test(t))

  if (!texts.length) return null
  return [...new Set(texts)].slice(0, 2).join(' · ')
}

function canadaPostSetupHint(messages: string | null, hasCarrierAccount: boolean): string {
  if (!hasCarrierAccount) {
    return (
      'No Canada Post carrier account found on this Shippo key. ' +
      'In Shippo → Carriers, activate Canada Post (Shippo shared account), ' +
      'wait for approval if prompted, then use a live API key that can see that carrier.'
    )
  }
  if (messages && /not approved|shared account|restricted/i.test(messages)) {
    return (
      'Shippo has not approved Canada Post on this account yet. ' +
      'Open Shippo → Carriers → Canada Post, finish activation, and contact Shippo support if it still says not approved. ' +
      `(${messages})`
    )
  }
  return (
    messages ??
    'No Canada Post rates returned. Confirm Canada Post is active/approved in Shippo and seller weight/dims are valid.'
  )
}

/** Fetch live Canada Post rates for a single parcel. */
export async function fetchShippoRates(params: {
  from: ShippoAddressInput
  to: ShippoAddressInput
  parcel: ShippoParcelInput
  itemSubtotalCad: number
}): Promise<{ shipment_id: string; rates: ShippoRateOption[]; messages: string | null }> {
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

  const from = toShippoAddress(params.from)
  const to = toShippoAddress(params.to)
  if (from.zip === to.zip && from.city.toLowerCase() === to.city.toLowerCase()) {
    console.warn('Shippo rates: origin and destination look identical', from.zip)
  }

  let canadaPostAccountIds: string[] = []
  try {
    canadaPostAccountIds = await listCanadaPostCarrierAccountIds()
  } catch (err) {
    console.warn(
      'Could not list Shippo carrier accounts',
      err instanceof Error ? err.message : err
    )
  }

  const shipmentBody: Record<string, unknown> = {
    address_from: from,
    address_to: to,
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
  }

  // Restrict to Canada Post so Hermes UK / other carriers don't pollute errors.
  if (canadaPostAccountIds.length) {
    shipmentBody.carrier_accounts = canadaPostAccountIds
  }

  const shipment = await shippoFetch<ShippoApiShipment>('/shipments/', {
    method: 'POST',
    body: JSON.stringify(shipmentBody),
  })

  const rawMessages = formatShippoMessages(shipment.messages)

  const rates: ShippoRateOption[] = (shipment.rates ?? [])
    .filter((r) => isCanadaPostProvider(r.provider))
    .map((r) => {
      const amount_cad = rateAmountCad(r)
      if (amount_cad == null || amount_cad < 0) return null
      return {
        rate_id: r.object_id,
        shipment_id: shipment.object_id,
        amount_cad,
        currency: 'CAD',
        carrier: r.provider,
        service_level: r.servicelevel?.token ?? r.servicelevel?.name ?? 'standard',
        service_name: r.servicelevel?.name ?? r.provider,
        estimated_days: r.estimated_days ?? null,
      }
    })
    .filter((r): r is ShippoRateOption => r != null)
    .sort((a, b) => a.amount_cad - b.amount_cad)

  const messages = rates.length
    ? rawMessages
    : canadaPostSetupHint(rawMessages, canadaPostAccountIds.length > 0)

  if (!rates.length) {
    console.warn('Shippo returned no Canada Post rates', {
      shipment_id: shipment.object_id,
      raw_rate_count: shipment.rates?.length ?? 0,
      canada_post_accounts: canadaPostAccountIds.length,
      messages,
      from_zip: from.zip,
      to_zip: to.zip,
    })
  }

  return { shipment_id: shipment.object_id, rates, messages }
}

/** Placeholder — implement with Shippo REST in Phase 3. */
export async function shippoNotImplemented(operation: string): Promise<never> {
  throw new Error(
    `Shippo ${operation} is not implemented yet (Phase 3). Configured=${isShippoConfigured()}`
  )
}
