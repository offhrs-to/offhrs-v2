import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';

import { BOOK_API_BASE } from '@/constants/api';
import { bookingApiErrorMessage, buildBookingApiHeaders } from '@/lib/booking-api-headers';
import { supabase } from '@/lib/supabase';
import type { ShopCheckoutAddress, ShopCheckoutResult } from '@/lib/shop-checkout-mobile.types';

export type { ShopCheckoutAddress, ShopCheckoutResult } from '@/lib/shop-checkout-mobile.types';

function resolveStripePublishableKey(): string {
  const extra = (
    Constants.expoConfig?.extra as { stripePublishableKey?: string } | undefined
  )?.stripePublishableKey;
  return (extra ?? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim();
}

export async function runShopCheckout(params: {
  productId: string;
  fulfillmentType: 'ship' | 'pickup';
  buyerName: string;
  buyerEmail: string;
  shipAddress?: ShopCheckoutAddress;
  shippoRateId?: string;
  shippoShipmentId?: string;
  shippoRateAmountCad?: number;
}): Promise<ShopCheckoutResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, message: 'Sign in to purchase in the app.' };
  }

  const headers = await buildBookingApiHeaders(session.access_token);

  const checkoutRes = await fetch(`${BOOK_API_BASE}/api/shop/checkout`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: params.productId,
      fulfillment_type: params.fulfillmentType,
      buyer_name: params.buyerName.trim(),
      buyer_email: params.buyerEmail.trim(),
      ...(params.shipAddress ? { ship_address: params.shipAddress } : {}),
      ...(params.shippoRateId ? { shippo_rate_id: params.shippoRateId } : {}),
      ...(params.shippoShipmentId ? { shippo_shipment_id: params.shippoShipmentId } : {}),
      ...(params.shippoRateAmountCad != null
        ? { shippo_rate_amount_cad: params.shippoRateAmountCad }
        : {}),
    }),
  });

  const checkoutData = (await checkoutRes.json().catch(() => ({}))) as Record<string, unknown>;

  if (!checkoutRes.ok) {
    return {
      ok: false,
      message: bookingApiErrorMessage(checkoutRes.status, checkoutData.error as string | undefined),
    };
  }

  const clientSecret = checkoutData.clientSecret as string | undefined;
  const paymentIntentId = checkoutData.paymentIntentId as string | undefined;

  if (!clientSecret || !paymentIntentId) {
    return { ok: false, message: (checkoutData.error as string) || 'Invalid payment response' };
  }

  const returnURL = Linking.createURL('stripe-redirect');
  const stripePublishableKey = resolveStripePublishableKey();
  const googlePayTestEnv = __DEV__ || stripePublishableKey.startsWith('pk_test_');

  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'Offhrs',
    paymentIntentClientSecret: clientSecret,
    defaultBillingDetails: {
      name: params.buyerName.trim(),
      email: params.buyerEmail.trim(),
    },
    returnURL,
    applePay: Platform.OS === 'ios' ? { merchantCountryCode: 'CA' } : undefined,
    googlePay:
      Platform.OS === 'android'
        ? {
            merchantCountryCode: 'CA',
            currencyCode: 'CAD',
            testEnv: googlePayTestEnv,
          }
        : undefined,
    allowsDelayedPaymentMethods: false,
  });

  if (initError) {
    return { ok: false, message: initError.message };
  }

  const { error: presentError } = await presentPaymentSheet();
  if (presentError) {
    if (presentError.code === 'Canceled') {
      return { ok: false, cancelled: true, message: 'Payment cancelled' };
    }
    return { ok: false, message: presentError.message };
  }

  const confirmRes = await fetch(`${BOOK_API_BASE}/api/shop/checkout/confirm`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId }),
  });

  const confirmData = (await confirmRes.json().catch(() => ({}))) as {
    error?: string;
    order_id?: string;
  };

  if (!confirmRes.ok) {
    return {
      ok: false,
      message: confirmData.error ?? 'Payment succeeded but order confirmation failed.',
    };
  }

  return { ok: true, orderId: confirmData.order_id };
}
