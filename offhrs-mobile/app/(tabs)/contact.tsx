import {
  DesignColors,
  DesignSpacing,
  DesignSizes,
} from '@/constants/design-template';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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

const CONTACT_EMAIL = 'offhrs.to@gmail.com';

const INPUT_BORDER = '#E5E7EB';
const INPUT_PLACEHOLDER = '#9CA3AF';

type Role = 'learner' | 'instructor' | null;

export default function ContactScreen() {
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
      {/* Fixed header: logo */}
      <View
        style={{
          paddingTop: DesignSpacing.contentPaddingTop,
          paddingBottom: 12,
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
            paddingBottom: Platform.OS === 'android' ? 128 : DesignSpacing.contentPaddingBottom,
            paddingHorizontal: DesignSpacing.horizontalPadding,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Text
            style={{
              fontSize: 28,
              fontWeight: '700',
              color: DesignColors.charcoal,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Let's grow together
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: DesignColors.mediumGray,
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 22,
            }}
          >
            Have a workshop to list? We'd love to hear from you.
          </Text>

          {/* Email button – unchanged */}
          <Pressable
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFF',
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: DesignColors.lightGreenBorder,
              paddingVertical: 16,
              paddingHorizontal: 20,
              marginBottom: 24,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: DesignColors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
              }}
            >
              <Text style={{ fontSize: 18 }}>✉</Text>
            </View>
            <Text
              style={{
                fontSize: 16,
                color: DesignColors.primary,
                fontWeight: '500',
              }}
            >
              {CONTACT_EMAIL}
            </Text>
          </Pressable>

          {/* Form: minimalist underline-only inputs (template style) */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
              <TextInput
                placeholder="First name"
                placeholderTextColor={INPUT_PLACEHOLDER}
                value={firstName}
                onChangeText={setFirstName}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: INPUT_BORDER,
                  fontSize: 16,
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
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: INPUT_BORDER,
                  fontSize: 16,
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
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: INPUT_BORDER,
                fontSize: 16,
                color: DesignColors.charcoal,
                marginBottom: 20,
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
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: INPUT_BORDER,
                fontSize: 16,
                color: DesignColors.charcoal,
                minHeight: 80,
              }}
            />
          </View>

          {/* Role selection – card style with icon (template) */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: DesignColors.charcoal,
              marginBottom: 8,
            }}
          >
            I am
          </Text>
          <View style={{ gap: 8, marginBottom: 18 }}>
            <Pressable
              onPress={() => setRole('learner')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFF',
                borderRadius: 10,
                borderWidth: 2,
                borderColor: role === 'learner' ? DesignColors.primary : DesignColors.lightGreenBorder,
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <View style={{ marginRight: 10 }}>
                <MaterialIcons
                  name="person-outline"
                  size={22}
                  color={role === 'learner' ? DesignColors.primary : DesignColors.charcoal}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: DesignColors.charcoal,
                  }}
                >
                  I'm a learner
                </Text>
                <Text
                  style={{
                    fontSize: 12,
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
                paddingVertical: 10,
                paddingHorizontal: 12,
              }}
            >
              <View style={{ marginRight: 10 }}>
                <MaterialIcons
                  name="school"
                  size={22}
                  color={role === 'instructor' ? DesignColors.primary : DesignColors.charcoal}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: DesignColors.charcoal,
                  }}
                >
                  I'm an instructor
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: DesignColors.mediumGray,
                    marginTop: 1,
                  }}
                >
                  I want to list my workshops and reach learners.
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Get in touch – primary CTA (app theme) */}
          <Pressable
            onPress={handleGetInTouch}
            style={{
              backgroundColor: DesignColors.primary,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: '#FFF',
              }}
            >
              Get in touch
            </Text>
          </Pressable>

          <Text
            style={{
              fontSize: 13,
              color: DesignColors.mediumGray,
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            We typically respond within 24–48 hours.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
