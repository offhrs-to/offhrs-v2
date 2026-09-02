import { BOOK_API_BASE } from '@/constants/api';

export type PlaceSuggestion = {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
};

export type ParsedCanadianAddress = {
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postal_code: string;
  formatted: string;
};

export async function fetchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const res = await fetch(
    `${BOOK_API_BASE}/api/places/autocomplete?q=${encodeURIComponent(q)}`
  );
  const data = (await res.json().catch(() => ({}))) as {
    suggestions?: PlaceSuggestion[];
    error?: string;
  };
  if (!res.ok) {
    if (res.status === 503) return [];
    throw new Error(data.error ?? 'Address search unavailable');
  }
  return data.suggestions ?? [];
}

export async function fetchPlaceAddress(placeId: string): Promise<ParsedCanadianAddress> {
  const res = await fetch(
    `${BOOK_API_BASE}/api/places/details?place_id=${encodeURIComponent(placeId)}`
  );
  const data = (await res.json().catch(() => ({}))) as {
    address?: ParsedCanadianAddress;
    error?: string;
  };
  if (!res.ok || !data.address) {
    throw new Error(data.error ?? 'Could not load address');
  }
  return data.address;
}
