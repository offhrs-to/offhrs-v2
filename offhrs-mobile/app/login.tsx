import { useRouter } from 'expo-router';
import { SignInForm } from '@/components/SignInForm';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <SignInForm
      onSignInSuccess={() => router.replace('/(tabs)/profile')}
      showBackButton
      onBack={() => router.back()}
    />
  );
}
