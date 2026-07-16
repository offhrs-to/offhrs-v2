import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { DesignColors } from '@/constants/design-template';
import { workshopHasActiveSale } from '@/lib/workshop-ticket-price';

type PriceFields = {
  price_cad?: number | string | null;
  sale_price_cad?: number | string | null;
  price?: number | string | null;
  vendor_profile_id?: string | null;
};

function formatCad(n: number): string {
  return `$${n.toFixed(2)}`;
}

type Props = {
  event: PriceFields;
  /** Fallback when not a SaaS listing (legacy price string). */
  legacyPriceText?: string | null;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  saleTextStyle?: StyleProp<TextStyle>;
  listTextStyle?: StyleProp<TextStyle>;
};

/**
 * List price with optional strikethrough + red sale price for SaaS workshops.
 */
export default function WorkshopSalePrice({
  event,
  legacyPriceText = null,
  size = 'sm',
  style,
  saleTextStyle,
  listTextStyle,
}: Props) {
  const isSaas = event.vendor_profile_id != null && String(event.vendor_profile_id).length > 0;
  const fontSize = size === 'md' ? 16 : 12;
  const listSize = size === 'md' ? 14 : 12;

  if (isSaas) {
    const list = Number(event.price_cad ?? 0);
    if (!Number.isFinite(list)) {
      return null;
    }
    if (list <= 0) {
      return (
        <Text style={[{ fontSize, fontWeight: '600', color: DesignColors.charcoal }, listTextStyle]}>
          Free
        </Text>
      );
    }
    if (workshopHasActiveSale(event)) {
      const sale = Number(event.sale_price_cad);
      return (
        <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }, style]}>
          <Text
            style={[
              {
                fontSize: listSize,
                fontWeight: '500',
                color: DesignColors.mediumGray,
                textDecorationLine: 'line-through',
              },
              listTextStyle,
            ]}
          >
            {formatCad(list)}
          </Text>
          <Text
            style={[
              { fontSize, fontWeight: '700', color: '#C62828' },
              saleTextStyle,
            ]}
          >
            {formatCad(sale)}
          </Text>
        </View>
      );
    }
    return (
      <Text style={[{ fontSize, fontWeight: '600', color: DesignColors.charcoal }, listTextStyle]}>
        {formatCad(list)}
      </Text>
    );
  }

  if (legacyPriceText == null || legacyPriceText === '') return null;
  return (
    <Text style={[{ fontSize, fontWeight: '600', color: DesignColors.charcoal }, listTextStyle]}>
      {legacyPriceText}
    </Text>
  );
}
