import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ShareReceiver } from '@/features/analysis/ShareReceiver';
import { colors, fontFamily } from '@/theme/tokens';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.medium]: require('../../assets/fonts/Pretendard-Medium.otf'),
    [fontFamily.semibold]: require('../../assets/fonts/Pretendard-SemiBold.otf'),
    [fontFamily.bold]: require('../../assets/fonts/Pretendard-Bold.otf'),
  });
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
          // 생성 요청은 자동 재시도하지 않는다 (명세: 5xx·네트워크 오류 시 새 요청으로 자동 반복 금지)
          mutations: { retry: 0 },
        },
      }),
  );
  // 글꼴 로딩 실패 시에도 시스템 글꼴로 앱은 연다.
  if (!fontsLoaded && !fontError) return null;
  return (
    <ShareIntentProvider>
      <QueryClientProvider client={client}>
        <StatusBar style="dark" />
        <ShareReceiver />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </QueryClientProvider>
    </ShareIntentProvider>
  );
}