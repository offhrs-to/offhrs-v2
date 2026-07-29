import { forwardRef, type ComponentRef } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { resolveNunitoStyle } from '@/lib/nunito-style';

type TextRef = ComponentRef<typeof RNText>;
type TextInputRef = ComponentRef<typeof RNTextInput>;

/** Drop-in Nunito Sans `Text` — used via babel rewrite of `react-native` imports. */
export const Text = forwardRef<TextRef, TextProps>(function AppText(props, ref) {
  return <RNText {...props} ref={ref} style={resolveNunitoStyle(props.style)} />;
});

/** Drop-in Nunito Sans `TextInput`. */
export const TextInput = forwardRef<TextInputRef, TextInputProps>(function AppTextInput(
  props,
  ref
) {
  return <RNTextInput {...props} ref={ref} style={resolveNunitoStyle(props.style)} />;
});
