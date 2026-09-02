import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { CA_PROVINCES, isCaProvinceCode, provinceLabel } from '@/constants/ca-provinces';
import { useAuth } from '@/contexts/AuthContext';
import { parseCanadianPostalCode } from '@/lib/canadianPostalCode';
import {
  fetchPlaceAddress,
  fetchPlaceSuggestions,
  type PlaceSuggestion,
} from '@/lib/places-autocomplete';
import { runShopCheckout } from '@/lib/shop-checkout-mobile';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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

  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [provincePickerOpen, setProvincePickerOpen] = useState(false);
  const suggestSeq = useRef(0);

  const onAddressQueryChange = useCallback((text: string) => {
    setAddressQuery(text);
    setLine1(text);
    setSuggestionsOpen(true);
  }, []);

  useEffect(() => {
    if (fulfillment !== 'ship') return;
    const q = addressQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const seq = ++suggestSeq.current;
    setSuggestionsLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const list = await fetchPlaceSuggestions(q);
          if (seq !== suggestSeq.current) return;
          setSuggestions(list);
        } catch {
          if (seq !== suggestSeq.current) return;
          setSuggestions([]);
        } finally {
          if (seq === suggestSeq.current) setSuggestionsLoading(false);
        }
      })();
    }, 300);

    return () => clearTimeout(t);
  }, [addressQuery, fulfillment]);

  const onSelectSuggestion = async (s: PlaceSuggestion) => {
    setSuggestionsOpen(false);
    setSuggestions([]);
    setSuggestionsLoading(true);
    try {
      const address = await fetchPlaceAddress(s.place_id);
      setAddressQuery(address.line1);
      setLine1(address.line1);
      setLine2(address.line2 ?? '');
      setCity(address.city);
      if (isCaProvinceCode(address.province)) {
        setProvince(address.province);
      }
      const postal = parseCanadianPostalCode(address.postal_code) ?? address.postal_code;
      setPostalCode(postal);
    } catch (e) {
      Alert.alert(
        'Address',
        e instanceof Error ? e.message : 'Could not fill address from Google Places.'
      );
      setAddressQuery(s.main_text);
      setLine1(s.main_text);
    } finally {
      setSuggestionsLoading(false);
    }
  };

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
            <Text style={{ marginTop: 4, fontSize: 12, color: DesignColors.mediumGray }}>
              Start typing — Google suggestions will appear
            </Text>
            <TextInput
              value={addressQuery}
              onChangeText={onAddressQueryChange}
              onFocus={() => setSuggestionsOpen(true)}
              placeholder="123 Main Street"
              autoCorrect={false}
              style={inputStyle}
            />

            {suggestionsOpen && (suggestionsLoading || suggestions.length > 0) ? (
              <View
                style={{
                  marginTop: 4,
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  overflow: 'hidden',
                }}
              >
                {suggestionsLoading ? (
                  <View style={{ padding: 12, alignItems: 'center' }}>
                    <ActivityIndicator color={DesignColors.primary} />
                  </View>
                ) : (
                  suggestions.map((s) => (
                    <Pressable
                      key={s.place_id}
                      onPress={() => void onSelectSuggestion(s)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: DesignColors.lightGreenBorder,
                      }}
                    >
                      <Text style={{ fontWeight: '600', color: DesignColors.charcoal }}>
                        {s.main_text}
                      </Text>
                      {s.secondary_text ? (
                        <Text style={{ marginTop: 2, fontSize: 12, color: DesignColors.mediumGray }}>
                          {s.secondary_text}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            <TextInput
              value={line2}
              onChangeText={setLine2}
              placeholder="Apt / unit (optional)"
              style={[inputStyle, { marginTop: 8 }]}
            />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="City"
              style={[inputStyle, { marginTop: 8 }]}
            />

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
