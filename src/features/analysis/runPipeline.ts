import { ApiError } from '@/api/client';
import { UploadError, reportCollectFail, submitCaptions, type CaptionFile, type CollectionFailureCode } from '@/api/intake';
import { CaptionError, collectCaption } from './captions';
import { itemKey, useCollectStore } from './collectStore';

interface Task { batchId: string; itemId: string; videoId: string; durationMs: number | null }

const MAX_DURATION_MS = 3_600_000; // 60분 (IMPORT-01 captionRequirement와 같은 값)
const queue: Task[] = [];
const seen = new Set<string>(); // 이번 앱 실행 중 이미 큐에 넣은 항목
let running = false;

export function enqueueCollection(batchId: string, items: { itemId: string; videoId: string; durationMs: number | null }[]) {
  for (const it of items) {
    const key = itemKey(batchId, it.itemId);
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({ batchId, ...it });
  }
  void drain();
}

async function collectWithRetry(t: Task): Promise<CaptionFile> {
  try {
    return await collectCaption(t.videoId, t.durationMs);
  } catch (e) {
    if (e instanceof CaptionError && !e.retryable) throw e;
    return collectCaption(t.videoId, t.durationMs); // 일시 오류는 한 번만 더
  }
}

async function submitWithRetry(t: Task, caption: CaptionFile) {
  try {
    await submitCaptions(t.batchId, t.itemId, caption);
  } catch (e) {
    const transient = e instanceof UploadError || (e instanceof ApiError && (e.status === null || e.status >= 500));
    if (!transient) throw e;
    await submitCaptions(t.batchId, t.itemId, caption);
  }
}

/** 성공하면 null, 실패하면 서버에 보고할 코드를 돌려준다. */
async function processOne(t: Task): Promise<CollectionFailureCode | null> {
  const { setPhase } = useCollectStore.getState();
  const key = itemKey(t.batchId, t.itemId);
  if (t.durationMs != null && t.durationMs > MAX_DURATION_MS) return 'DURATION_EXCEEDED';
  try {
    setPhase(key, 'COLLECTING');
    const caption = await collectWithRetry(t);
    setPhase(key, 'UPLOADING');
    await submitWithRetry(t, caption);
    return null;
  } catch (e) {
    return e instanceof CaptionError ? e.code : 'UPLOAD_FAILED';
  } finally {
    setPhase(key, null);
  }
}

async function report(t: Task, code: CollectionFailureCode) {
  try {
    await reportCollectFail(t.batchId, t.itemId, code);
  } catch {
    // 409 ITEM_ALREADY_SUBMITTED 등: 접수가 이미 됐을 수 있으니 다음 배치 조회가 최종 상태를 보여준다
  }
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const t = queue.shift()!;
      const code = await processOne(t);
      if (!code) continue;
      await report(t, code);
      if (code === 'COLLECTION_RATE_LIMITED') {
        // 수집 제한이면 추가 수집을 멈추고, 같은 배치의 남은 영상은 같은 사유로 보고한다
        for (let i = queue.length - 1; i >= 0; i--) {
          if (queue[i].batchId === t.batchId) {
            const [rest] = queue.splice(i, 1);
            await report(rest, code);
          }
        }
      }
    }
  } finally {
    running = false;
    if (queue.length) void drain();
  }
}