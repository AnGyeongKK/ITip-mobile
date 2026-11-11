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
    case 'INITIALIZATION_FAILED': return new CaptionError('UPLOAD_FAILED');
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
  if (!Array.isArray(data?.events)) throw new CaptionError('UPLOAD_FAILED');
  for (const ev of data.events ?? []) {
    if (!Array.isArray(ev?.segs)) continue;
    const text = ev.segs.map((s) => s.utf8 ?? '').join('');
    if (!text.trim()) continue;
    const startMs = ev.tStartMs;
    const duration = ev.dDurationMs;
    if (startMs == null || duration == null || !Number.isSafeInteger(startMs) ||
      !Number.isSafeInteger(duration) || startMs < 0 || duration <= 0) {
      throw new CaptionError('UPLOAD_FAILED');
    }
    const endMs = startMs + duration;
    if (!Number.isSafeInteger(endMs) || (durationMs != null && endMs > durationMs) ||
      startMs < (segments.at(-1)?.startMs ?? 0)) {
      throw new CaptionError('UPLOAD_FAILED');
    }
    segments.push({ startMs, endMs, text });
  }
  if (segments.length === 0) throw new CaptionError('KOREAN_CAPTION_NOT_FOUND');
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
