import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import { formatDuration, type PlaylistItem } from '@/api/intake';
import { AppScreen } from '@/components/AppShell';
import { IntakeError, toIssue, type Issue } from '@/components/IntakeError';
import { Button, EmptyView, LoadingView } from '@/components/ui';
import { useCreateBatch, usePlaylistItems, useQuota } from '@/hooks/intakeQueries';
import { openResult } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

// 선택 가능: 분석 불가로 확정되지 않았고(UNKNOWN 포함), 기존 결과·진행 중인 작업이 없는 영상
const isSelectable = (i: PlaylistItem) => i.eligibility !== 'INELIGIBLE' && i.existing.status === 'NONE';

function note(i: PlaylistItem): string {
  if (i.existing.status === 'COMPLETED') return '분석 완료 · 눌러서 결과 보기';
  if (i.existing.status === 'PROCESSING') return '분석 중인 영상이에요';
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
  const quota = useQuota();
  const createBatch = useCreateBatch();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issue, setIssue] = useState<Issue | null>(null);

  const head = q.data?.pages[0];
  // 같은 영상이 여러 번 나와도 videoId 기준으로 1개만 둔다
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages ?? []).flatMap((p) => p.items).filter((i) => (seen.has(i.videoId) ? false : (seen.add(i.videoId), true)));
  }, [q.data]);
  const selectable = items.filter(isSelectable);
  const allOn = selectable.length > 0 && selectable.every((i) => selected.has(i.videoId));
  const needMs = items.filter((i) => selected.has(i.videoId)).reduce((sum, i) => sum + (i.durationMs ?? 0), 0);

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const start = async () => {
    setIssue(null);
    try {
      const b = await createBatch.mutateAsync({ videoIds: [...selected], playlistId: head?.playlistId ?? playlistId });
      router.replace({ pathname: '/analyze/[batchId]', params: { batchId: b.batchId } });
    } catch (e) {
      if (e instanceof ApiError && e.isLimit) {
        quota.refetch();
        setIssue({ code: 'ANALYSIS_QUOTA_EXCEEDED' });
      } else {
        setIssue(toIssue(e));
      }
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
            const on = selected.has(item.videoId);
            return (
              <Pressable
                disabled={!selectableItem && !openable}
                onPress={() => (openable ? openResult(item.existing.analysisId!) : toggle(item.videoId))}
                style={[s.row, !selectableItem && !openable && { opacity: 0.45 }]}
              >
                {selectableItem ? (
                  <View style={[s.check, on && s.checkOn]}>{on ? <Text style={{ color: '#fff' }}>✓</Text> : null}</View>
                ) : <View style={{ width: 22 }} />}
                <View style={{ flex: 1 }}>
                  <Text style={font.body} numberOfLines={2}>{item.title}</Text>
                  <Text style={font.caption}>{note(item)}</Text>
                </View>
              </Pressable>
            );
          }}
                    ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator style={{ margin: space.lg }} color={colors.textSub} /> : undefined}
        />
        <View style={s.bar}>
          {issue ? (
            <View style={{ marginBottom: space.md }}>
              <IntakeError issue={issue} remainingMs={quota.data?.remainingMs} neededMs={needMs || null} onClose={() => setIssue(null)} />
            </View>
          ) : null}
          {quota.data ? (
            <Text style={[font.caption, { marginBottom: space.sm }]}>
              남은 분석 시간 {formatDuration(quota.data.remainingMs)}{needMs ? ` · 선택한 영상 ${formatDuration(needMs)}` : ''}
            </Text>
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
  bar: { padding: space.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});