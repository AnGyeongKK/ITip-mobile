// 영상 시간 기준 분석 한도 (11/5 회의 결정: 무료 1시간).
// ⚠️ 시간 기준 필드명(limitMs 등)은 가정이다. 백엔드 확정 전에는 값이 없으면 null을 돌려주고, 화면은 시간 문구를 숨긴다.
// null을 0이나 무제한으로 해석하지 않는다.
import { USE_MOCK, delay, request } from './client';

export interface AnalysisQuota {
  limitMs: number;
  usedMs: number;
  reservedMs: number;
  remainingMs: number; // max(0, limit - used - reserved)
  resetsAt: string | null;
}

export async function getAnalysisQuota(): Promise<AnalysisQuota | null> {
  if (USE_MOCK) {
    await delay(300);
    return { limitMs: 3_600_000, usedMs: 18 * 60_000, reservedMs: 0, remainingMs: 42 * 60_000, resetsAt: '2026-11-30T15:00:00Z' };
  }
  const data = await request<{ analysis?: Partial<AnalysisQuota> }>({ method: 'GET', url: '/api/v1/users/me/entitlements' });
  const a = data?.analysis;
  if (a?.limitMs == null || a.usedMs == null || a.reservedMs == null) return null;
  return {
    limitMs: a.limitMs, usedMs: a.usedMs, reservedMs: a.reservedMs,
    remainingMs: a.remainingMs ?? Math.max(0, a.limitMs - a.usedMs - a.reservedMs),
    resetsAt: a.resetsAt ?? null,
  };
}

/** 디자인 표기("42분", "24분")처럼 분 단위만 보여준다. */
export const minutes = (ms: number, round: 'floor' | 'ceil' = 'floor') => `${Math[round](ms / 60_000)}분`;