import { Text, useWindowDimensions } from 'react-native';
import RenderHTML from 'react-native-render-html';

import {
  isWorkshopHtml,
  stripWorkshopRichTextPlain,
  workshopRichTextHtmlDocument,
} from '@/lib/workshop-rich-text';
import { AppFonts } from '@/lib/nunito-sans';

type Props = {
  content: string;
  /** Horizontal padding to subtract from window width for RenderHTML layout. */
  contentWidthPadding?: number;
};

const bodyStyle = {
  fontSize: 13,
  color: '#444',
  lineHeight: 20,
  fontFamily: AppFonts.regular,
} as const;

export default function WorkshopRichTextContent({
  content,
  contentWidthPadding = 64,
}: Props) {
  const { width } = useWindowDimensions();
  const raw = content.trim();
  if (!raw) return null;

  if (!isWorkshopHtml(raw)) {
    return <Text style={bodyStyle}>{raw}</Text>;
  }

  return (
    <RenderHTML
      contentWidth={Math.max(200, width - contentWidthPadding)}
      source={{ html: workshopRichTextHtmlDocument(raw) }}
      defaultTextProps={{ selectable: true }}
      systemFonts={[
        AppFonts.regular,
        AppFonts.semiBold,
        AppFonts.bold,
        AppFonts.medium,
      ]}
      tagsStyles={{
        body: bodyStyle,
        p: { marginTop: 0, marginBottom: 8, ...bodyStyle },
        li: { marginBottom: 4, ...bodyStyle },
        ul: { marginBottom: 8, paddingLeft: 4 },
        ol: { marginBottom: 8, paddingLeft: 4 },
        b: { fontFamily: AppFonts.bold, fontWeight: '700' as const },
        strong: { fontFamily: AppFonts.bold, fontWeight: '700' as const },
        i: { fontStyle: 'italic' as const },
        em: { fontStyle: 'italic' as const },
        u: { textDecorationLine: 'underline' as const },
      }}
    />
  );
}

export { stripWorkshopRichTextPlain };
