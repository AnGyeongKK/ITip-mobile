import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ShareReceiver } from '@/features/analysis/ShareReceiver';

export default function RootLayout() {
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
  return (
    <ShareIntentProvider>
      <QueryClientProvider client={client}>
        <StatusBar style="dark" />
        <ShareReceiver />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }} />
      </QueryClientProvider>
    </ShareIntentProvider>
  );
}