import {
  DesignColors,
  DesignSpacing,
  DesignSizes,
} from '@/constants/design-template';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

const CONTACT_EMAIL = 'hello@offhrs.app';

const INPUT_BORDER = '#E5E7EB';
const INPUT_PLACEHOLDER = '#9CA3AF';

const isAndroid = Platform.OS === 'android';
const TITLE_FONT_SIZE = isAndroid ? 24 : 28;
const TITLE_MARGIN_BOTTOM = isAndroid ? 6 : 8;
const SUBTITLE_FONT_SIZE = isAndroid ? 13 : 15;
const SUBTITLE_MARGIN_BOTTOM = isAndroid ? 16 : 24;
const SUBTITLE_LINE_HEIGHT = isAndroid ? 18 : 22;
const EMAIL_BTN_PADDING_V = isAndroid ? 12 : 16;
const EMAIL_BTN_PADDING_H = isAndroid ? 16 : 20;
const EMAIL_BTN_MARGIN_BOTTOM = isAndroid ? 16 : 24;
const EMAIL_ICON_SIZE = isAndroid ? 36 : 40;
const EMAIL_FONT_SIZE = isAndroid ? 14 : 16;
const FORM_MARGIN_BOTTOM = isAndroid ? 16 : 24;
const INPUT_ROW_GAP = isAndroid ? 12 : 16;
const INPUT_ROW_MARGIN_BOTTOM = isAndroid ? 14 : 20;
const INPUT_PADDING_V = isAndroid ? 10 : 12;
const INPUT_FONT_SIZE = isAndroid ? 14 : 16;
const CHAT_MIN_HEIGHT = isAndroid ? 64 : 80;
const ROLE_LABEL_FONT_SIZE = isAndroid ? 13 : 14;
const ROLE_LABEL_MARGIN_BOTTOM = isAndroid ? 6 : 8;
const ROLE_GAP = isAndroid ? 6 : 8;
const ROLE_SECTION_MARGIN_BOTTOM = isAndroid ? 12 : 18;
const ROLE_CARD_PADDING_V = isAndroid ? 8 : 10;
const ROLE_CARD_PADDING_H = isAndroid ? 10 : 12;
const ROLE_ICON_SIZE = isAndroid ? 20 : 22;
const ROLE_TITLE_FONT_SIZE = isAndroid ? 13 : 14;
const ROLE_SUB_FONT_SIZE = isAndroid ? 11 : 12;
const CTA_PADDING_V = isAndroid ? 8 : 10;
const CTA_FONT_SIZE = isAndroid ? 13 : 14;
const FOOTER_MARGIN_TOP = isAndroid ? 12 : 20;
const FOOTER_FONT_SIZE = isAndroid ? 12 : 13;

type Role = 'learner' | 'instructor' | null;

