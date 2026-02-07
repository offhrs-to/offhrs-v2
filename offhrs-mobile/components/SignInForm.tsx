import { DesignColors, DesignSpacing } from '@/constants/design-template';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: undefined },
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

  const redirectUrl = Linking.createURL('/auth/callback');

  const handleOAuth = async (provider: 'google' | 'apple' | 'facebook') => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrl },
      });
      if (error) throw error;
      if (data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (err: unknown) {
      const message =
        provider === 'google'
          ? 'Google sign-in failed'
          : provider === 'apple'
            ? 'Apple sign-in failed'
            : 'Meta sign-in failed';
      setError(err instanceof Error ? err.message : message);
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
            <Text style={{ fontSize: 16, color: DesignColors.charcoal }}>
              Continue with Google
            </Text>
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
            marginBottom: 12,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
              Continue with Apple
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleOAuth('facebook')}
          disabled={loading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: '#1877F2',
            backgroundColor: '#1877F2',
            marginBottom: 24,
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>
              Continue with Meta
            </Text>
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
          disabled={loading || !email || !password}
          style={{
            paddingVertical: 14,
            borderRadius: 9999,
            backgroundColor: DesignColors.primary,
            alignItems: 'center',
            opacity: loading || !email || !password ? 0.6 : 1,
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
