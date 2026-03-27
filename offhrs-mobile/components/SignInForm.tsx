import { DesignColors, DesignSizes, DesignSpacing } from '@/constants/design-template';
import { processAuthCallbackUrl } from '@/lib/auth-callback-url';
import { supabase } from '@/lib/supabase';
import { openWebAppPath } from '@/lib/web-app-links';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Image as ExpoImage } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  /** Called after successful email sign-in (e.g. to redirect). Omit when embedded in Profile. */
  onSignInSuccess?: () => void;
  /** Show "Back" button (e.g. when used on standalone login screen). */
  showBackButton?: boolean;
  onBack?: () => void;
  /** Logo strip like Home / Contact / Workshops (e.g. Profile tab sign-in). */
  showHeaderLogo?: boolean;
};

function isExistingAccountSignUpError(err: unknown): boolean {
  const raw = err as { message?: string; code?: string };
  const msg = (raw?.message ?? (err instanceof Error ? err.message : '') ?? '').toLowerCase();
  const code = (raw?.code ?? '').toLowerCase();
  if (code === 'user_already_exists' || code === 'email_exists') return true;
  return (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already exists') ||
    (msg.includes('email address') && msg.includes('already')) ||
    (msg.includes('duplicate') && msg.includes('user'))
  );
}

export function SignInForm({
  onSignInSuccess,
  showBackButton = false,
  onBack,
  showHeaderLogo = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [success, setSuccess] = useState(false);
  const [topBanner, setTopBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!topBanner) return;
    const t = setTimeout(() => setTopBanner(null), 6000);
    return () => clearTimeout(t);
  }, [topBanner]);

  const handleEmailAuth = async () => {
    setLoading(true);
    setError(null);
    setTopBanner(null);
    try {
      if (isSignUp) {
        const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        // Use web app URL so the confirmation email link works (Supabase cannot send to custom schemes reliably).
        // Add this exact URL in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
        const webAppUrl = (process.env.EXPO_PUBLIC_APP_URL || '').replace(/\/$/, '') || 'https://offhrs.app';
        const emailRedirectTo = `${webAppUrl}/auth/callback`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: { full_name: fullName || undefined },
          },
        });
        if (error) throw error;
        // If "Confirm email" is off in Supabase, a session is returned and the user is signed in immediately.
        if (data.session) {
          onSignInSuccess?.();
        } else {
          setSuccess(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSignInSuccess?.();
      }
    } catch (err: unknown) {
      if (isSignUp && isExistingAccountSignUpError(err)) {
        setTopBanner('You have an existing account. Please sign in with your email');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

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
          // Android: external Chrome often shows a blank page on offhrsmobile:// redirects; Custom Tabs returns the URL in-app.
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

  if (success) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: DesignColors.creamBg,
          padding: DesignSpacing.horizontalPadding,
        }}
      >
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: DesignColors.charcoal,
            textAlign: 'center',
          }}
        >
          Check your email
        </Text>
        <Text
          style={{
            marginTop: 12,
            color: DesignColors.mediumGray,
            textAlign: 'center',
          }}
        >
          We&apos;ve sent you a confirmation link.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DesignColors.creamBg }}>
      {topBanner ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: '#B91C1C',
            paddingTop: Math.max(insets.top, 6),
            paddingBottom: 8,
            paddingHorizontal: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#991B1B',
          }}
        >
          <Pressable onPress={() => setTopBanner(null)}>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: '600',
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              {topBanner}
            </Text>
          </Pressable>
        </View>
      ) : null}
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: DesignColors.creamBg }}
    >
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
          {isSignUp ? 'Create account' : showHeaderLogo ? 'Sign-in' : 'Sign in'}
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: DesignColors.mediumGray,
            marginBottom: 32,
          }}
        >
          {isSignUp
            ? 'Join Offhrs to discover workshops'
            : showHeaderLogo
              ? 'Welcome to offhrs'
              : 'Welcome back to Offhrs'}
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
              <MaterialCommunityIcons
                name="apple"
                size={20}
                color="#FFF"
              />
              <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
                Continue with Apple
              </Text>
            </View>
          )}
        </Pressable>

        <Text
          style={{
            textAlign: 'center',
            color: DesignColors.mediumGray,
            marginBottom: 16,
          }}
        >
          or
        </Text>

        {isSignUp && (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <TextInput
              placeholder="First name"
              placeholderTextColor={DesignColors.mediumGray}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
              style={{
                flex: 1,
                backgroundColor: DesignColors.inputBg,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DesignColors.charcoal,
              }}
            />
            <TextInput
              placeholder="Last name"
              placeholderTextColor={DesignColors.mediumGray}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              style={{
                flex: 1,
                backgroundColor: DesignColors.inputBg,
                borderWidth: 1,
                borderColor: DesignColors.lightGreenBorder,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
                color: DesignColors.charcoal,
              }}
            />
          </View>
        )}

        <TextInput
          placeholder="Email"
          placeholderTextColor={DesignColors.mediumGray}
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setTopBanner(null);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={{
            backgroundColor: DesignColors.inputBg,
            borderWidth: 1,
            borderColor: DesignColors.lightGreenBorder,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            color: DesignColors.charcoal,
            marginBottom: 12,
          }}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor={DesignColors.mediumGray}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={isSignUp ? 'new-password' : 'password'}
          style={{
            backgroundColor: DesignColors.inputBg,
            borderWidth: 1,
            borderColor: DesignColors.lightGreenBorder,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            color: DesignColors.charcoal,
            marginBottom: 24,
          }}
        />

        <Pressable
          onPress={handleEmailAuth}
          disabled={
            loading ||
            !email ||
            !password ||
            (isSignUp && (!firstName.trim() || !lastName.trim()))
          }
          style={{
            paddingVertical: 14,
            borderRadius: 9999,
            backgroundColor: DesignColors.primary,
            alignItems: 'center',
            opacity:
              loading ||
              !email ||
              !password ||
              (isSignUp && (!firstName.trim() || !lastName.trim()))
                ? 0.6
                : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFF' }}>
              {isSignUp ? 'Create account' : 'Sign in'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setIsSignUp(!isSignUp);
            setError(null);
            setTopBanner(null);
            if (!isSignUp) {
              setFirstName('');
              setLastName('');
            }
          }}
          style={{ marginTop: 24, alignItems: 'center' }}
        >
          <Text style={{ color: DesignColors.primary, fontSize: 14 }}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Text>
        </Pressable>

        {!isSignUp ? (
          <View style={{ marginTop: 14, alignSelf: 'stretch' }}>
            <Text
              style={{
                fontSize: 11,
                color: DesignColors.mediumGray,
                textAlign: 'left',
                lineHeight: 16,
              }}
            >
              By signing up you agree to our{' '}
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
        ) : null}

        {showBackButton && !isSignUp && onBack && (
          <Pressable
            onPress={onBack}
            style={{ marginTop: 32, alignItems: 'center' }}
          >
            <Text style={{ color: DesignColors.mediumGray, fontSize: 14 }}>Back</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}
