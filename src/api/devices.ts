// 알림 기기 등록·토큰 갱신 / 현재 기기 알림 연결 해제 (푸시 구현 설계 · 1. 모바일 → Spring API)
// 사용자는 서버가 인증(시연에서는 데모 사용자 ID)으로 정한다. 응답 본문은 쓰지 않는다.
import { delay, request, USE_MOCK } from './client';

export type NotificationPermission = 'GRANTED' | 'DENIED' | 'UNDETERMINED';

export interface DeviceRegistration {
  platform: 'ANDROID';
  /** 네이티브 FCM 등록 토큰. 권한이 없거나 토큰을 못 받으면 null (발송 대상에서 제외) */
  fcmToken: string | null;
  notificationPermission: NotificationPermission;
}

/** PUT /api/v1/users/me/devices/{installationId} — 최초 등록, 토큰 변경, 권한 변경 시 같은 주소로 보낸다. */
export async function putDevice(installationId: string, body: DeviceRegistration): Promise<void> {
  if (USE_MOCK) { await delay(100); return; }
  await request<unknown>({ method: 'PUT', url: `/api/v1/users/me/devices/${encodeURIComponent(installationId)}`, data: body });
}

/** DELETE /api/v1/users/me/devices/{installationId} — 현재 기기의 알림 연결을 해제한다. */
export async function deleteDevice(installationId: string): Promise<void> {
  if (USE_MOCK) { await delay(100); return; }
  await request<unknown>({ method: 'DELETE', url: `/api/v1/users/me/devices/${encodeURIComponent(installationId)}` });
}
