import { useEffect, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppShell';
import { Button } from '@/components/ui';
import { syncPushDevice, type PushRegistrationStatus } from '@/features/notifications/pushDevice';
import { font, space } from '@/theme/tokens';

const messages: Record<PushRegistrationStatus, string> = {
  local_ready: '분석 완료 알림이 켜졌어요. 영상 분석이 끝나면 이 기기로 알려드릴게요.',
  registered: '이 기기의 알림이 등록됐어요. 분석이 끝나면 알려드릴게요.',
  permission_required: '분석 완료 알림을 받으려면 알림을 허용해 주세요.',
  permission_denied: '기기 설정에서 ITip의 알림을 허용해 주세요.',
  token_unavailable: '앱의 알림 연결을 준비하지 못했어요. 앱을 업데이트한 뒤 다시 시도해 주세요.',
  registration_failed: '알림을 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  unsupported: '현재 알림은 Android에서 지원해요.',
  mock: '목업 모드에서는 실제 알림을 보내지 않아요.',
};

export default function NotificationSettings() {
  const [status, setStatus] = useState<PushRegistrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const next = await syncPushDevice();
      if (active) setStatus(next);
    };
    void refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => { active = false; listener.remove(); };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      if (status === 'permission_denied') await Linking.openSettings();
      else setStatus(await syncPushDevice({ askPermission: true }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen back>
      <View style={{ padding: space.lg, gap: space.lg }}>
        <Text style={font.title}>분석 완료 알림</Text>
        <Text style={font.body}>{status ? messages[status] : '알림 연결을 확인하고 있어요.'}</Text>
        <Button title={status === 'permission_denied' ? '기기 알림 설정 열기' : '알림 연결 확인'}
          loading={busy} onPress={enable} />
      </View>
    </AppScreen>
  );
}
