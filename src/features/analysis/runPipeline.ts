import { ApiError } from '@/api/client';
import {
  canCollectCaption, getBatch, reportCollectFail, submitCaptions,
  type CaptionFile, type CollectionFailureCode,
} from '@/api/intake';
import { CaptionError, collectCaption } from './captions';
import { itemKey, useCollectStore } from './collectStore';

interface CollectionItem { itemId: string; videoId: string; durationMs: number | null; uploadDeadlineAt: string }
interface Task extends CollectionItem { batchId: string; onSettled?: () => void }

const MAX_DURATION_MS = 3_600_000; // 60분 (IMPORT-01 captionRequirement와 같은 값)
const queue: Task[] = [];
const seen = new Set<string>(); // 이번 앱 실행 중 이미 큐에 넣은 항목
let running = false;

/** onSettled: 항목 하나의 수집·접수·실패 보고가 끝날 때마다 호출된다(화면이 배치를 다시 조회하는 용도). */
export function enqueueCollection(batchId: string, items: CollectionItem[], onSettled?: () => void) {
  if (useCollectStore.getState().blocked) return;
  for (const it of items) {
    const key = itemKey(batchId, it.itemId);
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({ batchId, onSettled, ...it });
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

/** 성공하면 null, 실패하면 서버에 보고할 코드를 돌려준다. */
async function processOne(t: Task): Promise<CollectionFailureCode | null> {
  const { setPhase } = useCollectStore.getState();
  const key = itemKey(t.batchId, t.itemId);
  if (t.durationMs != null && t.durationMs > MAX_DURATION_MS) return 'DURATION_EXCEEDED';
  try {
    setPhase(key, 'COLLECTING');
    const caption = await collectWithRetry(t);
    setPhase(key, 'UPLOADING');
    await submitCaptions(t.batchId, t.itemId, caption);
    return null;
  } catch (e) {
    return e instanceof CaptionError ? e.code : 'UPLOAD_FAILED';
  } finally {
    setPhase(key, null);
  }
}

/**
 * 수집 실패 보고(PATCH). 응답이 유실돼도 자막 수집은 다시 하지 않는다.
 * - 409(STATE_CONFLICT): 이미 접수·종료된 항목이라 다시 보고하지 않는다. 최종 상태는 배치 재조회가 보여준다.
 * - 네트워크 오류: 배치를 다시 조회해서, 여전히 AWAITING_UPLOAD이고 기한 내일 때만 같은 PATCH를 한 번 더 보낸다.
 */
async function report(t: Task, code: CollectionFailureCode) {
  try {
    await reportCollectFail(t.batchId, t.itemId, code);
    return;
  } catch (e) {
    if (!(e instanceof ApiError && e.isNetwork)) return; // 409 등: 다시 보내지 않는다
  }
  try {
    const batch = await getBatch(t.batchId);
    const item = batch.items.find((i) => i.itemId === t.itemId);
    if (item && canCollectCaption(item)) await reportCollectFail(t.batchId, t.itemId, code);
  } catch {
    // 재조회·재전송도 실패하면 더 시도하지 않는다. 기한이 지나면 서버가 실패로 종료하고 예약을 반환한다.
  }
}

function settle(t: Task) {
  try {
    t.onSettled?.();
  } catch {
    // 화면 갱신 실패가 수집 흐름을 막지 않게 한다
  }
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length && !useCollectStore.getState().blocked) {
      const t = queue.shift()!;
      if (!(Date.parse(t.uploadDeadlineAt) > Date.now())) {
        settle(t); // 기한이 지난 항목은 수집하지 않는다. 서버가 실패로 종료한다.
        continue;
      }
      const code = await processOne(t);
      if (code) {
        if (code === 'COLLECTION_RATE_LIMITED') {
          useCollectStore.getState().pauseCollections();
          for (const pending of queue.splice(0)) seen.delete(itemKey(pending.batchId, pending.itemId));
        }
        await report(t, code);
      }
      settle(t);
    }
  } finally {
    running = false;
    if (queue.length && !useCollectStore.getState().blocked) void drain();
  }
}