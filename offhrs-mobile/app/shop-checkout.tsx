import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import { runShopCheckout } from '@/lib/shop-checkout-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CA_PROVINCES = ['ON', 'BC', 'AB', 'QC', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'YT', 'NU'];

export default function ShopCheckoutScreen() {
  const params = useLocalSearchParams<{
    productId: string;
    fulfillment: string;
    rateId?: string;
    shipmentId?: string;
    rateAmount?: string;
    postalCode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const fulfillment = params.fulfillment === 'pickup' ? 'pickup' : 'ship';

  const [name, setName] = useState(user?.user_metadata?.display_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('ON');
  const [postalCode, setPostalCode] = useState(params.postalCode ?? '');
  const [submitting, setSubmitting] = useState(false);

  const onPay = async () => {
    if (!params.productId) return;
    if (!name.trim() || !email.trim()) {
      Alert.alert('Details required', 'Enter your name and email.');
      return;
    }
    if (fulfillment === 'ship' && (!line1.trim() || !city.trim() || !postalCode.trim())) {
      Alert.alert('Address required', 'Enter your shipping address.');
      return;
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
              postal_code: postalCode.trim(),
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: DesignColors.creamBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
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

        <Text style={{ marginTop: 20, fontWeight: '600' }}>Name</Text>
        <TextInput value={name} onChangeText={setName} style={inputStyle} />

        <Text style={{ marginTop: 12, fontWeight: '600' }}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={inputStyle} />

        {fulfillment === 'ship' ? (
          <>
            <Text style={{ marginTop: 12, fontWeight: '600' }}>Address</Text>
            <TextInput value={line1} onChangeText={setLine1} placeholder="Street address" style={inputStyle} />
            <TextInput value={line2} onChangeText={setLine2} placeholder="Apt / unit (optional)" style={[inputStyle, { marginTop: 8 }]} />
            <TextInput value={city} onChangeText={setCity} placeholder="City" style={[inputStyle, { marginTop: 8 }]} />
            <TextInput value={province} onChangeText={setProvince} placeholder="Province" style={[inputStyle, { marginTop: 8 }]} />
            <TextInput value={postalCode} onChangeText={setPostalCode} placeholder="Postal code" autoCapitalize="characters" style={[inputStyle, { marginTop: 8 }]} />
            <Text style={{ marginTop: 8, fontSize: 12, color: DesignColors.mediumGray }}>
              Province: {CA_PROVINCES.join(', ')}
            </Text>
          </>
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
