import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { CA_PROVINCES, isCaProvinceCode, provinceLabel } from '@/constants/ca-provinces';
import { useAuth } from '@/contexts/AuthContext';
import { parseCanadianPostalCode } from '@/lib/canadianPostalCode';
import { fetchShopProduct, type ShopVendorSummary } from '@/lib/shop-api';
import { runShopCheckout } from '@/lib/shop-checkout-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
  const [province, setProvince] = useState('ON');
  const [postalCode, setPostalCode] = useState(params.postalCode ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const [pickupVendor, setPickupVendor] = useState<ShopVendorSummary | null>(null);

  useEffect(() => {
    if (fulfillment !== 'pickup' || !params.productId) return;
    void fetchShopProduct(params.productId)
      .then((data) => setPickupVendor(data.vendor))
      .catch(() => setPickupVendor(null));
  }, [fulfillment, params.productId]);

  const onPay = async () => {
    if (!params.productId) return;
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
      if (!isCaProvinceCode(province)) {
        Alert.alert('Province required', 'Select a province or territory.');
        return;
      }
    }

    setSubmitting(true);
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
    setSubmitting(false);

    if (result.ok) {
      Alert.alert('Order placed', 'Thank you! View your order in Profile → Orders.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
      ]);
      return;
    }
    if (result.cancelled) return;
    Alert.alert('Checkout', result.message);
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
        <Pressable onPress={() => router.back()} style={{ marginBottom: 16 }}>
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
            {pickupVendor.shop_pickup_hours ? (
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
              onChangeText={setLine1}
              placeholder="123 Main Street"
              autoCorrect={false}
              style={inputStyle}
            />

            <Text style={{ marginTop: 12, fontWeight: '600' }}>Apt / unit (optional)</Text>
            <TextInput
              value={line2}
              onChangeText={setLine2}
              placeholder="Apt, suite, buzzer"
              style={inputStyle}
            />

            <Text style={{ marginTop: 12, fontWeight: '600' }}>City</Text>
            <TextInput value={city} onChangeText={setCity} placeholder="City" style={inputStyle} />

            <Text style={{ marginTop: 12, fontWeight: '600' }}>Province / territory</Text>
            <Pressable
              onPress={() => setProvincePickerOpen(true)}
              style={[inputStyle, { justifyContent: 'center' }]}
            >
              <Text style={{ color: DesignColors.charcoal }}>{provinceLabel(province)}</Text>
            </Pressable>

            <Text style={{ marginTop: 12, fontWeight: '600' }}>Postal code</Text>
            <TextInput
              value={postalCode}
              onChangeText={setPostalCode}
              placeholder="A1A 1A1"
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

      <Modal
        visible={provincePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProvincePickerOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setProvincePickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '70%',
              paddingBottom: insets.bottom + 12,
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: DesignColors.lightGreenBorder,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: DesignColors.charcoal }}>
                Select province / territory
              </Text>
            </View>
            <ScrollView>
              {CA_PROVINCES.map((p) => (
                <Pressable
                  key={p.code}
                  onPress={() => {
                    setProvince(p.code);
                    setProvincePickerOpen(false);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: DesignColors.lightGreenBorder,
                    backgroundColor: province === p.code ? '#E8F0E5' : '#fff',
                  }}
                >
                  <Text style={{ fontWeight: '600', color: DesignColors.charcoal }}>
                    {p.code} — {p.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