export default function ContactScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [chatWithUs, setChatWithUs] = useState('');
  const [role, setRole] = useState<Role>(null);

  const handleGetInTouch = () => {
    const body = [
      `First name: ${firstName.trim() || '(not provided)'}`,
      `Last name: ${lastName.trim() || '(not provided)'}`,
      `Email: ${email.trim() || '(not provided)'}`,
      `Role: ${role === 'learner' ? "I'm a learner" : role === 'instructor' ? "I'm an instructor" : '(not selected)'}`,
      '',
      'Chat with us:',
      chatWithUs.trim() || '(empty)',
    ].join('\n');
    const subject = encodeURIComponent('Contact from Offhrs app');
    const bodyEncoded = encodeURIComponent(body);
    Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${bodyEncoded}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF' }}>
      <View
        style={{
          paddingTop: DesignSpacing.contentPaddingTop,
          paddingBottom: DesignSpacing.logoHeaderPaddingBottom,
          paddingHorizontal: DesignSpacing.horizontalPadding,
          backgroundColor: '#FFF',
        }}
      >
        <View style={{ marginLeft: DesignSpacing.logoMarginLeft, paddingLeft: 0 }}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ height: DesignSizes.logoHeight, width: DesignSizes.logoWidth }}
            contentFit="contain"
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: DesignSpacing.contentPaddingBottom,
            paddingHorizontal: DesignSpacing.horizontalPadding,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: TITLE_MARGIN_BOTTOM,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{
                width: 32,
                height: Math.max(TITLE_FONT_SIZE + 4, 36),
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 22, color: DesignColors.primary, lineHeight: 26 }}>‹</Text>
            </Pressable>
            <Text
              style={{
                flex: 1,
                fontSize: TITLE_FONT_SIZE,
                fontWeight: '700',
                color: DesignColors.charcoal,
                textAlign: 'center',
              }}
            >
              Let's grow together
            </Text>
            {/* Balance the back control so the title stays visually centered. */}
            <View style={{ width: 32 }} />
          </View>
          <Text
            style={{
              fontSize: SUBTITLE_FONT_SIZE,
              color: DesignColors.mediumGray,
              textAlign: 'center',
              marginBottom: SUBTITLE_MARGIN_BOTTOM,
              lineHeight: SUBTITLE_LINE_HEIGHT,
            }}
          >
            Have a workshop to list? We'd love to hear from you.
          </Text>

          <Pressable
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFF',
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
              paddingVertical: EMAIL_BTN_PADDING_V,
              paddingHorizontal: EMAIL_BTN_PADDING_H,
              marginBottom: EMAIL_BTN_MARGIN_BOTTOM,
            }}
          >
            <View
              style={{
                width: EMAIL_ICON_SIZE,
                height: EMAIL_ICON_SIZE,
                borderRadius: EMAIL_ICON_SIZE / 2,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: isAndroid ? 12 : 16,
              }}
            >
              <Text style={{ fontSize: isAndroid ? 16 : 18 }}>✉</Text>
            </View>
            <Text
              style={{
                fontSize: EMAIL_FONT_SIZE,
                color: DesignColors.primary,
                fontWeight: '500',
              }}
            >
              {CONTACT_EMAIL}
            </Text>
          </Pressable>

          <View style={{ marginBottom: FORM_MARGIN_BOTTOM }}>
            <View style={{ flexDirection: 'row', gap: INPUT_ROW_GAP, marginBottom: INPUT_ROW_MARGIN_BOTTOM }}>
              <TextInput
                placeholder="First name"
                placeholderTextColor={INPUT_PLACEHOLDER}
                value={firstName}
                onChangeText={setFirstName}
                style={{
                  flex: 1,
                  paddingVertical: INPUT_PADDING_V,
                  borderBottomWidth: 1,
                  borderBottomColor: INPUT_BORDER,
                  fontSize: INPUT_FONT_SIZE,
                  color: DesignColors.charcoal,
                }}
              />
              <TextInput
                placeholder="Last name"
                placeholderTextColor={INPUT_PLACEHOLDER}
                value={lastName}
                onChangeText={setLastName}
                style={{
                  flex: 1,
                  paddingVertical: INPUT_PADDING_V,
                  borderBottomWidth: 1,
                  borderBottomColor: INPUT_BORDER,
                  fontSize: INPUT_FONT_SIZE,
                  color: DesignColors.charcoal,
                }}
              />
            </View>

            <TextInput
              placeholder="Email"
              placeholderTextColor={INPUT_PLACEHOLDER}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                paddingVertical: INPUT_PADDING_V,
                borderBottomWidth: 1,
                borderBottomColor: INPUT_BORDER,
                fontSize: INPUT_FONT_SIZE,
                color: DesignColors.charcoal,
                marginBottom: INPUT_ROW_MARGIN_BOTTOM,
              }}
            />

            <TextInput
              placeholder="Chat with us"
              placeholderTextColor={INPUT_PLACEHOLDER}
              value={chatWithUs}
              onChangeText={setChatWithUs}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                paddingVertical: INPUT_PADDING_V,
                borderBottomWidth: 1,
                borderBottomColor: INPUT_BORDER,
                fontSize: INPUT_FONT_SIZE,
                color: DesignColors.charcoal,
                minHeight: CHAT_MIN_HEIGHT,
              }}
            />
          </View>

          <Text
            style={{
              fontSize: ROLE_LABEL_FONT_SIZE,
              fontWeight: '700',
              color: DesignColors.charcoal,
              marginBottom: ROLE_LABEL_MARGIN_BOTTOM,
            }}
          >
            I am
          </Text>
          <View style={{ gap: ROLE_GAP, marginBottom: ROLE_SECTION_MARGIN_BOTTOM }}>
            <Pressable
              onPress={() => setRole('learner')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFF',
                borderRadius: 10,
                borderWidth: 2,
                borderColor: role === 'learner' ? DesignColors.primary : DesignColors.lightGreenBorder,
                paddingVertical: ROLE_CARD_PADDING_V,
                paddingHorizontal: ROLE_CARD_PADDING_H,
              }}
            >
              <View style={{ marginRight: isAndroid ? 8 : 10 }}>
                <MaterialIcons
                  name="person-outline"
                  size={ROLE_ICON_SIZE}
                  color={role === 'learner' ? DesignColors.primary : DesignColors.charcoal}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: ROLE_TITLE_FONT_SIZE,
                    fontWeight: '600',
                    color: DesignColors.charcoal,
                  }}
                >
                  I'm a learner
                </Text>
                <Text
                  style={{
                    fontSize: ROLE_SUB_FONT_SIZE,
                    color: DesignColors.mediumGray,
                    marginTop: 1,
                  }}
                >
                  I want to discover and book workshops.
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setRole('instructor')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFF',
                borderRadius: 10,
                borderWidth: 2,
                borderColor: role === 'instructor' ? DesignColors.primary : DesignColors.lightGreenBorder,
                paddingVertical: ROLE_CARD_PADDING_V,
                paddingHorizontal: ROLE_CARD_PADDING_H,
              }}
            >
              <View style={{ marginRight: isAndroid ? 8 : 10 }}>
                <MaterialIcons
                  name="school"
                  size={ROLE_ICON_SIZE}
                  color={role === 'instructor' ? DesignColors.primary : DesignColors.charcoal}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: ROLE_TITLE_FONT_SIZE,
                    fontWeight: '600',
                    color: DesignColors.charcoal,
                  }}
                >
                  I'm an instructor
                </Text>
                <Text
                  style={{
                    fontSize: ROLE_SUB_FONT_SIZE,
                    color: DesignColors.mediumGray,
                    marginTop: 1,
                  }}
                >
                  I want to list my workshops and reach learners.
                </Text>
              </View>
            </Pressable>
          </View>

          <Pressable
            onPress={handleGetInTouch}
            style={{
              backgroundColor: DesignColors.primary,
              borderRadius: 10,
              paddingVertical: CTA_PADDING_V,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: CTA_FONT_SIZE,
                fontWeight: '700',
                color: '#FFF',
              }}
            >
              Get in touch
            </Text>
          </Pressable>

          <Text
            style={{
              fontSize: FOOTER_FONT_SIZE,
              color: DesignColors.mediumGray,
              textAlign: 'center',
              marginTop: FOOTER_MARGIN_TOP,
            }}
          >
            We typically respond within 24–48 hours.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
