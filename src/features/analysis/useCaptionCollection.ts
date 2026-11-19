import { canCollectCaption, type Batch } from '@/api/intake';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useCollectStore } from './collectStore';
import { enqueueCollection } from './runPipeline';
import { USE_MOCK } from '@/api/client';
import { LOCAL_ANALYSIS_NOTIFICATIONS } from '@/features/notifications/mode';
import { localAnalysisState, startLocalAnalysis } from './localBackground';

export function useCaptionCollection(batch: Batch | undefined) {
  const qc = useQueryClient();
  const allowed = useCollectStore((s) =>
    s.hydrated && !s.blocked && !!batch && s.allowedBatches.includes(batch.batchId));
  useEffect(() => {
    if (!batch || USE_MOCK || !LOCAL_ANALYSIS_NOTIFICATIONS ||
      ['COMPLETED', 'PARTIALLY_FAILED', 'FAILED'].includes(batch.status)) return;
    let active = true;
    let lastKey: string | null = null;
    async function refresh() {
      try {
        const state = await localAnalysisState(batch!.batchId);
        if (!active) return;
        const store = useCollectStore.getState();
        if (lastKey) store.setPhase(lastKey, null);
        lastKey = state.itemId ? batch!.batchId + ':' + state.itemId : null;
        if (lastKey && (state.phase === 'COLLECTING' || state.phase === 'UPLOADING')) {
          store.setPhase(lastKey, state.phase);
        }
        if (state.phase === 'RATE_LIMITED') store.pauseCollections();
        if (state.phase === 'PAUSED') {
          useCollectStore.setState({
            backgroundError: '인터넷 연결을 확인한 뒤 다시 연결해 주세요.',
            allowedBatches: store.allowedBatches.filter((id) => id !== batch!.batchId),
          });
        } else if (store.backgroundError) {
          useCollectStore.setState({ backgroundError: null });
        }
      } catch {
        // 상태 표시는 다음 조회 때 갱신한다. 실제 작업은 Android가 유지한다.
      }
    }
    void startLocalAnalysis(batch.batchId, allowed).then(() => {
      void refresh();
    }).catch(() => {
      if (active) useCollectStore.setState({ backgroundError: '자막 수집을 시작하지 못했어요. 앱을 업데이트한 뒤 다시 시도해 주세요.' });
    });
    const timer = setInterval(() => { void refresh(); }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
      if (lastKey) useCollectStore.getState().setPhase(lastKey, null);
    };
  }, [batch, allowed]);

  useEffect(() => {
    if (!USE_MOCK && LOCAL_ANALYSIS_NOTIFICATIONS) return;
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
