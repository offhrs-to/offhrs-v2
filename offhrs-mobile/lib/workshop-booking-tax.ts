import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { extractCanadianPostalFromAddress, parseCanadianPostalCode } from '@/lib/canadianPostalCode';

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
  refundWindowHours?: number;
  refundPolicyLine?: string;
};

function resolvePostalForTaxQuote(
  profilePostal: string | null | undefined,
  eventLocation: string | null | undefined
): { normalized: string; state: string } | { error: string } {
  const fromProfile = profilePostal?.trim();
  if (fromProfile) {
    const normalized = parseCanadianPostalCode(fromProfile);
    if (!normalized) {
      return { error: 'Your saved postal code is invalid. Update it in Profile.' };
    }
    const state = provinceFromCanadianPostalCode(normalized);
    if (!state) return { error: 'Could not determine province from your postal code.' };
    return { normalized, state };
  }
  if (eventLocation?.trim()) {
    const fromVenue = extractCanadianPostalFromAddress(eventLocation);
    if (fromVenue) {
      const state = provinceFromCanadianPostalCode(fromVenue);
      if (state) return { normalized: fromVenue, state };
    }
  }
  return {
    error:
      'Add a Canadian postal code in Profile, or book a workshop with a Canadian address, to see tax.',
  };
}

export async function fetchWorkshopTaxQuote(params: {
  eventId: number;
  accessToken: string;
  postalCode: string | null | undefined;
  eventLocation?: string | null;
  startTimeIso?: string | null;
}): Promise<WorkshopTaxQuote | { error: string }> {
  const resolved = resolvePostalForTaxQuote(params.postalCode, params.eventLocation);
  if ('error' in resolved) return { error: resolved.error };
  const { normalized, state } = resolved;

  const headers = await buildBookingApiHeaders(params.accessToken);
  const res = await fetch(`${BOOK_API_BASE}/api/book/quote`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event_id: params.eventId,
      ...(params.startTimeIso?.trim() ? { start_time: params.startTimeIso.trim() } : {}),
      customer_address: { country: 'CA', postal_code: normalized, state },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 404) {
      return {
        error:
          'Tax preview is not available on this server yet. Deploy the latest API, or book to see the total at checkout.',
      };
    }
    const apiError = (data.error as string)?.trim();
    const detail = (data.detail as string)?.trim();
    return {
      error: apiError || detail || `Could not calculate tax (${res.status}).`,
    };
  }
  const refundWindowHours =
    data.refundWindowHours != null ? Number(data.refundWindowHours) : undefined;
  const refundPolicyLine =
    typeof data.refundPolicyLine === 'string' ? data.refundPolicyLine : undefined;

  if (data.free === true) {
    return {
      subtotalCad: 0,
      taxCad: 0,
      totalCad: 0,
      free: true,
      refundWindowHours,
      refundPolicyLine,
    };
  }
  return {
    subtotalCad: Number(data.subtotalCad ?? 0),
    taxCad: Number(data.taxCad ?? 0),
    totalCad: Number(data.totalCad ?? 0),
    refundWindowHours,
    refundPolicyLine,
  };
}

export function formatCad(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
