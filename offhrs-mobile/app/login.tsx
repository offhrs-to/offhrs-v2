import { useLocalSearchParams, useRouter } from 'expo-router';
import { SignInForm } from '@/components/SignInForm';

export default function LoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  return (
    <SignInForm
      onSignInSuccess={() => {
        if (redirect?.trim()) {
          router.replace(redirect.trim() as never);
          return;
        }
        router.replace('/(tabs)/profile');
      }}
      showBackButton
      onBack={() => router.back()}
    />
  );
}
