import type { Href } from 'expo-router';

import { supabase } from '@/lib/supabase';
import type { WorkshopEventRow } from '@/lib/workshops-events-query';

/** Route to legacy vendor profile + reviews when `vendor_id` is linked. */
export function vendorPagePath(event: Pick<WorkshopEventRow, 'vendor_id'>): Href | null {
  if (event.vendor_id?.trim()) return `/vendors/${event.vendor_id.trim()}` as Href;
  return null;
}

export function workshopVendorDisplayName(
  event: Pick<WorkshopEventRow, 'vendor_name' | 'organizer'>
): string | null {
  const name = event.vendor_name?.trim() || event.organizer?.trim();
  return name || null;
}

/**
 * Attach `vendor_name` from `organizer` and/or `vendors.name` for list + quick view.
 */
export async function enrichWorkshopEventsWithVendorNames(
  events: WorkshopEventRow[]
): Promise<WorkshopEventRow[]> {
  if (events.length === 0) return events;

  const vendorIds = [
    ...new Set(events.map((e) => e.vendor_id).filter((id): id is string => Boolean(id?.trim()))),
  ];

  const nameByVendorId: Record<string, string> = {};
  if (vendorIds.length > 0) {
    const { data: vendors } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
    for (const v of vendors ?? []) {
      if (v.id && v.name) nameByVendorId[v.id] = v.name;
    }
  }

  return events.map((e) => {
    const fromOrganizer = e.organizer?.trim();
    const fromVendor = e.vendor_id ? nameByVendorId[e.vendor_id] : undefined;
    const vendor_name = fromOrganizer || fromVendor || null;
    return vendor_name === e.vendor_name ? e : { ...e, vendor_name };
  });
}
