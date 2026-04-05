import { DesignColors, DesignSizes, DesignSpacing } from '@/constants/design-template';
import { processAuthCallbackUrl } from '@/lib/auth-callback-url';
import { supabase } from '@/lib/supabase';
import { openWebAppPath } from '@/lib/web-app-links';
import { Image as ExpoImage } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

type Props = {
  /** Called after successful OAuth sign-in (e.g. to redirect). Omit when embedded in Profile. */
  onSignInSuccess?: () => void;
  /** Show "Back" button (e.g. when used on standalone login screen). */
  showBackButton?: boolean;
  onBack?: () => void;
  /** Logo strip like Home / Contact / Workshops (e.g. Profile tab sign-in). */
  showHeaderLogo?: boolean;
};

export function SignInForm({
  onSignInSuccess,
  showBackButton = false,
  onBack,
  showHeaderLogo = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use custom scheme so Supabase accepts the redirect (createURL() returns exp://... in dev which can trigger "requested path is invalid").
  // Add exactly this (or offhrsmobile://**) in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
  const redirectUrl =
    Platform.OS === 'web'
      ? Linking.createURL('/auth/callback')
      : 'offhrsmobile://auth/callback';

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setError(null);
    try {
      __DEV__ && console.log(`[SignIn] Starting ${provider} OAuth with redirectUrl:`, redirectUrl);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS === 'android',
        },
      });
      if (error) throw error;
      if (!data?.url) {
        __DEV__ && console.warn(`[SignIn] No URL returned from ${provider} OAuth`);
        return;
      }
      __DEV__ && console.log(`[SignIn] Opening ${provider} auth URL`);

      if (Platform.OS === 'android') {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success' && result.url) {
          const handled = await processAuthCallbackUrl(result.url);
          if (handled) onSignInSuccess?.();
        }
        return;
      }

      await Linking.openURL(data.url);
    } catch (err: unknown) {
      const message =
        provider === 'google' ? 'Google sign-in failed' : 'Apple sign-in failed';
      const errorMsg = err instanceof Error ? err.message : message;
      __DEV__ && console.error(`[SignIn] ${provider} OAuth error:`, errorMsg, err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg }}>
      {showHeaderLogo ? (
        <View
          style={{
            paddingTop: DesignSpacing.contentPaddingTop,
            paddingBottom: DesignSpacing.logoHeaderPaddingBottom,
            paddingHorizontal: DesignSpacing.horizontalPadding,
            backgroundColor: DesignColors.creamBg,
          }}
        >
          <View style={{ marginLeft: DesignSpacing.logoMarginLeft, paddingLeft: 0 }}>
            <ExpoImage
              source={require('@/assets/images/logo.png')}
              style={{ height: DesignSizes.logoHeight, width: DesignSizes.logoWidth }}
              contentFit="contain"
            />
          </View>
        </View>
      ) : null}
      <View
        style={{
          flex: 1,
          padding: DesignSpacing.horizontalPadding,
          paddingTop: showHeaderLogo ? 16 : DesignSpacing.contentPaddingTop + 4,
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: DesignColors.charcoal,
            marginBottom: 8,
          }}
        >
          {showHeaderLogo ? 'Sign-in' : 'Sign in'}
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: DesignColors.mediumGray,
            marginBottom: 32,
          }}
        >
          {showHeaderLogo ? 'Welcome to offhrs' : 'Continue with Google or Apple'}
        </Text>

        {error && (
          <View
            style={{
              padding: 12,
              backgroundColor: '#FEE2E2',
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: '#B91C1C', fontSize: 14 }}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={() => handleOAuth('google')}
          disabled={loading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: DesignColors.lightGreenBorder,
            backgroundColor: '#FFF',
            marginBottom: 12,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={DesignColors.primary} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image
                source={require('@/assets/images/google-logo.png')}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 16, color: DesignColors.charcoal }}>
                Continue with Google
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleOAuth('apple')}
          disabled={loading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: '#000',
            backgroundColor: '#000',
            marginBottom: 24,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="apple" size={20} color="#FFF" />
              <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
                Continue with Apple
              </Text>
            </View>
          )}
        </Pressable>

        <View style={{ marginTop: 14, alignSelf: 'stretch' }}>
          <Text
            style={{
              fontSize: 11,
              color: DesignColors.mediumGray,
              textAlign: 'left',
              lineHeight: 16,
            }}
          >
            By continuing you agree to our{' '}
            <Text
              onPress={() => void openWebAppPath('/terms')}
              style={{
                color: DesignColors.primary,
                textDecorationLine: 'underline',
                fontSize: 11,
              }}
            >
              Terms of Use
            </Text>
            {' '}and{' '}
            <Text
              onPress={() => void openWebAppPath('/privacy')}
              style={{
                color: DesignColors.primary,
                textDecorationLine: 'underline',
                fontSize: 11,
              }}
            >
              Privacy Notice
            </Text>
            .
          </Text>
        </View>

        {showBackButton && onBack && (
          <Pressable onPress={onBack} style={{ marginTop: 32, alignItems: 'center' }}>
            <Text style={{ color: DesignColors.mediumGray, fontSize: 14 }}>Back</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
