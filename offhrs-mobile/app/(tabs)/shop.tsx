import WorkshopsChrome from '@/components/WorkshopsChrome';
import { SHOP_CATEGORIES } from '@/constants/shop-categories';
import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { fetchShopProducts, type ShopProductListItem } from '@/lib/shop-api';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIST_GAP = 12;

function formatCad(price: number): string {
  return `$${price.toFixed(2)}`;
}

function ShopProductCard({
  item,
  width,
  onPress,
}: {
  item: ShopProductListItem;
  width: number;
  onPress: () => void;
}) {
  const image = item.image_urls?.[0];
  return (
    <Pressable
      onPress={onPress}
      style={{
        width,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: DesignColors.lightGreenBorder,
        overflow: 'hidden',
      }}
    >
      <View style={{ aspectRatio: 1, backgroundColor: DesignColors.creamBg }}>
        {image ? (
          <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, color: DesignColors.mediumGray }}>No image</Text>
          </View>
        )}
      </View>
      <View style={{ padding: 8 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: DesignColors.charcoal }}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11, color: DesignColors.mediumGray, marginTop: 2 }}>
          {item.vendor_name}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: DesignColors.primary, marginTop: 4 }}>
          {formatCad(item.price_cad)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = (windowWidth - DesignSpacing.horizontalPadding * 2 - LIST_GAP) / 2;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [products, setProducts] = useState<ShopProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { products: list } = await fetchShopProducts({
        q: search.trim() || undefined,
        category: category === 'All' ? undefined : category,
        sort,
        limit: 40,
      });
      setProducts(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load shop');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, category, sort]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const categories = useMemo(() => ['All', ...SHOP_CATEGORIES], []);

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg }}>
      <WorkshopsChrome
        searchPlaceholder="Search shop…"
        searchValue={search}
        onSearchChangeText={setSearch}
        hideDateAndClear
        showPriceFilter
        priceSort={sort === 'price_asc' ? 'price_low' : sort === 'price_desc' ? 'price_high' : 'default'}
        onPriceSortChange={(s) => {
          if (s === 'price_low') setSort('price_asc');
          else if (s === 'price_high') setSort('price_desc');
          else setSort('newest');
        }}
      />

      <View style={{ paddingHorizontal: DesignSpacing.horizontalPadding, paddingBottom: 8 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(c) => c}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item: c }) => (
            <Pressable
              onPress={() => setCategory(c)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: category === c ? DesignColors.primary : '#fff',
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: category === c ? '#fff' : DesignColors.charcoal,
                }}
              >
                {c}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={DesignColors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: DesignColors.charcoal, textAlign: 'center' }}>{error}</Text>
          <Pressable onPress={load} style={{ marginTop: 12 }}>
            <Text style={{ color: DesignColors.primary, fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: DesignColors.mediumGray, textAlign: 'center' }}>
            No products yet. Check back soon.
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: LIST_GAP, paddingHorizontal: DesignSpacing.horizontalPadding }}
          contentContainerStyle={{ gap: LIST_GAP, paddingBottom: insets.bottom + 100 }}
          renderItem={({ item }) => (
            <ShopProductCard
              item={item}
              width={cardWidth}
              onPress={() => router.push(`/shop/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
