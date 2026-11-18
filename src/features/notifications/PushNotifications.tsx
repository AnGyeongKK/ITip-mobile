// 분석 완료 푸시 처리 (푸시 구현 설계 · 1, 3)
// - 앱 시작·복귀·토큰 변경 때 기기 등록을 서버에 반영
// - 알림을 누르면: analysisId가 있으면 분석 결과, 없으면 배치 진행·결과 화면
//   앱이 열려 있을 때와 알림으로 처음 실행될 때 같은 규칙을 쓴다.
import * as Notifications from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { notificationTarget } from './launchResponse';
import { syncPushDevice } from './pushDevice';

// 앱을 보고 있는 중에 온 알림도 배너로 보여준다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 시작 시 응답과 리스너가 같은 알림을 함께 넘겨줄 수 있어 한 번만 연다.
const handled = new Set<string>();

function openFromResponse(response: Notifications.NotificationResponse | null | undefined) {
  const target = notificationTarget(response);
  if (!response || !target) return;
  const id = response.notification.request.identifier;
  if (handled.has(id)) return;
  handled.add(id);
  router.push(target);
}

export function PushNotifications() {
  const nav = useRootNavigationState();
  const ready = !!nav?.key;
  const response = Notifications.useLastNotificationResponse();

  // 기기 등록: 시작할 때, 앱으로 돌아올 때(설정에서 권한을 바꿨을 수 있음), 토큰이 바뀔 때
  useEffect(() => {
    void syncPushDevice();
    const appState = AppState.addEventListener('change', (s) => { if (s === 'active') void syncPushDevice(); });
    const token = Notifications.addPushTokenListener((t) => {
      void syncPushDevice({ knownToken: typeof t.data === 'string' ? t.data : undefined });
    });
    return () => { appState.remove(); token.remove(); };
  }, []);

  // 알림 탭: 처음 실행된 경우는 시작 시 마지막 응답으로, 실행 중에는 리스너로 처리
  useEffect(() => {
    if (ready && response) {
      openFromResponse(response);
      Notifications.clearLastNotificationResponse();
    }
  }, [ready, response]);

  return null;
}
