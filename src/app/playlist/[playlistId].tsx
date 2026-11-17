import { ApiError } from '@/api/client';
import { conflictBatchId, formatDuration, getJob, type PlaylistItem } from '@/api/intake';
import { AppScreen } from '@/components/AppShell';
import { IntakeError, toIssue, type Issue } from '@/components/IntakeError';
import { Button, EmptyView, LoadingView } from '@/components/ui';
import { useCollectStore } from '@/features/analysis/collectStore';
import { useCreateBatch, usePlaylistItems } from '@/hooks/intakeQueries';
import { openResult } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

// 선택 가능: 분석 불가로 확정되지 않았고(UNKNOWN 포함), 기존 결과·진행 중인 작업이 없는 영상
const isSelectable = (i: PlaylistItem) => i.eligibility !== 'INELIGIBLE' && i.existing.status === 'NONE';
// 진행 상태를 열 수 있는 영상: 이미 접수돼 분석 중이고 jobId가 있는 영상
const isInProgress = (i: PlaylistItem) => i.existing.status === 'PROCESSING' && !!i.existing.jobId;

function note(i: PlaylistItem): string {
  if (i.existing.status === 'COMPLETED') return '분석 완료 · 눌러서 결과 보기';
  if (i.existing.status === 'PROCESSING') return '분석 중인 영상이에요';
  if (i.existing.status === 'AWAITING_UPLOAD') return '자막 수집 대기 · 눌러서 재개';
  if (i.eligibility === 'INELIGIBLE') {
    return i.reasonCode === 'DURATION_EXCEEDED' ? '60분을 넘어 분석할 수 없어요'
      : i.reasonCode === 'VIDEO_UNAVAILABLE' ? '접근할 수 없는 영상이에요' : '분석할 수 없는 영상이에요';
  }
  const dur = i.durationMs != null ? ` · ${formatDuration(i.durationMs)}` : '';
  return `${i.channelName}${dur}${i.eligibility === 'UNKNOWN' ? ' · 자막은 수집 후 확인돼요' : ''}`;
}

