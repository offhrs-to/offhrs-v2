import { DesignColors } from '@/constants/design-template';
import type { WorkshopPriceSort } from '@/lib/workshop-price-sort';
import { Modal, Pressable, Text, View } from 'react-native';

const OPTIONS: { value: WorkshopPriceSort; label: string }[] = [
  { value: 'price_high', label: 'Price — Highest to Lowest' },
  { value: 'price_low', label: 'Price — Lowest to Highest' },
];

type Props = {
  visible: boolean;
  value: WorkshopPriceSort;
  onClose: () => void;
  onSelect: (sort: WorkshopPriceSort) => void;
};

export default function WorkshopPriceSortMenu({ visible, value, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}
        onPress={onClose}
      >
        <View
          style={{
            position: 'absolute',
            top: 118,
            right: 16,
            minWidth: 248,
            backgroundColor: '#FFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: DesignColors.lightGreenBorder,
            paddingVertical: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: DesignColors.mediumGray,
              paddingHorizontal: 14,
              paddingTop: 6,
              paddingBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            Sort by
          </Text>
          {OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onSelect(opt.value);
                  onClose();
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  backgroundColor: active ? DesignColors.heroBg : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: active ? '600' : '500',
                    color: active ? DesignColors.primary : DesignColors.charcoal,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
          {value !== 'default' ? (
            <Pressable
              onPress={() => {
                onSelect('default');
                onClose();
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderTopWidth: 1,
                borderTopColor: DesignColors.lightGreenBorder,
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '500', color: DesignColors.mediumGray }}>
                Clear sort
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}
