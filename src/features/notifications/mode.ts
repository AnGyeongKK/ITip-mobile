// 로컬 시연은 Android 백그라운드 작업으로 완료 상태를 조회한다.
export const LOCAL_ANALYSIS_NOTIFICATIONS = process.env.EXPO_PUBLIC_NOTIFICATION_MODE !== 'fcm';
