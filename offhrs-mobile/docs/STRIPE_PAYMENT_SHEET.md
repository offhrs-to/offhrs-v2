# Stripe Payment Sheet (card, Apple Pay, Google Pay)

This app uses [`@stripe/stripe-react-native`](https://stripe.com/docs/payments/accept-a-payment?platform=react-native) with **Payment Sheet**: one native UI for saved wallets, new wallets, and manual card entry.

End-to-end flow:

1. Mobile `POST` to your backend `/api/book` with `event_id`, `attendee_name`, `attendee_email`, optional `start_time` (and `Authorization: Bearer` for the Supabase session).
2. Backend creates a **PaymentIntent** (Connect destination charge for SaaS vendors) and returns `clientSecret` + `paymentIntentId`.
3. App calls `initPaymentSheet` then `presentPaymentSheet` (see `lib/saas-booking-mobile.ts`).
4. On success, app `POST`s `/api/book/confirm` with `paymentIntentId` so the server inserts the booking after verifying `pi.status === 'succeeded'`.

### Tax (Stripe Tax)

- Workshop `price_cad` is **before tax**. Tax is calculated via Stripe Tax on the **vendor Connect account** (vendor liability) using the buyer’s Canadian postal code (from profile or `customer_address`).
- `POST /api/book/quote` previews subtotal / tax / total.
- Partners subscriptions use Stripe Checkout `automatic_tax` on the **platform** account.
- Vendors must complete **Stripe Tax** setup on their Express account (head office + registrations) or tax may calculate as $0.

## Configuration in this repo

| Piece | Where |
| --- | --- |
| Expo config plugin (Apple Pay merchant id, Google Pay flag) | `app.config.js` → `withStripePlugin` |
| Publishable key at runtime | `extra.stripePublishableKey` from `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Root `StripeProvider` | `app/_layout.tsx` → `StripeRoot` (`merchantIdentifier`, `urlScheme` aligned with `app.json` `scheme`) |
| Sheet init + wallets | `lib/saas-booking-mobile.ts` (`applePay`, `googlePay`, `returnURL`) |

**Important:** After changing the Stripe plugin or merchant id, create a **new dev build** (`eas build` / `expo prebuild` + native run). OTA updates cannot add native Stripe / Apple Pay entitlements.

## Environment variables

- **Mobile:** `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` — use test `pk_test_…` in development; production `pk_live_…` only in store/release pipelines.
- **Mobile (preview API):** `EXPO_PUBLIC_BOOK_API_BASE` — Vercel Preview origin for `/api/book` (no trailing slash). Defaults to `https://offhrs.app` if unset. The EAS **preview** profile sets this in `eas.json`; override via EAS secret if your branch URL differs.
- **EAS:** add the same secret name to **Project → Secrets** so `app.config.js` sees it during cloud builds.
- **Backend:** `STRIPE_SECRET_KEY` must match the same Stripe mode (test vs live) as the publishable key.

## Apple Pay

1. **Apple Developer:** create a **Merchant ID** (e.g. `merchant.com.offhrs.app`) and enable **Apple Pay** capability on the iOS app identifier used by EAS.
2. **Xcode / EAS:** the `@stripe/stripe-react-native` config plugin wires the merchant id into the native project; keep `StripeProvider` `merchantIdentifier` in sync.
3. **Stripe Dashboard:** **Settings → Payment methods → Apple Pay** — register the iOS app / merchant id as Stripe documents (follow the Dashboard wizard).
4. **PaymentIntent:** wallets still settle as **card** payment methods; this project uses `payment_method_types: ['card']` on the PI, which is compatible with Apple Pay in the Payment Sheet.

`initPaymentSheet` passes `applePay: { merchantCountryCode: 'CA' }` on iOS so the sheet can offer Apple Pay for CAD charges.

## Google Pay

1. **Stripe Dashboard:** ensure **Google Pay** is enabled for your account (test mode has its own toggle).
2. **Android:** the plugin is added with `enableGooglePay: true`. The device must have Google Play services and a wallet configured.
3. **App code:** `googlePay: { merchantCountryCode: 'CA', currencyCode: 'CAD', testEnv: __DEV__ }` in `initPaymentSheet` (see `saas-booking-mobile.ts`). Set `testEnv: false` for production builds if you rely on that flag for the Google Pay environment.

## Manual card entry

You do **not** implement a separate card form for the default flow. **Payment Sheet** includes card number, expiry, and CVC fields when the user chooses “Pay with card” (or when no wallet is available). 3-D Secure, if required by the issuer, is handled inside the sheet.

## `returnURL` and 3DS

`Linking.createURL('stripe-redirect')` is passed as `returnURL` so Stripe can return to the app after browser-based steps. Ensure your Expo **scheme** (`offhrsmobile` in `app.json`) matches `StripeProvider` **`urlScheme`**. If you add a dedicated `app/stripe-redirect.tsx` route later, keep the path segment consistent with `createURL`.

## Test vs production

- Use **Stripe test cards** and test Apple Pay / Google Pay sandboxes while `pk_test_…` is in use.
- Switching to live requires live keys, Dashboard Apple Pay / Google Pay production setup, and store-signed iOS/Android builds.

## Optional next steps

- **Default saved PM:** after the first successful payment, list `customer`’s payment methods and pass `defaultBillingDetails` / customer sheet flows (Stripe Customer Sheet) for one-tap repeat booking.
- **Web:** `runPaidWorkshopBooking` intentionally returns an error on `Platform.OS === 'web'`; use Checkout or Elements on web if needed.
