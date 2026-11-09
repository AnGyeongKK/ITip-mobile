import { requireOptionalNativeModule } from 'expo-modules-core';
import { USE_MOCK, delay } from '@/api/client';
import type { CaptionFile, CaptionSegment, CollectionFailureCode } from '@/api/intake';

type NativeResult = { source: 'manual' | 'auto-orig' | 'auto'; json3: string };
type Native = { collect(videoId: string): Promise<NativeResult>; updateYtDlp(): Promise<string> };
const native = requireOptionalNativeModule<Native>('CaptionCollector');

export class CaptionError extends Error {
  constructor(public code: CollectionFailureCode, public retryable = false) {
    super(code);
  }
}

function toCaptionError(e: unknown): CaptionError {
  switch ((e as { code?: string })?.code) {
    case 'NO_CAPTION': return new CaptionError('KOREAN_CAPTION_NOT_FOUND');
    case 'VIDEO_UNAVAILABLE': return new CaptionError('VIDEO_UNAVAILABLE');
    case 'RATE_LIMITED': return new CaptionError('COLLECTION_RATE_LIMITED');
    default: return new CaptionError('UPLOAD_FAILED', true); // 일시 오류로 보고 한 번 다시 시도
  }
}

type Json3 = { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[] };

/** YouTube json3 → 명세의 segments 형식. 0 ≤ startMs < endMs ≤ 영상 길이를 맞춘다. */
export function parseJson3(raw: string, videoId: string, durationMs: number | null): CaptionFile {
  let data: Json3;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new CaptionError('UPLOAD_FAILED', true);
  }
  const segments: CaptionSegment[] = [];
  let prev = '';
  for (const ev of data.events ?? []) {
    if (ev.tStartMs == null || !ev.segs) continue;
    const text = ev.segs.map((s) => s.utf8 ?? '').join('').replace(/\s+/g, ' ').trim();
    if (!text || text === prev) continue; // 빈 줄·연속 중복 제거
    const startMs = Math.max(0, Math.round(ev.tStartMs));
    let endMs = startMs + Math.max(Math.round(ev.dDurationMs ?? 0), 1);
    if (durationMs != null) endMs = Math.min(endMs, durationMs);
    if (endMs <= startMs) continue;
    segments.push({ startMs, endMs, text });
    prev = text;
  }
  if (segments.length === 0) throw new CaptionError('KOREAN_CAPTION_NOT_FOUND');
  segments.sort((a, b) => a.startMs - b.startMs);
  return { videoId, language: 'ko', segments };
}

let updating: Promise<void> | null = null;
/** yt-dlp는 YouTube 변경에 자주 깨져서 앱 실행 후 첫 수집 전에 한 번 업데이트한다(실패해도 무시). */
function ensureUpdated(): Promise<void> {
  if (!native) return Promise.resolve();
  updating ??= native.updateYtDlp().then(() => undefined).catch(() => undefined);
  return updating;
}

export async function collectCaption(videoId: string, durationMs: number | null): Promise<CaptionFile> {
  if (USE_MOCK) {
    await delay(1200);
    return { videoId, language: 'ko', segments: [{ startMs: 0, endMs: 4300, text: '목업 자막이에요.' }] };
  }
  if (!native) throw new CaptionError('UPLOAD_FAILED'); // 개발 빌드가 아니면 수집 불가
  await ensureUpdated();
  try {
    const res = await native.collect(videoId);
    return parseJson3(res.json3, videoId, durationMs);
  } catch (e) {
    throw e instanceof CaptionError ? e : toCaptionError(e);
  }
}