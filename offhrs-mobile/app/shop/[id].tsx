import WorkshopsChrome from '@/components/WorkshopsChrome';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchShopProduct,
  fetchShopRates,
  type ShippoRateOption,
  type ShopProductDetail,
  type ShopVendorSummary,
} from '@/lib/shop-api';
import { parseCanadianPostalCode } from '@/lib/canadianPostalCode';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatCad(price: number): string {
  return `$${price.toFixed(2)} CAD`;
}

function buildCheckoutRedirect(
  product: ShopProductDetail,
  fulfillment: 'ship' | 'pickup',
  selectedRate: ShippoRateOption | null,
  postalCode: string
): string {
  const q = new URLSearchParams();
  q.set('productId', product.id);
  q.set('fulfillment', fulfillment);
  q.set('productTitle', product.title);
  q.set('itemPrice', String(product.price_cad));
  if (selectedRate) {
    q.set('rateId', selectedRate.rate_id);
    q.set('shipmentId', selectedRate.shipment_id);
    q.set('rateAmount', String(selectedRate.amount_cad));
  }
  const postal = parseCanadianPostalCode(postalCode);
  if (postal) q.set('postalCode', postal);
  return `/shop-checkout?${q.toString()}`;
}

function formatPickupLocation(vendor: ShopVendorSummary): string | null {
  if (!vendor.shop_pickup_line1?.trim()) return null;
  const cityLine = [vendor.shop_pickup_city, vendor.shop_pickup_province, vendor.shop_pickup_postal_code]
    .filter(Boolean)
    .join(', ');
  return [vendor.shop_pickup_line1, vendor.shop_pickup_line2, cityLine].filter(Boolean).join('\n');
}

