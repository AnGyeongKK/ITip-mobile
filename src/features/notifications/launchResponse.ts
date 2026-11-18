import * as Notifications from 'expo-notifications';

export function notificationTarget(response: Notifications.NotificationResponse | null | undefined) {
  if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  const data = response.notification.request.content.data;
  if (data?.type !== 'ANALYSIS_BATCH_FINISHED') return null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof data.analysisId === 'string' && uuid.test(data.analysisId)) {
    return { pathname: '/result/[analysisId]' as const, params: { analysisId: data.analysisId } };
  }
  if (typeof data.batchId === 'string' && uuid.test(data.batchId)) {
    return { pathname: '/analyze/[batchId]' as const, params: { batchId: data.batchId } };
  }
  return null;
}
