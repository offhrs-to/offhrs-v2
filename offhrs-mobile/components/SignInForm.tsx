import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { processAuthCallbackUrl } from '@/lib/auth-callback-url';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
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
};

export function SignInForm({
  onSignInSuccess,
  showBackButton = false,
  onBack,
}: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleEmailAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        // Use web app URL so the confirmation email link works (Supabase cannot send to custom schemes reliably).
        // Add this exact URL in Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
        const webAppUrl = (process.env.EXPO_PUBLIC_APP_URL || '').replace(/\/$/, '') || 'https://offhrs.app';
        const emailRedirectTo = `${webAppUrl}/auth/callback`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: { full_name: fullName || undefined },
          },
        });
        if (error) throw error;
        setSuccess(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSignInSuccess?.();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: DesignColors.creamBg }}
    >
      <View
        style={{
          flex: 1,
          padding: DesignSpacing.horizontalPadding,
          paddingTop: 60,
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
          {isSignUp ? 'Create account' : 'Sign in'}
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: DesignColors.mediumGray,
            marginBottom: 32,
          }}
        >
          {isSignUp ? 'Join Offhrs to discover workshops' : 'Welcome back to Offhrs'}
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
          onChangeText={setEmail}
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
  );
}
