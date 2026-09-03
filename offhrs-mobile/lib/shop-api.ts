import { BOOK_API_BASE } from '@/constants/api';
import { buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { supabase } from '@/lib/supabase';

export type ShopProductListItem = {
  id: string;
  title: string;
  price_cad: number;
  category: string;
  image_urls: string[];
  vendor_id: string;
  vendor_name: string;
  vendor_slug: string | null;
  created_at: string;
};

export type ShopProductDetail = {
  id: string;
  title: string;
  description: string | null;
  price_cad: number;
  category: string;
  quantity: number;
  status?: string;
  purchasable?: boolean;
  pickup_available: boolean;
  made_to_order: boolean;
  ship_by_business_days: number;
  buyer_remorse_returns: boolean;
  image_urls: string[];
  vendor_id: string;
};

export type ShopVendorSummary = {
  id: string;
  business_name: string | null;
  slug: string | null;
  bio: string | null;
  shop_pickup_enabled: boolean;
  shop_pickup_line1?: string | null;
  shop_pickup_line2?: string | null;
  shop_pickup_city?: string | null;
  shop_pickup_province?: string | null;
  shop_pickup_postal_code?: string | null;
  shop_pickup_hours?: string | null;
};


export type ShippoRateOption = {
  rate_id: string;
  shipment_id: string;
  amount_cad: number;
  base_rate_cad: number;
  handling_fee_cad: number;
  carrier: string;
  service_level: string;
  service_name: string;
  estimated_days: number | null;
};

export type ShopRatesResponse = {
  fulfillment_type: 'ship' | 'pickup';
  shipment_id?: string;
  shipping_cad: number;
  handling_fee_cad: number;
  rates: ShippoRateOption[];
  ship_by_business_days: number;
  made_to_order: boolean;
  high_value: { requires_signature: boolean; requires_insurance: boolean };
  postal_code?: string;
};

export type ShopOrderListItem = {
  id: string;
  product_id: string;
  product_title: string;
  product_price_cad: number;
  total_cad: number;
  status: string;
  fulfillment_type: string;
  ship_by_business_days: number;
  paid_at: string | null;
  vendor_name: string;
  tracking_number?: string | null;
  tracking_url?: string | null;
  tracking_status?: string | null;
  first_scan_at?: string | null;
  delivered_at?: string | null;
};

export function formatShopOrderStatus(order: ShopOrderListItem): string {
  if (order.fulfillment_type === 'pickup') {
    if (order.status === 'paid_awaiting_fulfillment') return 'Ready for pickup';
    if (order.status === 'completed') return 'Picked up';
  }
  const labels: Record<string, string> = {
    paid_awaiting_fulfillment: 'Processing',
    label_purchased: 'Label printed',
    shipped: 'Shipped',
    completed: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    disputed: 'Disputed',
  };
  return labels[order.status] ?? order.status.replace(/_/g, ' ');
}

async function shopHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return buildBookingApiHeaders(session?.access_token);
}

export async function fetchShopProducts(params?: {
  q?: string;
  category?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<{ products: ShopProductListItem[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.category) sp.set('category', params.category);
  if (params?.sort) sp.set('sort', params.sort);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));

  const res = await fetch(`${BOOK_API_BASE}/api/shop/products?${sp.toString()}`);
  const data = (await res.json().catch(() => ({}))) as {
    products?: ShopProductListItem[];
    total?: number;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? 'Could not load shop products');
  return { products: data.products ?? [], total: data.total ?? 0 };
}

export async function fetchShopProduct(
  id: string
): Promise<{ product: ShopProductDetail; vendor: ShopVendorSummary }> {
  const headers = await shopHeaders();
  const res = await fetch(`${BOOK_API_BASE}/api/shop/products/${id}`, { headers });
  const data = (await res.json().catch(() => ({}))) as {
    product?: ShopProductDetail;
    vendor?: ShopVendorSummary;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? 'Product not found');
  if (!data.product || !data.vendor) throw new Error('Product not found');
  return { product: data.product, vendor: data.vendor };
}

export async function fetchShopRates(body: {
  product_id: string;
  fulfillment_type: 'ship' | 'pickup';
  postal_code?: string;
}): Promise<ShopRatesResponse> {
  const headers = await shopHeaders();
  const res = await fetch(`${BOOK_API_BASE}/api/shop/rates`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ShopRatesResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Could not fetch shipping rates');
  return data;
}

export async function fetchShopOrders(): Promise<ShopOrderListItem[]> {
  const headers = await shopHeaders();
  const res = await fetch(`${BOOK_API_BASE}/api/shop/orders`, { headers });
  const data = (await res.json().catch(() => ({}))) as {
    orders?: ShopOrderListItem[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? 'Could not load orders');
  return data.orders ?? [];
}
