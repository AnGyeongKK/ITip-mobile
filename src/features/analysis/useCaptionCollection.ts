import { useEffect } from 'react';
import type { Batch } from '@/api/intake';
import { enqueueCollection } from './runPipeline';

/** 배치에 AWAITING_UPLOAD 항목이 있으면 이 기기에서 자막 수집을 시작한다. */
export function useCaptionCollection(batch: Batch | undefined) {
  useEffect(() => {
    if (!batch) return;
    const todo = batch.items
      .filter((i) => i.status === 'AWAITING_UPLOAD')
      .map((i) => ({ itemId: i.itemId, videoId: i.videoId, durationMs: i.video?.durationMs ?? null }));
    if (todo.length) enqueueCollection(batch.batchId, todo);
  }, [batch]);
}