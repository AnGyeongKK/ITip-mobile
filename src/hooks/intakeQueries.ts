import { useFocusEffect } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as intake from '@/api/intake';

/** 화면이 보이고 앱이 포그라운드일 때만 true */
function useScreenActive() {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && appActive;
}

export const useImportResource = () => useMutation({ mutationFn: (url: string) => intake.importResource(url) });

export const useCreateBatch = () =>
  useMutation({ mutationFn: (v: { videoIds: string[]; playlistId?: string | null }) => intake.createBatch(v.videoIds, v.playlistId ?? null) });

export const usePlaylistItems = (playlistId: string) =>
  useInfiniteQuery({
    queryKey: ['playlist', playlistId],
    queryFn: ({ pageParam }) => intake.getPlaylistItems(playlistId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor ?? undefined : undefined),
    enabled: !!playlistId,
  });

export const useQuota = () => useQuery({ queryKey: ['quota'], queryFn: intake.getAnalysisQuota, staleTime: 0 });

/** 서버가 준 nextPollAfterMs로 폴링하고, 화면이 안 보이거나 백그라운드면 멈춘다. 복귀하면 바로 다시 조회한다. */
export function useBatch(batchId: string) {
  const active = useScreenActive();
  return useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => intake.getBatch(batchId),
    enabled: !!batchId && active,
    staleTime: 0,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d || intake.isBatchDone(d)) return false;
      return Math.max(d.nextPollAfterMs ?? 5000, 2000);
    },
  });
}