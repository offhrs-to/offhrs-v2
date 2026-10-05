import {
  workshopBooksOnShopify,
  workshopIsSaasVendorEvent,
} from '@/lib/workshop-event-utils';
import type { ComponentProps } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export type WorkshopListingKind = 'vendor_hosted' | 'vendor_redirect' | 'app_listed';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type WorkshopListingKindMeta = {
  kind: WorkshopListingKind;
  label: string;
  description: string;
  icon: IconName;
};

const KIND_META: Record<WorkshopListingKind, Omit<WorkshopListingKindMeta, 'kind'>> = {
  vendor_hosted: {
    label: 'Vendor-hosted',
    description: 'Hosts publish on offhrs. Book and pay securely in the app.',
    icon: 'storefront-check',
  },
  vendor_redirect: {
    label: 'Vendor redirects',
    description:
      "Synced from the host's online store. You'll complete booking and payment on their website.",
    icon: 'open-in-new',
  },
  app_listed: {
    label: 'App-listed',
    description:
      "Added by offhrs with a link to the host's site. Details may change; confirm with the host before booking.",
    icon: 'link-variant',
  },
};

export const WORKSHOP_LISTING_KIND_ORDER: WorkshopListingKind[] = [
  'vendor_hosted',
  'vendor_redirect',
  'app_listed',
];

export type WorkshopListingKindFields = {
  vendor_profile_id?: string | null;
  listing_source?: string | null;
  shopify_product_id?: string | null;
};

export function getWorkshopListingKind(event: WorkshopListingKindFields): WorkshopListingKind {
  if (workshopBooksOnShopify(event)) return 'vendor_redirect';
  if (workshopIsSaasVendorEvent(event)) return 'vendor_hosted';
  return 'app_listed';
}

export function getWorkshopListingKindMeta(
  eventOrKind: WorkshopListingKindFields | WorkshopListingKind
): WorkshopListingKindMeta {
  const kind =
    typeof eventOrKind === 'string' ? eventOrKind : getWorkshopListingKind(eventOrKind);
  return { kind, ...KIND_META[kind] };
}
