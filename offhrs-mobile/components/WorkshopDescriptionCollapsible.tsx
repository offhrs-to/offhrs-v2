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

import WorkshopRichTextContent, { stripWorkshopRichTextPlain } from '@/components/WorkshopRichTextContent';
import { DesignColors } from '@/constants/design-template';
import {
  visibleWorkshopDescriptionSections,
  type WorkshopDescriptionFields,
} from '@/lib/workshop-description-sections';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PREVIEW_CHARS = 180;

type Props = WorkshopDescriptionFields;

function GeneralDescription({ description }: { description: string | null | undefined }) {
  const raw = (description ?? '').trim();
  if (!raw) return null;

  const plain = stripWorkshopRichTextPlain(raw);
  const [expanded, setExpanded] = useState(false);
  const needsExpand = plain.length > PREVIEW_CHARS;
  const preview = needsExpand ? `${plain.slice(0, PREVIEW_CHARS).trim()}…` : plain;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  if (!needsExpand) {
    return (
      <View style={{ marginTop: 10 }}>
        <WorkshopRichTextContent content={raw} />
      </View>
    );
  }

  return (
    <View style={{ marginTop: 10 }}>
      {expanded ? (
        <ScrollView
          style={{ maxHeight: 240 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          <WorkshopRichTextContent content={raw} />
        </ScrollView>
      ) : (
        <Text style={{ fontSize: 13, color: '#444', lineHeight: 20 }}>{preview}</Text>
      )}
      <Pressable onPress={toggle} accessibilityRole="button" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: DesignColors.primary }}>
          {expanded ? 'Show less' : 'Read full description'}
        </Text>
      </Pressable>
    </View>
  );
}

function DescriptionAccordionSection({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Text style={{ fontSize: 12, color: DesignColors.mediumGray, width: 14 }}>{open ? '▾' : '▸'}</Text>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#000' }}>{title}</Text>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 8, marginLeft: 22 }}>
          <WorkshopRichTextContent content={body} contentWidthPadding={88} />
        </View>
      ) : null}
    </View>
  );
}

export default function WorkshopDescriptionCollapsible(props: Props) {
  const sections = visibleWorkshopDescriptionSections(props);
  const hasGeneral = Boolean((props.description ?? '').trim());

  if (!hasGeneral && sections.length === 0) return null;

  return (
    <View>
      <GeneralDescription description={props.description} />
      {sections.map((section) => (
        <DescriptionAccordionSection key={section.title} title={section.title} body={section.body} />
      ))}
    </View>
  );
}
