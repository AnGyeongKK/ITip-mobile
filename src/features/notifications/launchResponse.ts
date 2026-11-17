import * as Notifications from 'expo-notifications';

let launch: Notifications.NotificationResponse | null | undefined;

/**
 * 알림을 눌러 앱이 처음 실행됐는지. 처음 읽은 값을 기억해서
 * 알림 처리기가 응답을 지운 뒤에도 LoginGate가 같은 답을 받는다.
 */
export function getLaunchNotificationResponse(): Notifications.NotificationResponse | null {
  if (launch === undefined) {
    try {
      launch = Notifications.getLastNotificationResponse();
    } catch {
      launch = null;
    }
  }
  return launch;
}
