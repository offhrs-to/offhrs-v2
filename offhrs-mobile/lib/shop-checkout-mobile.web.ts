import type { ShopCheckoutAddress, ShopCheckoutResult } from '@/lib/shop-checkout-mobile.types';

export type { ShopCheckoutAddress, ShopCheckoutResult } from '@/lib/shop-checkout-mobile.types';

/** Stripe Payment Sheet is native-only — web Expo must not import stripe-react-native. */
export async function runShopCheckout(_params: {
  productId: string;
  fulfillmentType: 'ship' | 'pickup';
  buyerName: string;
  buyerEmail: string;
  shipAddress?: ShopCheckoutAddress;
  shippoRateId?: string;
  shippoShipmentId?: string;
  shippoRateAmountCad?: number;
}): Promise<ShopCheckoutResult> {
  return {
    ok: false,
    message: 'Use the iOS or Android app to complete shop checkout (not Expo web).',
  };
}
