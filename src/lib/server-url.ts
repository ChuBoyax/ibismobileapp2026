import Constants from 'expo-constants';

const DEV_API_PORT = 8000;

function apiHostFromMetro(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];

  return host ? `http://${host}:${DEV_API_PORT}` : null;
}

export function serverUrl(): string {
  return (
    (__DEV__ ? apiHostFromMetro() : null) ??
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
    'http://127.0.0.1:8000'
  );
}
