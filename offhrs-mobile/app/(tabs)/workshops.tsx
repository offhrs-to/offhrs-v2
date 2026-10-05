/**
 * Former Search tab — kept as a redirect so old deep links / navigation
 * (`/(tabs)/workshops`, openEvent params) still land on the combined Home hub.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function WorkshopsScreenRedirect() {
  const params = useLocalSearchParams<{
    q?: string;
    openEvent?: string;
    openTs?: string;
    t?: string;
  }>();

  const nextParams: Record<string, string> = {};
  for (const key of ['q', 'openEvent', 'openTs', 't'] as const) {
    const raw = params[key];
    const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (value) nextParams[key] = value;
  }

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/index',
        params: nextParams,
      }}
    />
  );
}
