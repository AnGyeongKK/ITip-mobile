import { router, useGlobalSearchParams, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { getLaunchNotificationResponse } from '@/features/notifications/launchResponse';
import { useMockAuth } from './mockAuth';

/**
 * 앱을 켜서 홈('/')으로 들어오면 한 번만 로그인 목업으로 보낸다.
 * YouTube 공유로 들어온 경우(sharedUrl), 알림을 눌러 실행된 경우, 다른 경로로 바로 열린 경우는 그대로 둔다.
 */
export function LoginGate() {
  const nav = useRootNavigationState();
  const path = usePathname();
  const { sharedUrl } = useGlobalSearchParams<{ sharedUrl?: string }>();
  const signedIn = useMockAuth((s) => s.signedIn);
  const checked = useRef(false);

  useEffect(() => {
    if (!nav?.key || checked.current) return;
    checked.current = true;
    // 알림을 눌러 실행된 경우는 알림 처리기가 결과·배치 화면을 연다
    if (getLaunchNotificationResponse()) return;
    if (!signedIn && path === '/' && !sharedUrl) router.replace('/login' as never);
  }, [nav?.key, path, sharedUrl, signedIn]);

  return null;
}
