// 알림 채널·권한·FCM 토큰을 확인해서 서버에 이 기기를 등록한다 (푸시 구현 설계 · 1).
// - 채널을 먼저 만든 뒤 권한을 확인하고, 허용되면 네이티브 FCM 토큰을 받는다.
// - 최초 등록, 토큰 변경, 권한 변경 때만 PUT한다 (마지막으로 보낸 값과 같으면 보내지 않는다).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { putDevice, type DeviceRegistration, type NotificationPermission } from '@/api/devices';

export const ANALYSIS_CHANNEL_ID = 'analysis';

const INSTALLATION_KEY = 'itip.push.installationId';
const LAST_SENT_KEY = 'itip.push.lastSent';

/** 설치별 UUID. 앱을 지우기 전까지 같은 값을 쓴다. */
export async function getInstallationId(): Promise<string> {
  const saved = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (saved) return saved;
  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(INSTALLATION_KEY, id);
  return id;
}

async function ensureChannel() {
  await Notifications.setNotificationChannelAsync(ANALYSIS_CHANNEL_ID, {
    name: '분석 완료 알림',
    importance: AndroidImportance.HIGH,
  });
}

const toPermission = (status: string): NotificationPermission =>
  status === 'granted' ? 'GRANTED' : status === 'denied' ? 'DENIED' : 'UNDETERMINED';

let syncing: Promise<void> | null = null;

/**
 * 현재 권한·토큰을 서버에 반영한다.
 * askPermission: 아직 묻지 않은 상태면 권한 팝업을 띄운다.
 * knownToken: 토큰 갱신 이벤트로 받은 새 토큰.
 */
export function syncPushDevice(opts: { askPermission?: boolean; knownToken?: string } = {}): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve(); // 설계 범위: Android
  const run = async () => {
    try {
      await ensureChannel();
      let { status } = await Notifications.getPermissionsAsync();
      if (status === 'undetermined' && opts.askPermission) {
        ({ status } = await Notifications.requestPermissionsAsync());
      }
      const permission = toPermission(status);
      let fcmToken: string | null = null;
      if (permission === 'GRANTED') {
        try {
          fcmToken = opts.knownToken ?? (await Notifications.getDevicePushTokenAsync()).data;
        } catch {
          fcmToken = null; // google-services.json 없는 빌드 등: 토큰 없이 권한 상태만 반영
        }
      }
      const body: DeviceRegistration = { platform: 'ANDROID', fcmToken, notificationPermission: permission };
      const installationId = await getInstallationId();
      const key = JSON.stringify([installationId, body]);
      if ((await AsyncStorage.getItem(LAST_SENT_KEY)) === key) return;
      await putDevice(installationId, body);
      await AsyncStorage.setItem(LAST_SENT_KEY, key);
    } catch {
      // 등록 실패는 분석·결과 조회를 막지 않는다. 다음 실행이나 앱 복귀 때 다시 보낸다.
    }
  };
  // 동시에 여러 번 불려도 한 번씩 순서대로 처리
  syncing = (syncing ?? Promise.resolve()).then(run);
  return syncing;
}
