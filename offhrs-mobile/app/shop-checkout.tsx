import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { isCaProvinceCode, provinceLabel } from '@/constants/ca-provinces';
import { useAuth } from '@/contexts/AuthContext';
import { parseCanadianPostalCode } from '@/lib/canadianPostalCode';
import {
  fetchShopProduct,
  type ShopPurchaseDisclosures,
  type ShopVendorSummary,
} from '@/lib/shop-api';
import { runShopCheckout } from '@/lib/shop-checkout-mobile';
import {
  fetchPlaceAddress,
  fetchPlaceSuggestions,
  type PlaceSuggestion,
} from '@/lib/places-autocomplete';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBack } from '@/lib/go-back';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatCad(price: number): string {
  return `$${price.toFixed(2)}`;
}

function formatPickupLocation(vendor: ShopVendorSummary): string | null {
  if (!vendor.shop_pickup_line1?.trim()) return null;
  const cityLine = [vendor.shop_pickup_city, vendor.shop_pickup_province, vendor.shop_pickup_postal_code]
    .filter(Boolean)
    .join(', ');
  return [vendor.shop_pickup_line1, vendor.shop_pickup_line2, cityLine].filter(Boolean).join('\n');
}

export default function ShopCheckoutScreen() {
  const params = useLocalSearchParams<{
    productId: string;
    fulfillment: string;
    productTitle?: string;
    itemPrice?: string;
    rateId?: string;
    shipmentId?: string;
    rateAmount?: string;
    postalCode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const fulfillment = params.fulfillment === 'pickup' ? 'pickup' : 'ship';
  const itemPrice = params.itemPrice ? Number(params.itemPrice) : null;
  const shippingPrice = params.rateAmount ? Number(params.rateAmount) : 0;

  const [name, setName] = useState(user?.user_metadata?.display_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  // Launch scope: Artist Marketplace ships within Ontario only.
  const [province] = useState('ON');
  const [postalCode, setPostalCode] = useState(params.postalCode ?? '');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [pickupVendor, setPickupVendor] = useState<ShopVendorSummary | null>(null);
  const [disclosures, setDisclosures] = useState<ShopPurchaseDisclosures | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([]);
  const [addressSuggestLoading, setAddressSuggestLoading] = useState(false);
  const addressSuggestSeq = useRef(0);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!params.productId) return;
    void fetchShopProduct(params.productId)
      .then((data) => {
        if (fulfillment === 'pickup') setPickupVendor(data.vendor);
        setDisclosures(data.purchase_disclosures);
      })
      .catch(() => {
        if (fulfillment === 'pickup') setPickupVendor(null);
        setDisclosures(null);
      });
  }, [fulfillment, params.productId]);

  useEffect(() => {
    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    };
  }, []);

  function onStreetAddressChange(text: string) {
    setLine1(text);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (text.trim().length < 3) {
      setAddressSuggestions([]);
      setAddressSuggestLoading(false);
      return;
    }
    setAddressSuggestLoading(true);
    const seq = ++addressSuggestSeq.current;
    addressDebounceRef.current = setTimeout(() => {
      void fetchPlaceSuggestions(text).then((suggestions) => {
        if (seq !== addressSuggestSeq.current) return;
        setAddressSuggestions(suggestions);
        setAddressSuggestLoading(false);
      });
    }, 280);
  }

  async function applyAddressSuggestion(suggestion: PlaceSuggestion) {
    setAddressSuggestions([]);
    setAddressSuggestLoading(true);
    try {
      const address = await fetchPlaceAddress(suggestion.place_id);
      if (!address) {
        setLine1(suggestion.main_text || suggestion.description);
        return;
      }
      setLine1(address.line1);
      if (address.line2) setLine2(address.line2);
      setCity(address.city);
      if (address.province && isCaProvinceCode(address.province) && address.province !== 'ON') {
        Alert.alert(
          'Ontario only',
          'Artist Marketplace currently ships within Ontario only. Choose an Ontario address.'
        );
      }
      if (address.postal_code) setPostalCode(address.postal_code);
    } finally {
      setAddressSuggestLoading(false);
    }
  }

  const onPay = async () => {
    if (!params.productId) return;
    // Sync lock: React state alone can miss double-taps while PaymentSheet lags.
    if (submittingRef.current || submitting) return;
    if (!name.trim() || !email.trim()) {
      Alert.alert('Details required', 'Enter your name and email.');
      return;
    }
    if (fulfillment === 'ship') {
      const postal = parseCanadianPostalCode(postalCode);
      if (!line1.trim() || !city.trim() || !postal) {
        Alert.alert('Address required', 'Enter a complete Canadian shipping address.');
        return;
      }
      const fsa = postal.replace(/\s/g, '').charAt(0).toUpperCase();
      if (!['K', 'L', 'M', 'N', 'P'].includes(fsa)) {
        Alert.alert(
          'Ontario only',
          'Artist Marketplace currently ships within Ontario only (postal codes starting with K, L, M, N, or P).'
        );
        return;
      }
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await runShopCheckout({
        productId: params.productId,
        fulfillmentType: fulfillment,
        buyerName: name.trim(),
        buyerEmail: email.trim(),
        ...(fulfillment === 'ship'
          ? {
              shipAddress: {
                name: name.trim(),
                line1: line1.trim(),
                line2: line2.trim() || undefined,
                city: city.trim(),
                province: province.trim(),
                postal_code: parseCanadianPostalCode(postalCode) ?? postalCode.trim(),
              },
              shippoRateId: params.rateId || undefined,
              shippoShipmentId: params.shipmentId || undefined,
              shippoRateAmountCad: params.rateAmount ? Number(params.rateAmount) : undefined,
            }
          : {}),
      });

      if (result.ok) {
        Alert.alert(
          'Order placed',
          result.message ?? 'Thank you! View your order in Profile → Orders.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/profile') }]
        );
        return;
      }
      if (result.cancelled) return;
      Alert.alert('Checkout', result.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const summaryItem = itemPrice;
  const summaryShipping = fulfillment === 'ship' ? shippingPrice : 0;
  const summaryBeforeTax =
    summaryItem != null ? summaryItem + (Number.isFinite(summaryShipping) ? summaryShipping : 0) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: DesignColors.creamBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: DesignSpacing.horizontalPadding,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 100,
        }}
      >
        <Pressable onPress={() => goBack(router)} style={{ marginBottom: 16 }}>
          <Text style={{ color: DesignColors.primary, fontWeight: '600' }}>← Back</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: '700', color: DesignColors.charcoal }}>Checkout</Text>
        <Text style={{ marginTop: 8, color: DesignColors.mediumGray }}>
          {fulfillment === 'pickup' ? 'Local pickup' : 'Ship to address'}
        </Text>
        {params.productTitle ? (
          <Text style={{ marginTop: 8, fontSize: 15, fontWeight: '600', color: DesignColors.charcoal }}>
            {params.productTitle}
          </Text>
        ) : null}

        {fulfillment === 'pickup' && pickupVendor ? (
          <View
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
              backgroundColor: '#fff',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: DesignColors.charcoal }}>
              Pickup location
            </Text>
            {formatPickupLocation(pickupVendor) ? (
              <Text style={{ marginTop: 6, fontSize: 14, color: DesignColors.charcoal, lineHeight: 20 }}>
                {formatPickupLocation(pickupVendor)}
              </Text>
            ) : (
              <Text style={{ marginTop: 6, fontSize: 13, color: DesignColors.mediumGray }}>
                Pickup address not configured by seller.
              </Text>
            )}
            {pickupVendor.shop_pickup_arrange_by_contact ? (
              <Text style={{ marginTop: 8, fontSize: 13, color: DesignColors.mediumGray, lineHeight: 18 }}>
                After checkout, email the seller from Profile → Orders to arrange pickup.
              </Text>
            ) : pickupVendor.shop_pickup_hours ? (
              <Text style={{ marginTop: 8, fontSize: 13, color: DesignColors.mediumGray }}>
                Hours: {pickupVendor.shop_pickup_hours}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={{ marginTop: 20, fontWeight: '600' }}>Name</Text>
        <TextInput value={name} onChangeText={setName} style={inputStyle} />

        <Text style={{ marginTop: 12, fontWeight: '600' }}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={inputStyle}
        />

        {fulfillment === 'ship' ? (
          <>
            <Text style={{ marginTop: 12, fontWeight: '600' }}>Street address</Text>
            <TextInput
              value={line1}
              onChangeText={onStreetAddressChange}
              placeholder="Start typing a Canadian address"
              autoCorrect={false}
              style={inputStyle}
            />
            {addressSuggestLoading ? (
              <Text style={{ marginTop: 6, fontSize: 12, color: DesignColors.mediumGray }}>
                Looking up addresses…
              </Text>
            ) : null}
            {addressSuggestions.length > 0 ? (
              <View
                style={{
                  marginTop: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  backgroundColor: '#fff',
                  overflow: 'hidden',
                }}
              >
                {addressSuggestions.map((s) => (
                  <Pressable
                    key={s.place_id}
                    onPress={() => void applyAddressSuggestion(s)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: DesignColors.lightGreenBorder,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.charcoal }}>
                      {s.main_text}
                    </Text>
                    {s.secondary_text ? (
                      <Text style={{ fontSize: 12, color: DesignColors.mediumGray, marginTop: 2 }}>
                        {s.secondary_text}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={{ marginTop: 12, fontWeight: '600' }}>Apt / unit (optional)</Text>
            <TextInput
              value={line2}
              onChangeText={setLine2}
              placeholder="Apt, suite, buzzer"
              style={inputStyle}
            />

            <Text style={{ marginTop: 12, fontWeight: '600' }}>City</Text>
            <TextInput value={city} onChangeText={setCity} placeholder="City" style={inputStyle} />

            <Text style={{ marginTop: 12, fontWeight: '600' }}>Province</Text>
            <View style={[inputStyle, { justifyContent: 'center', backgroundColor: '#F4F6F2' }]}>
              <Text style={{ color: DesignColors.charcoal }}>{provinceLabel(province)} (launch)</Text>
            </View>
            <Text style={{ marginTop: 6, fontSize: 12, color: DesignColors.mediumGray }}>
              Artist Marketplace currently ships within Ontario only.
            </Text>

            <Text style={{ marginTop: 12, fontWeight: '600' }}>Postal code</Text>
            <TextInput
              value={postalCode}
              onChangeText={setPostalCode}
              placeholder="M5V 2T6"
              autoCapitalize="characters"
              style={inputStyle}
            />
          </>
        ) : null}

        {summaryItem != null ? (
          <View
            style={{
              marginTop: 20,
              padding: 14,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
              backgroundColor: '#fff',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: DesignColors.charcoal, marginBottom: 10 }}>
              Order summary
            </Text>
            <View style={summaryRowStyle}>
              <Text style={summaryLabelStyle}>Item</Text>
              <Text style={summaryValueStyle}>{formatCad(summaryItem)}</Text>
            </View>
            <View style={summaryRowStyle}>
              <Text style={summaryLabelStyle}>
                {fulfillment === 'pickup' ? 'Pickup' : 'Shipping'}
              </Text>
              <Text style={summaryValueStyle}>
                {summaryShipping > 0 ? formatCad(summaryShipping) : 'Free'}
              </Text>
            </View>
            <View style={summaryRowStyle}>
              <Text style={summaryLabelStyle}>Tax</Text>
              <Text style={summaryValueStyle}>At payment</Text>
            </View>
            <View
              style={[
                summaryRowStyle,
                {
                  marginTop: 8,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: DesignColors.lightGreenBorder,
                },
              ]}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: DesignColors.charcoal }}>
                Subtotal
              </Text>
              {summaryBeforeTax != null ? (
                <Text style={{ fontSize: 15, fontWeight: '700', color: DesignColors.primary }}>
                  {formatCad(summaryBeforeTax)} CAD
                </Text>
              ) : (
                <Text style={summaryValueStyle}>—</Text>
              )}
            </View>
            <Text style={{ marginTop: 8, fontSize: 12, color: DesignColors.mediumGray }}>
              GST/HST is calculated when you pay.
            </Text>
          </View>
        ) : null}

        {disclosures ? (
          <View
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
              backgroundColor: '#fff',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: DesignColors.charcoal, marginBottom: 10 }}>
              Purchase details
            </Text>
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginBottom: 4 }}>Seller</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: DesignColors.charcoal }}>
              {disclosures.seller_name}
            </Text>
            {disclosures.seller_address ? (
              <Text style={{ marginTop: 6, fontSize: 13, color: DesignColors.charcoal, lineHeight: 18 }}>
                {disclosures.seller_address}
              </Text>
            ) : null}
            {disclosures.seller_website ? (
              <Pressable
                onPress={() => void Linking.openURL(disclosures.seller_website!)}
                style={{ marginTop: 6 }}
              >
                <Text style={{ fontSize: 13, color: DesignColors.primary, fontWeight: '600' }}>
                  {disclosures.seller_website}
                </Text>
              </Pressable>
            ) : null}
            <Text style={{ marginTop: 12, fontSize: 13, color: DesignColors.mediumGray, marginBottom: 4 }}>
              Delivery
            </Text>
            <Text style={{ fontSize: 13, color: DesignColors.charcoal, lineHeight: 18 }}>
              {fulfillment === 'pickup' ? disclosures.delivery_pickup : disclosures.delivery_ship}
            </Text>
            <Text style={{ marginTop: 12, fontSize: 13, color: DesignColors.mediumGray, marginBottom: 4 }}>
              Cancel / returns
            </Text>
            <Text style={{ fontSize: 13, color: DesignColors.charcoal, lineHeight: 18 }}>
              {fulfillment === 'pickup'
                ? disclosures.cancel_return_pickup
                : disclosures.cancel_return_ship}
            </Text>
            <Text style={{ marginTop: 12, fontSize: 13, color: DesignColors.mediumGray, marginBottom: 4 }}>
              Support
            </Text>
            <Pressable onPress={() => void Linking.openURL(`mailto:${disclosures.support_email}`)}>
              <Text style={{ fontSize: 13, color: DesignColors.primary, fontWeight: '600' }}>
                {disclosures.support_email}
              </Text>
            </Pressable>
            <Text style={{ marginTop: 4, fontSize: 12, color: DesignColors.mediumGray }}>
              Or Profile → Orders in the app
            </Text>
            <Text style={{ marginTop: 12, fontSize: 12, color: DesignColors.mediumGray }}>
              Terms version {disclosures.terms_version} ·{' '}
              <Text
                style={{ color: DesignColors.primary, fontWeight: '600' }}
                onPress={() => void Linking.openURL(disclosures.terms_url)}
              >
                Terms of Use
              </Text>
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={onPay}
          disabled={submitting}
          style={{
            marginTop: 24,
            paddingVertical: 14,
            borderRadius: 24,
            backgroundColor: DesignColors.primary,
            alignItems: 'center',
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Pay with card</Text>
          )}
        </Pressable>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: DesignColors.lightGreenBorder,
  borderRadius: 8,
  padding: 12,
  backgroundColor: '#fff',
  marginTop: 6,
} as const;

const summaryRowStyle = {
  flexDirection: 'row' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
  marginBottom: 6,
};

const summaryLabelStyle = { fontSize: 14, color: DesignColors.mediumGray };
const summaryValueStyle = { fontSize: 14, color: DesignColors.charcoal, fontWeight: '600' as const };
