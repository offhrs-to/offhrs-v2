import { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
} from 'react-native';

import { DesignColors } from '@/constants/design-template';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PREVIEW_CHARS = 200;

type Props = {
  bio: string | null | undefined;
};

export default function VendorBioCollapsible({ bio }: Props) {
  const raw = (bio ?? '').trim();
  if (!raw) return null;

  const [expanded, setExpanded] = useState(false);
  const needsExpand = raw.length > PREVIEW_CHARS;
  const preview = needsExpand ? `${raw.slice(0, PREVIEW_CHARS).trim()}…` : raw;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  if (!needsExpand) {
    return (
      <Text style={{ marginTop: 10, fontSize: 14, color: DesignColors.charcoal, lineHeight: 21 }}>
        {raw}
      </Text>
    );
  }

  return (
    <View style={{ marginTop: 10 }}>
      {expanded ? (
        <ScrollView
          style={{ maxHeight: 200 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          <Text style={{ fontSize: 14, color: DesignColors.charcoal, lineHeight: 21 }}>{raw}</Text>
        </ScrollView>
      ) : (
        <Text style={{ fontSize: 14, color: DesignColors.charcoal, lineHeight: 21 }}>{preview}</Text>
      )}
      <Pressable onPress={toggle} accessibilityRole="button" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: DesignColors.primary }}>
          {expanded ? 'Show less' : 'Read more'}
        </Text>
      </Pressable>
    </View>
  );
}
