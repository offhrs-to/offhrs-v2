import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { parseCanadianPostalCode } from '@/lib/canadianPostalCode';

const FSA_LETTER_TO_PROVINCE: Record<string, string> = {
  A: 'NL',
  B: 'NS',
  C: 'PE',
  E: 'NB',
  G: 'QC',
  H: 'QC',
  J: 'QC',
  K: 'ON',
  L: 'ON',
  M: 'ON',
  N: 'ON',
  P: 'ON',
  R: 'MB',
  S: 'SK',
  T: 'AB',
  V: 'BC',
  X: 'NT',
  Y: 'YT',
};

export function provinceFromCanadianPostalCode(postalCode: string): string | null {
  const norm = parseCanadianPostalCode(postalCode);
  if (!norm) return null;
  return FSA_LETTER_TO_PROVINCE[norm.charAt(0)] ?? null;
}

export type WorkshopTaxQuote = {
  subtotalCad: number;
  taxCad: number;
  totalCad: number;
  free?: boolean;
};

export async function fetchWorkshopTaxQuote(params: {
  eventId: number;
  accessToken: string;
  postalCode: string | null | undefined;
}): Promise<WorkshopTaxQuote | { error: string }> {
  const postal = params.postalCode?.trim();
  if (!postal) {
    return { error: 'Add a Canadian postal code in Profile to see tax and book.' };
  }
  const normalized = parseCanadianPostalCode(postal);
  if (!normalized) {
    return { error: 'Your saved postal code is invalid. Update it in Profile.' };
  }
  const state = provinceFromCanadianPostalCode(normalized);
  if (!state) {
    return { error: 'Could not determine province from your postal code.' };
  }

  const headers = await buildBookingApiHeaders(params.accessToken);
  const res = await fetch(`${BOOK_API_BASE}/api/book/quote`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event_id: params.eventId,
      customer_address: { country: 'CA', postal_code: normalized, state },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { error: (data.error as string) || 'Could not calculate tax.' };
  }
  if (data.free === true) {
    return { subtotalCad: 0, taxCad: 0, totalCad: 0, free: true };
  }
  return {
    subtotalCad: Number(data.subtotalCad ?? 0),
    taxCad: Number(data.taxCad ?? 0),
    totalCad: Number(data.totalCad ?? 0),
  };
}

export function formatCad(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