export default function ShopProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();

  const [product, setProduct] = useState<ShopProductDetail | null>(null);
  const [vendor, setVendor] = useState<ShopVendorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [postalCode, setPostalCode] = useState('');
  const [fulfillment, setFulfillment] = useState<'ship' | 'pickup'>('ship');
  const [rates, setRates] = useState<ShippoRateOption[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippoRateOption | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [shipByDays, setShipByDays] = useState(5);
  const [madeToOrder, setMadeToOrder] = useState(false);
  const [highValue, setHighValue] = useState(false);

  const loadProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchShopProduct(id);
      setProduct(data.product);
      setVendor(data.vendor);
      setShipByDays(data.product.ship_by_business_days);
      setMadeToOrder(data.product.made_to_order);
      if (data.product.pickup_available && data.vendor.shop_pickup_enabled) {
        setFulfillment('ship');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Product not found');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const loadRates = useCallback(async () => {
    if (!product) return;
    setRatesLoading(true);
    setSelectedRate(null);
    try {
      const data = await fetchShopRates({
        product_id: product.id,
        fulfillment_type: fulfillment,
        postal_code:
          fulfillment === 'ship' ? parseCanadianPostalCode(postalCode) ?? undefined : undefined,
      });
      setRates(data.rates);
      setShipByDays(data.ship_by_business_days);
      setMadeToOrder(data.made_to_order);
      setHighValue(data.high_value.requires_signature);
      if (data.rates.length === 1) setSelectedRate(data.rates[0]!);
    } catch (e) {
      Alert.alert('Shipping', e instanceof Error ? e.message : 'Could not load rates');
      setRates([]);
    } finally {
      setRatesLoading(false);
    }
  }, [product, fulfillment, postalCode]);

  const onBuy = () => {
    if (!product) return;
    if (fulfillment === 'ship' && !selectedRate) {
      Alert.alert('Shipping', 'Select a shipping rate first.');
      return;
    }
    const checkoutRedirect = buildCheckoutRedirect(product, fulfillment, selectedRate, postalCode);
    if (!user) {
      router.push({ pathname: '/login', params: { redirect: checkoutRedirect } });
      return;
    }
    router.push(checkoutRedirect as never);
  };

  if (loading || !product) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DesignColors.creamBg }}>
        <ActivityIndicator color={DesignColors.primary} />
      </View>
    );
  }

  const images = (product.image_urls ?? []).filter(Boolean);
  const imageCarouselWidth = windowWidth - DesignSpacing.horizontalPadding * 2;
  const isPurchasable = product.purchasable ?? product.quantity > 0;
  const isSoldOut = !isPurchasable && product.status !== 'archived';
  const isArchived = product.status === 'archived';
  const canBuy =
    isPurchasable &&
    (fulfillment === 'pickup' || (selectedRate != null && parseCanadianPostalCode(postalCode)));

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg }}>
      <WorkshopsChrome
        showBack
        onBackPress={() => router.back()}
        hideSearchBar
        searchValue=""
        searchPlaceholder=""
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + (isPurchasable ? 120 : 32) }}>
        <View style={{ paddingHorizontal: DesignSpacing.horizontalPadding }}>
          <View
            style={{
              width: imageCarouselWidth,
              aspectRatio: 1,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
            }}
          >
            {images.length > 1 ? (
              <FlatList
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                keyExtractor={(uri, index) => `${uri}-${index}`}
                getItemLayout={(_, index) => ({
                  length: imageCarouselWidth,
                  offset: imageCarouselWidth * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={{ width: imageCarouselWidth, height: imageCarouselWidth }}
                    contentFit="contain"
                  />
                )}
              />
            ) : images.length === 1 ? (
              <Image
                source={{ uri: images[0] }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            ) : null}
          </View>

          <Text style={{ fontSize: 22, fontWeight: '700', color: DesignColors.charcoal, marginTop: 16 }}>
            {product.title}
          </Text>
          <Text style={{ fontSize: 14, color: DesignColors.mediumGray, marginTop: 4 }}>
            by {vendor?.business_name ?? 'Maker'}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: DesignColors.primary, marginTop: 8 }}>
            {formatCad(product.price_cad)}
          </Text>

          {isSoldOut || isArchived ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 12,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 9999,
                backgroundColor: isArchived ? '#F3F3F3' : '#E8F0E5',
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: DesignColors.charcoal }}>
                {isArchived ? 'Listing archived' : 'Sold'}
              </Text>
            </View>
          ) : null}

          {product.description ? (
            <Text style={{ fontSize: 15, color: DesignColors.charcoal, marginTop: 16, lineHeight: 22 }}>
              {product.description}
            </Text>
          ) : null}

          {isPurchasable ? (
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 16 }}>
              Ships within {shipByDays} business days{madeToOrder ? ' (made to order)' : ''}.
              {highValue ? ' Signature + insurance included (items over $250).' : ''}
            </Text>
          ) : (
            <Text style={{ fontSize: 13, color: DesignColors.mediumGray, marginTop: 16 }}>
              {isArchived
                ? 'This listing is no longer available to purchase.'
                : 'This item has sold out.'}
            </Text>
          )}

          {isPurchasable && product.pickup_available && vendor?.shop_pickup_enabled ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {(['ship', 'pickup'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => {
                    setFulfillment(f);
                    setRates([]);
                    setSelectedRate(null);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    backgroundColor: fulfillment === f ? DesignColors.primary : '#fff',
                    borderWidth: 1,
                    borderColor: DesignColors.lightGreenBorder,
                  }}
                >
                  <Text style={{ fontWeight: '600', color: fulfillment === f ? '#fff' : DesignColors.charcoal }}>
                    {f === 'ship' ? 'Ship' : 'Pickup'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {isPurchasable && fulfillment === 'ship' ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Your postal code</Text>
              <TextInput
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="A1A 1A1"
                autoCapitalize="characters"
                style={{
                  borderWidth: 1,
                  borderColor: DesignColors.lightGreenBorder,
                  borderRadius: 8,
                  padding: 12,
                  backgroundColor: '#fff',
                }}
              />
              <Pressable
                onPress={loadRates}
                disabled={!parseCanadianPostalCode(postalCode) || ratesLoading}
                style={{
                  marginTop: 10,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: DesignColors.primary,
                  opacity: !parseCanadianPostalCode(postalCode) || ratesLoading ? 0.5 : 1,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {ratesLoading ? 'Loading rates…' : 'Get shipping rates'}
                </Text>
              </Pressable>

              {rates.map((r) => (
                <Pressable
                  key={r.rate_id}
                  onPress={() => setSelectedRate(r)}
                  style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selectedRate?.rate_id === r.rate_id ? DesignColors.primary : DesignColors.lightGreenBorder,
                    backgroundColor: '#fff',
                  }}
                >
                  <Text style={{ fontWeight: '600' }}>{r.service_name}</Text>
                  <Text style={{ color: DesignColors.mediumGray, marginTop: 2 }}>
                    {r.carrier}
                    {r.estimated_days != null ? ` · ~${r.estimated_days} days` : ''}
                  </Text>
                  <Text style={{ marginTop: 4, fontWeight: '700', color: DesignColors.primary }}>
                    {formatCad(r.amount_cad)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : isPurchasable && fulfillment === 'pickup' && vendor ? (
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
              {formatPickupLocation(vendor) ? (
                <Text style={{ marginTop: 6, fontSize: 14, color: DesignColors.charcoal, lineHeight: 20 }}>
                  {formatPickupLocation(vendor)}
                </Text>
              ) : (
                <Text style={{ marginTop: 6, fontSize: 13, color: DesignColors.mediumGray }}>
                  The maker has not published pickup details yet.
                </Text>
              )}
              {vendor.shop_pickup_hours ? (
                <Text style={{ marginTop: 8, fontSize: 13, color: DesignColors.mediumGray }}>
                  Hours: {vendor.shop_pickup_hours}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {isPurchasable ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: DesignSpacing.horizontalPadding,
            paddingBottom: insets.bottom + 16,
            paddingTop: 12,
            backgroundColor: DesignColors.creamBg,
            borderTopWidth: 1,
            borderTopColor: DesignColors.lightGreenBorder,
          }}
        >
          <Pressable
            onPress={onBuy}
            disabled={!canBuy}
            style={{
              paddingVertical: 14,
              borderRadius: 24,
              backgroundColor: DesignColors.primary,
              opacity: canBuy ? 1 : 0.5,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Buy now</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
