import { canCollectCaption, type Batch } from '@/api/intake';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useCollectStore } from './collectStore';
import { enqueueCollection } from './runPipeline';

export function useCaptionCollection(batch: Batch | undefined) {
  const qc = useQueryClient();
  const allowed = useCollectStore((s) =>
    s.hydrated && !s.blocked && !!batch && s.allowedBatches.includes(batch.batchId));
  useEffect(() => {
    if (!batch || !allowed) return;
    const todo = batch.items
      .filter(canCollectCaption)
      .map((i) => ({
        itemId: i.itemId, videoId: i.videoId, durationMs: i.video?.durationMs ?? null,
        uploadDeadlineAt: i.uploadDeadlineAt,
      }));
    if (todo.length) {
      enqueueCollection(batch.batchId, todo, () => {
        void qc.invalidateQueries({ queryKey: ['batch', batch.batchId] });
      });
    }
  }, [batch, allowed, qc]);
}