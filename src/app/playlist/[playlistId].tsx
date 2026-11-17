import { ApiError } from '@/api/client';
import { getJob, type PlaylistItem } from '@/api/intake';
import { minutes } from '@/api/quota';
import { GrayScreen } from '@/components/GrayScreen';
import { IntakeError, toIssue, type Issue } from '@/components/IntakeError';
import { Button, EmptyView, LoadingView } from '@/components/ui';
import { useCollectStore } from '@/features/analysis/collectStore';
import { useCreateBatch, usePlaylistItems } from '@/hooks/intakeQueries';
import { useQuota } from '@/hooks/useQuota';
import { youtubeThumb } from '@/lib/format';
import { openResult } from '@/lib/handoff';
import { colors, palette, radius, typography } from '@/theme/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// 선택 가능: 분석 불가로 확정되지 않았고(UNKNOWN 포함), 기존 결과·진행 중인 작업이 없는 영상
const isSelectable = (i: PlaylistItem) => i.eligibility !== 'INELIGIBLE' && i.existing.status === 'NONE';
// 진행 상태를 열 수 있는 영상: 이미 접수돼 분석 중이고 jobId가 있는 영상
const isInProgress = (i: PlaylistItem) => i.existing.status === 'PROCESSING' && !!i.existing.jobId;

const rowMinutes = (ms: number | null) => (ms == null ? null : `${Math.max(1, Math.floor(ms / 60_000))}분`);

function rowNote(i: PlaylistItem): string {
  const dur = rowMinutes(i.durationMs);
  const join = (text: string) => (dur ? `${dur} · ${text}` : text);
  if (i.existing.status === 'COMPLETED') return join('분석 완료');
  if (i.existing.status === 'PROCESSING') return join('분석 중');
  if (i.eligibility === 'INELIGIBLE') {
    return join(i.reasonCode === 'DURATION_EXCEEDED' ? '60분 초과' : i.reasonCode === 'VIDEO_UNAVAILABLE' ? '접근 불가' : '분석 불가');
  }
  if (i.eligibility === 'ELIGIBLE') return join('분석 가능');
  return dur ?? i.channelName; // UNKNOWN: 분석 가능으로 단정하지 않는다
}

function ListIcon() {
  const p = { stroke: colors.textSub, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={16} height={14} viewBox="0 0 16 14" fill="none">
      <Path d="M1 2.5h9M1 7h6M1 11.5h6" {...p} />
      <Path d="M10 7.5l4.5 2.75L10 13z" {...p} />
    </Svg>
  );
}

function Checkbox({ state }: { state: 'on' | 'off' | 'disabled' }) {
  return (
    <View style={[s.box, state === 'on' && s.boxOn, state === 'disabled' && s.boxDisabled]}>
      {state === 'on' ? <Text style={s.tick}>✓</Text> : state === 'disabled' ? <View style={s.dash} /> : null}
    </View>
  );
}