export default function PlaylistScreen() {
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  const q = usePlaylistItems(playlistId);
  const createBatch = useCreateBatch();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issue, setIssue] = useState<Issue | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null); // 진행 상태를 여는 중인 영상

  const head = q.data?.pages[0];
  // 같은 영상이 여러 번 나와도 videoId 기준으로 1개만 둔다
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages ?? []).flatMap((p) => p.items).filter((i) => (seen.has(i.videoId) ? false : (seen.add(i.videoId), true)));
  }, [q.data]);
  const selectable = items.filter(isSelectable);
  const allOn = selectable.length > 0 && selectable.every((i) => selected.has(i.videoId));

  const toggle = (id: string) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const start = async () => {
    setIssue(null);
    try {
      const b = await createBatch.mutateAsync({ videoIds: [...selected], playlistId: head?.playlistId ?? playlistId });
      router.replace({ pathname: '/analyze/[batchId]', params: { batchId: b.batchId } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.code === 'STATE_CONFLICT') {
        const batchId = conflictBatchId(e);
        if (batchId) {
          useCollectStore.getState().requireResume(batchId);
          return router.replace({ pathname: '/analyze/[batchId]', params: { batchId } });
        }
        setSelected(new Set());
        await q.refetch();
      }
      setIssue(toIssue(e));
    }
  };

  /** 이미 접수된 영상의 진행 화면 열기: jobId → batchId. 새 배치를 만들거나 자막을 다시 수집하지 않는다. */
  const openProgress = async (item: PlaylistItem) => {
    const jobId = item.existing.jobId;
    if (!jobId || openingId) return;
    setIssue(null);
    setOpeningId(item.videoId);
    try {
      const job = await getJob(jobId);
      useCollectStore.getState().requireResume(job.batchId);
      router.push({ pathname: '/analyze/[batchId]', params: { batchId: job.batchId } });
    } catch (e) {
      setIssue(toIssue(e));
    } finally {
      setOpeningId(null);
    }
  };

  if (q.isPending) return <AppScreen><LoadingView label="재생목록을 불러오고 있어요" /></AppScreen>;
  if (q.isError) {
    const code = q.error instanceof ApiError ? q.error.code : 'GENERIC';
    return (
      <AppScreen>
        <View style={{ padding: space.lg }}>
          <IntakeError issue={toIssue(q.error)} onRetry={code === 'PLAYLIST_NOT_FOUND' ? undefined : () => q.refetch()} onClose={() => router.back()} />
        </View>
      </AppScreen>
    );
  }
  if (items.length === 0) return <AppScreen><EmptyView title="영상이 없어요" desc="비어 있는 재생목록이에요." /></AppScreen>;

  return (
    <AppScreen>
      <View style={{ flex: 1 }}>
        <FlatList
          data={items}
          keyExtractor={(i) => i.videoId}
          contentContainerStyle={{ padding: space.lg }}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
          ListHeaderComponent={
            <View style={{ marginBottom: space.md }}>
              <Text style={font.title}>{head?.title}</Text>
              {head?.totalItemCount != null ? <Text style={[font.sub, { marginTop: 4 }]}>영상 {head.totalItemCount}개</Text> : null}
              <Pressable
                onPress={() => setSelected(allOn ? new Set() : new Set(selectable.map((i) => i.videoId)))}
                style={{ marginTop: space.md }}
              >
                <Text style={font.h3}>{allOn ? '전체 해제' : '불러온 영상 전체 선택'} ({selected.size}/{selectable.length})</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const selectableItem = isSelectable(item);
            const openable = item.existing.status === 'COMPLETED' && !!item.existing.analysisId;
            const inProgress = isInProgress(item);
            const awaitingUpload = item.existing.status === 'AWAITING_UPLOAD' && !!item.existing.batchId;
            const on = selected.has(item.videoId);
            const opening = openingId === item.videoId;
            return (
              <Pressable
                disabled={!selectableItem && !openable && !inProgress && !awaitingUpload}
                onPress={() => {
                  if (openable) openResult(item.existing.analysisId!);
                  else if (inProgress) void openProgress(item);
                  else if (awaitingUpload) {
                    const batchId = item.existing.batchId!;
                    useCollectStore.getState().requireResume(batchId);
                    router.push({ pathname: '/analyze/[batchId]', params: { batchId } });
                  }
                  else toggle(item.videoId);
                }}
                style={[s.row, !selectableItem && !openable && !inProgress && !awaitingUpload && { opacity: 0.45 }]}
              >
                {selectableItem ? (
                  <View style={[s.check, on && s.checkOn]}>{on ? <Text style={{ color: '#fff' }}>✓</Text> : null}</View>
                ) : <View style={{ width: 22 }} />}
                <View style={{ flex: 1 }}>
                  <Text style={font.body} numberOfLines={2}>{item.title}</Text>
                  <Text style={font.caption}>{note(item)}</Text>
                </View>
                {inProgress || awaitingUpload ? (
                  <View style={s.progressBtn}>
                    {opening
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={s.progressText}>{awaitingUpload ? '수집 재개' : '진행 상태 보기'}</Text>}
                  </View>
                ) : null}
              </Pressable>
            );
          }}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator style={{ margin: space.lg }} color={colors.textSub} /> : undefined}
        />
        <View style={s.bar}>
          {issue ? (
            <View style={{ marginBottom: space.md }}>
              <IntakeError issue={issue} onClose={() => setIssue(null)} />
            </View>
          ) : null}

          <Button title={`${selected.size}개 분석하기`} onPress={start} disabled={selected.size === 0} loading={createBatch.isPending} />
        </View>
      </View>
    </AppScreen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  check: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  progressBtn: { minWidth: 88, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  progressText: { ...font.caption, color: colors.primaryStrong },
  bar: { padding: space.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
