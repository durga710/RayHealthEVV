import { Stack } from 'expo-router';
import { AuthProvider } from '../src/lib/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