function PlaylistRow({ item, on, opening, onToggle, onOpenResult, onOpenProgress }: {
  item: PlaylistItem; on: boolean; opening: boolean; onToggle: () => void; onOpenResult: () => void; onOpenProgress: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const selectable = isSelectable(item);
  const completed = item.existing.status === 'COMPLETED' && !!item.existing.analysisId;
  const processing = isInProgress(item);
  const faded = !selectable;
  return (
    <Pressable
      disabled={!selectable && !completed && !processing}
      onPress={() => (completed ? onOpenResult() : processing ? onOpenProgress() : onToggle())}
      style={s.row}
    >
      <Checkbox state={faded ? 'disabled' : on ? 'on' : 'off'} />
      <View style={[s.thumb, faded && { backgroundColor: colors.border }]}>
        {!failed ? <Image source={{ uri: youtubeThumb(item.videoId, item.thumbnailUrl) }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} /> : null}
      </View>
      <View style={{ flex: 1, marginLeft: 4 }}>
        <Text style={[s.rowTitle, faded && s.fadedText]} numberOfLines={2}>{item.title}</Text>
        <Text style={[s.rowSub, faded && s.fadedText]} numberOfLines={1}>{rowNote(item)}</Text>
      </View>
      {processing ? (
        <View style={s.progressBtn}>
          {opening ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={s.progressText}>진행 상태 보기</Text>}
        </View>
      ) : null}
      <View style={s.divider} pointerEvents="none" />
    </Pressable>
  );
}

export default function PlaylistScreen() {
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();
  const q = usePlaylistItems(playlistId);
  const quota = useQuota();
  const createBatch = useCreateBatch();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issue, setIssue] = useState<Issue | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [headThumbFailed, setHeadThumbFailed] = useState(false);

  const head = q.data?.pages[0];
  // 같은 영상이 여러 번 나와도 videoId 기준으로 1개만 둔다
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages ?? []).flatMap((p) => p.items).filter((i) => (seen.has(i.videoId) ? false : (seen.add(i.videoId), true)));
  }, [q.data]);
  const selectable = items.filter(isSelectable);
  const allOn = selectable.length > 0 && selectable.every((i) => selected.has(i.videoId));

  const chosen = items.filter((i) => selected.has(i.videoId));
  const needMs = chosen.reduce((sum, i) => sum + (i.durationMs ?? 0), 0);
  const remainingMs = quota.data?.remainingMs ?? null;
  const over = remainingMs != null && chosen.length > 0 && needMs > remainingMs;
  const disabled = chosen.length === 0 || over;

  const toggle = (id: string) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const start = async () => {
    setIssue(null);
    try {
      await createBatch.mutateAsync({ videoIds: chosen.map((i) => i.videoId), playlistId: head?.playlistId ?? playlistId });
      void qc.invalidateQueries({ queryKey: ['quota'] });
      router.dismissTo('/'); // 진행은 홈의 '분석 중' 카드로 본다
    } catch (e) {
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
      useCollectStore.getState().rememberBatch(job.batchId);
      router.push({ pathname: '/analyze/[batchId]', params: { batchId: job.batchId } });
    } catch (e) {
      setIssue(toIssue(e));
    } finally {
      setOpeningId(null);
    }
  };

  if (q.isPending) return <GrayScreen><LoadingView label="재생목록을 불러오고 있어요" /></GrayScreen>;
  if (q.isError) {
    const code = q.error instanceof ApiError ? q.error.code : 'GENERIC';
    return (
      <GrayScreen>
        <View style={{ padding: 16 }}>
          <IntakeError issue={toIssue(q.error)} onRetry={code === 'PLAYLIST_NOT_FOUND' ? undefined : () => q.refetch()} onClose={() => router.back()} />
        </View>
      </GrayScreen>
    );
  }
  if (items.length === 0) return <GrayScreen><EmptyView title="영상이 없어요" desc="비어 있는 재생목록이에요." /></GrayScreen>;

  const eligible = head?.eligibilityCounts?.eligible;
  const headSub = head?.totalItemCount != null
    ? `${head.totalItemCount}개 동영상${eligible != null ? ` · 분석가능 ${eligible}개` : ''}`
    : '';

  return (
    <GrayScreen>
      <View style={s.screen}>
        <Text style={[typography.heading20, s.title]}>분석할 영상을 선택해주세요</Text>

        <View style={s.card}>
          <View style={s.plHeader}>
            <View style={s.plThumbWrap}>
              <View style={[s.stack, { top: -8, left: 12, right: 12, backgroundColor: colors.divider }]} />
              <View style={[s.stack, { top: -4, left: 6, right: 6, backgroundColor: colors.border }]} />
              <View style={s.plThumb}>
                {head?.thumbnailUrl && !headThumbFailed ? (
                  <Image source={{ uri: head.thumbnailUrl }} style={StyleSheet.absoluteFill} onError={() => setHeadThumbFailed(true)} />
                ) : null}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.subtitle16Bold} numberOfLines={1}>{head?.title}</Text>
              {headSub ? (
                <View style={s.plSubRow}>
                  <ListIcon />
                  <Text style={s.plSub}>{headSub}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Pressable onPress={() => setSelected(allOn ? new Set() : new Set(selectable.map((i) => i.videoId)))} style={s.allRow}>
            <Checkbox state={allOn ? 'on' : 'off'} />
            <Text style={s.allText}>{allOn ? '전체 선택 해제' : '전체 선택'}</Text>
          </Pressable>

          <View style={s.listWrap}>
            <FlatList
              data={items}
              keyExtractor={(i) => i.videoId}
              onEndReachedThreshold={0.5}
              onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
              renderItem={({ item }) => (
                <PlaylistRow
                  item={item}
                  on={selected.has(item.videoId)}
                  opening={openingId === item.videoId}
                  onToggle={() => toggle(item.videoId)}
                  onOpenResult={() => openResult(item.existing.analysisId!)}
                  onOpenProgress={() => void openProgress(item)}
                />
              )}
              ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} color={colors.textSub} /> : undefined}
            />
            <View pointerEvents="none" style={s.fade}>
              {[0.2, 0.4, 0.6, 0.8].map((o) => <View key={o} style={{ height: 6, backgroundColor: `rgba(255,255,255,${o})` }} />)}
            </View>
          </View>

          <View style={s.footer}>
            {remainingMs != null ? (
              <View style={s.timeRow}>
                <View style={s.freePill}><Text style={[typography.button12, { color: palette.primary[60] }]}>Free</Text></View>
                <Text style={[typography.body14Medium, { color: colors.icon }]}>이번달 남은 시간</Text>
                <Text style={[typography.body14Bold, { color: palette.primary[60] }]}>{minutes(remainingMs)}</Text>
              </View>
            ) : null}
            <View style={s.summary}>
              <Text style={[typography.heading18, { color: colors.icon }]}>선택 {chosen.length}개 · 총 {minutes(needMs, 'ceil')}</Text>
              {over ? (
                <Text style={[typography.caption12, { color: colors.danger, marginTop: 3 }]}>{minutes(needMs - remainingMs!, 'ceil')}을 줄여야 분석할 수 있어요.</Text>
              ) : remainingMs != null && chosen.length > 0 ? (
                <Text style={[typography.caption12, { color: colors.textDisabled, marginTop: 3 }]}>분석 후 {minutes(remainingMs - needMs)} 남아요</Text>
              ) : null}
            </View>
          </View>
        </View>

        {issue ? <View style={{ marginTop: 12 }}><IntakeError issue={issue} onClose={() => setIssue(null)} /></View> : null}
        <Button
          title="분석 하기"
          onPress={start}
          disabled={disabled}
          loading={createBatch.isPending}
          style={[{ marginTop: 20 }, disabled && s.btnDisabled] as never}
        />
      </View>
    </GrayScreen>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  title: { paddingHorizontal: 8, marginTop: 12 },
  card: { flex: 1, marginTop: 14, backgroundColor: colors.bg, borderRadius: radius.lg, overflow: 'hidden' },
  plHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 24, paddingHorizontal: 16 },
  plThumbWrap: { width: 72, height: 41 },
  plThumb: { width: 72, height: 41, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.thumbPlaceholder },
  stack: { position: 'absolute', height: 6, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  plSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plSub: { ...typography.body13Medium, lineHeight: 20, color: colors.textSub },
  allRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 18, marginTop: 28, paddingHorizontal: 16 },
  allText: { ...typography.body14Semibold, color: colors.icon },
  listWrap: { flex: 1, marginTop: 17 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 16 },
  thumb: { width: 72, height: 41, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.thumbPlaceholder },
  rowTitle: { ...typography.body13Medium, lineHeight: 18, color: colors.text },
  rowSub: { ...typography.caption12, lineHeight: 18, color: colors.textSub },
  fadedText: { color: colors.textMuted },
  divider: { position: 'absolute', left: 24, right: 24, bottom: 0, height: 1, backgroundColor: colors.divider },
  box: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textMuted, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  dash: { width: 8, height: 1.5, backgroundColor: colors.border },
  tick: { color: colors.onPrimary, fontSize: 12, lineHeight: 14, fontWeight: '700' },
  progressBtn: { minWidth: 88, height: 32, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  progressText: { ...typography.caption12, color: colors.primaryStrong },
  footer: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 20 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  freePill: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 6 },
  summary: { marginTop: 7, minHeight: 45, justifyContent: 'center' },
  btnDisabled: { backgroundColor: colors.border, opacity: 1 },
});