import { ApiError } from '@/api/client';
import { toIssue, type Issue } from '@/components/IntakeError';

/**
 * 링크 조회 단계의 오류를 안내로 바꾼다.
 * 영상이 없다(404 → VIDEO_UNAVAILABLE)와 일시적인 조회 장애(네트워크·5xx → LOOKUP_FAILED)를 다르게 보여준다.
 */
export function lookupIssue(e: unknown): Issue {
  if (e instanceof ApiError && (e.isNetwork || (e.status ?? 0) >= 500)) return { code: 'LOOKUP_FAILED' };
  return toIssue(e);
}