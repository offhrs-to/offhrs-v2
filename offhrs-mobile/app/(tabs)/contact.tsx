import {
  DesignColors,
  DesignSpacing,
  DesignSizes,
} from '@/constants/design-template';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { ScrollView, Text, View, Pressable } from 'react-native';

const CONTACT_EMAIL = 'offhrs.to@gmail.com';

export default function ContactScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg }}>
      {/* Fixed header: logo stays in place when scrolling */}
      <View
        style={{
          paddingTop: DesignSpacing.contentPaddingTop,
          paddingBottom: 12,
          paddingHorizontal: DesignSpacing.horizontalPadding,
          backgroundColor: DesignColors.creamBg,
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: DesignSpacing.contentPaddingBottom,
          paddingHorizontal: DesignSpacing.horizontalPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
      {/* Get in Touch – centered */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: '700',
          color: DesignColors.charcoal,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        Get in Touch
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

      {/* Contact cards – pill-shaped, icon + text */}
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
          marginBottom: 12,
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

      <Text
        style={{
          fontSize: 13,
          color: DesignColors.mediumGray,
          textAlign: 'center',
          marginBottom: 32,
        }}
      >
        We typically respond within 24–48 hours. For urgent matters, include "URGENT" in the subject line.
      </Text>

      {/* Social Media – heading + list */}
      <Text
        style={{
          fontSize: 20,
          fontWeight: '700',
          color: DesignColors.charcoal,
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        Social Media
      </Text>

      <View style={{ gap: 16 }}>
        <Pressable
          onPress={() => Linking.openURL('https://facebook.com')}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: DesignColors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>f</Text>
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              color: DesignColors.mediumGray,
              lineHeight: 20,
            }}
          >
            Stay updated, connect, and engage with us on Facebook.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL('https://instagram.com')}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: DesignColors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 16 }}>📷</Text>
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              color: DesignColors.mediumGray,
              lineHeight: 20,
            }}
          >
            Explore our visual world and discover the beauty of our brand.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL('https://twitter.com')}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: DesignColors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 16 }}>𝕏</Text>
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              color: DesignColors.mediumGray,
              lineHeight: 20,
            }}
          >
            Follow us for real-time updates and lively discussions.
          </Text>
        </Pressable>
      </View>
      </ScrollView>
    </View>
  );
}
