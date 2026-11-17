import { newIdempotencyKey } from '@/api/client';
import {
  canCollectCaption, isBatchDone, needsRecollect, resolveRetry,
  type BatchItem, type RetryOutcome, type Stage,
} from '@/api/intake';
import { GrayScreen } from '@/components/GrayScreen';
import { IntakeError, toIssue, type Issue } from '@/components/IntakeError';
import { PlaylistHeader } from '@/components/PlaylistHeader';
import { Button, ErrorView, LoadingView } from '@/components/ui';
import { itemKey, useCollectStore, type Phase } from '@/features/analysis/collectStore';
import { useCaptionCollection } from '@/features/analysis/useCaptionCollection';
import { useViewedStore } from '@/features/analysis/viewedStore';
import { useBatch, useCreateBatch, useRetryJob } from '@/hooks/intakeQueries';
import { qk } from '@/hooks/queries';
import { youtubeThumb } from '@/lib/format';
import { openResult } from '@/lib/handoff';
import { colors, palette, radius, typography } from '@/theme/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const HIGHLIGHT = '#D9EEFF'; // 확인한 행 바탕 (피그마)

// 진행 문구는 서버가 주는 단계(stage)에 그대로 맞춘다.
const STAGE_LABEL: Record<Stage, string> = { VALIDATING: '자막 확인 중', SUMMARIZING: '요약 중', INDEXING: '검색 정보 정리 중', FINISHING: '마무리 중' };

const rowMinutes = (ms: number | null | undefined) => (ms == null ? null : `${Math.max(1, Math.floor(ms / 60_000))}분`);

function statusLabel(it: BatchItem, phase?: Phase): string | null {
  switch (it.status) {
    case 'AWAITING_UPLOAD': return phase === 'COLLECTING' ? '이 기기에서 자막 수집 중' : phase === 'UPLOADING' ? '자막 업로드 중' : canCollectCaption(it) ? '수집 대기 중' : '자막 업로드 시간이 지났어요';
    case 'QUEUED': return '분석 대기 중';
    case 'PROCESSING': return it.stage ? STAGE_LABEL[it.stage] : '분석 중';
    case 'RETRY_WAIT': return '자동으로 다시 시도하고 있어요';
    default: return null;
  }
}

function RowThumb({ item }: { item: BatchItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={s.thumb}>
      {!failed ? (
        <Image source={{ uri: youtubeThumb(item.videoId, item.video?.thumbnailUrl) }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
      ) : null}
    </View>
  );
}

function ItemRow({ it, phase, showViewState, viewed, last, onView, onRefresh }: {
  it: BatchItem; phase?: Phase; showViewState: boolean; viewed: boolean; last: boolean; onView: () => void; onRefresh: () => void;
}) {
  const retry = useRetryJob();
  const recollectBatch = useCreateBatch();
  const retryKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [issue, setIssue] = useState<Issue | null>(null);

  const completed = it.status === 'COMPLETED' && !!it.analysisId;
  // RETRY_WAIT는 서버가 자동으로 다시 시도하므로 수동 재시도 버튼을 보여주지 않는다.
  const canRetry = it.status === 'FAILED' && !!it.jobId && it.error?.retryable === true;
  // 원본 자막 유실·업로드 기한 경과·수집 제한, 수동 재시도 410은 retryable과 상관없이 자막 다시 수집하기로 이어진다.
  const recollect = (needsRecollect(it) && !phase) || issue?.code === 'CAPTION_REUPLOAD_REQUIRED';

  const dur = rowMinutes(it.video?.durationMs);
  const sub = completed
    ? (showViewState ? `${dur ?? ''} ${viewed ? '확인완료' : '확인 전'}`.trim() : dur)
    : (statusLabel(it, phase) ?? dur);

  /** 서버 작업 수동 재시도: 202면 새 배치로, 200(완료 결과 재사용)이면 결과로, 410이면 자막 재수집으로 연결한다. */
  async function retryAnalysis() {
    if (!canRetry || !it.jobId || inFlight.current) return;
    inFlight.current = true;
    retryKey.current ??= newIdempotencyKey();
    setIssue(null);
    try {
      const job = await retry.mutateAsync({ jobId: it.jobId, idempotencyKey: retryKey.current });
      retryKey.current = null;
      let next: RetryOutcome;
      try {
        next = await resolveRetry(job);
      } catch {
        next = { kind: 'BATCH', batchId: job.batchId }; // 결과 확인에 실패해도 접수된 배치 화면으로 보낸다
      }
      onRefresh();
      if (next.kind === 'RESULT') openResult(next.analysisId);
      else router.replace({ pathname: '/analyze/[batchId]', params: { batchId: next.batchId } });
    } catch (e) {
      const failure = toIssue(e);
      setIssue(failure);
      // 결과가 확정된 응답이면 같은 키를 다시 쓰지 않고 최신 상태를 다시 불러온다.
      if (['JOB_NOT_RETRYABLE', 'RESOURCE_NOT_FOUND', 'CAPTION_REUPLOAD_REQUIRED'].includes(failure.code)) {
        retryKey.current = null;
        onRefresh();
      }
    } finally {
      inFlight.current = false;
    }
  }

  /** 자막 다시 수집하기: 이 영상으로 새 배치를 만들면 기존 수집 흐름(기기 수집 → 업로드 → 접수)이 이어진다. */
  async function recollectCaptions() {
    if (inFlight.current) return;
    inFlight.current = true;
    setIssue(null);
    try {
      const next = await recollectBatch.mutateAsync({ videoIds: [it.videoId], playlistId: null });
      onRefresh();
      router.replace({ pathname: '/analyze/[batchId]', params: { batchId: next.batchId } });
    } catch (e) {
      setIssue(toIssue(e));
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <View style={[s.row, viewed && completed && { backgroundColor: HIGHLIGHT }]}>
      <Pressable disabled={!completed} onPress={onView} style={s.rowTop}>
        <RowThumb item={it} />
        <View style={{ flex: 1, marginRight: 4 }}>
          <Text style={s.rowTitle} numberOfLines={2}>{it.video?.title ?? `영상 ${it.videoId}`}</Text>
          {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {completed ? (
          <View style={[s.viewBtn, viewed && s.viewBtnDone]}>
            <Text style={[typography.button12, { color: viewed ? palette.primary[60] : colors.onPrimary }]}>{viewed ? '확인 완료' : '보러 가기'}</Text>
          </View>
        ) : null}
      </Pressable>
      {it.status === 'FAILED' && issue?.code !== 'CAPTION_REUPLOAD_REQUIRED' ? (
        <View style={{ marginTop: 12 }}>
          <IntakeError issue={{ code: it.error?.code ?? 'GENERIC', message: it.error?.message }} />
        </View>
      ) : null}
      {issue ? <View style={{ marginTop: 12 }}><IntakeError issue={issue} /></View> : null}
      {recollect ? (
        <Button title="자막 다시 수집하기" variant="secondary" style={{ marginTop: 12 }} loading={recollectBatch.isPending} onPress={recollectCaptions} />
      ) : canRetry ? (
        <Button title="분석 다시 시도" variant="secondary" style={{ marginTop: 12 }} loading={retry.isPending} onPress={retryAnalysis} />
      ) : null}
      {!last && !(viewed && completed) ? <View style={s.divider} pointerEvents="none" /> : null}
    </View>
  );
}

export default function Analyze() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const q = useBatch(batchId);
  const qc = useQueryClient();
  const phases = useCollectStore((st) => st.phases);
  const blocked = useCollectStore((st) => st.blocked);
  const hydrated = useCollectStore((st) => st.hydrated);
  const allowed = useCollectStore((st) => st.allowedBatches.includes(batchId));
  const allowBatch = useCollectStore((st) => st.allowBatch);
  const viewedKeys = useViewedStore((st) => st.viewed);
  const markViewed = useViewedStore((st) => st.mark);
  const [resuming, setResuming] = useState(false);
  const [resumeIssue, setResumeIssue] = useState<Issue | null>(null);
  const batch = q.data;

  useCaptionCollection(batch);

  const done = batch ? isBatchDone(batch) : false;
  useEffect(() => {
    if (!batch || !done) return;
    qc.invalidateQueries({ queryKey: qk.home });
    qc.invalidateQueries({ queryKey: ['records'] });
    // 영상 1개가 끝나면 바로 결과로 (뒤로 가기로 진행 화면에 돌아오지 않게 replace)
    const only = batch.items.length === 1 ? batch.items[0] : null;
    if (only?.status === 'COMPLETED' && only.analysisId) {
      router.replace({ pathname: '/result/[analysisId]', params: { analysisId: only.analysisId } });
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isPending || !hydrated) return <GrayScreen><LoadingView label="이전 분석 상태를 확인하고 있어요" /></GrayScreen>;
  if (q.isError || !batch) return <GrayScreen><ErrorView error={q.error} onRetry={q.refetch} /></GrayScreen>;

  const hasUploadToResume = batch.items.some(canCollectCaption);
  const collecting = batch.items.some((item) => !!phases[itemKey(batch.batchId, item.itemId)]);
  const canResume = hasUploadToResume && (blocked || !allowed);
  const rateLimited = batch.items.some((i) => i.error?.code === 'COLLECTION_RATE_LIMITED');
  const { completed, failed, total } = batch.counts;
  const allSuccess = done && batch.status === 'COMPLETED';
  const anyViewed = batch.items.some((it) => viewedKeys.includes(itemKey(batch.batchId, it.itemId)));

  async function resumeCollection() {
    setResuming(true);
    setResumeIssue(null);
    try {
      const next = await q.refetch({ throwOnError: true });
      if (next.data?.items.some(canCollectCaption)) allowBatch(batchId);
    } catch (e) {
      setResumeIssue(toIssue(e));
    } finally {
      setResuming(false);
    }
  }

  const title = !done ? '분석하고 있어요'
    : allSuccess ? '선택한 영상들 분석이 끝났어요'
    : batch.status === 'PARTIALLY_FAILED' ? '일부 영상을 분석하지 못했어요'
    : '분석하지 못했어요';

  const hints: string[] = [];
  if (allSuccess) {
    hints.push('영상을 눌러 요약을 각각 확인해보세요');
  } else {
    if (total > 1) hints.push(failed > 0 ? `${completed}개 완료 · ${failed}개 실패` : `${completed} / ${total}개 완료`);
    if (!done) {
      if (blocked && (canResume || rateLimited)) hints.push('자막 수집이 제한됐어요. 서버에 접수한 분석은 계속 진행돼요.');
      else if (canResume) hints.push('아직 자막을 보내지 않은 영상이 있어요.');
      else if (hasUploadToResume || collecting) hints.push('자막을 이 기기에서 수집해요. 수집이 끝날 때까지 앱을 켜 두세요.');
      else if (batch.counts.awaitingUpload > 0) hints.push('자막 업로드 시간이 지났어요. 필요한 영상은 자막을 다시 수집해 주세요.');
      else hints.push('이 화면을 벗어나도 분석은 계속돼요.');
    }
  }

  return (
    <GrayScreen>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={[typography.heading20, s.title]}>{title}</Text>
        {hints.map((h) => <Text key={h} style={s.hint}>{h}</Text>)}
        {canResume ? (
          <Button title={blocked ? '다시 시도' : '자막 수집 재개'} onPress={resumeCollection} loading={resuming} style={{ marginTop: 12 }} />
        ) : null}
        {resumeIssue ? <View style={{ marginTop: 8 }}><IntakeError issue={resumeIssue} /></View> : null}

        <View style={s.card}>
          {batch.playlist ? (
            <>
              <PlaylistHeader
                title={batch.playlist.title}
                thumbnailUrl={batch.playlist.thumbnailUrl}
                subtitle={batch.playlist.totalItemCount != null ? `${batch.playlist.totalItemCount}개 동영상` : undefined}
              />
              <View style={{ height: 14 }} />
            </>
          ) : null}
          {batch.items.map((it, i) => {
            const key = itemKey(batch.batchId, it.itemId);
            return (
              <ItemRow
                key={key}
                it={it}
                phase={phases[key]}
                showViewState={anyViewed}
                viewed={viewedKeys.includes(key)}
                last={i === batch.items.length - 1}
                onView={() => { markViewed(key); openResult(it.analysisId!); }}
                onRefresh={() => { void q.refetch(); }}
              />
            );
          })}
          <View style={{ height: 4 }} />
        </View>

        {done && !allSuccess ? <Button title="홈으로" variant="ghost" onPress={() => router.replace('/')} style={{ marginTop: 16 }} /> : null}
      </ScrollView>
    </GrayScreen>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { paddingHorizontal: 8, marginTop: 12 },
  hint: { ...typography.body14Medium, color: colors.textBody, paddingHorizontal: 8, marginTop: 4 },
  card: { marginTop: 10, backgroundColor: colors.bg, borderRadius: radius.lg, overflow: 'hidden' },
  row: { paddingVertical: 16, paddingHorizontal: 16 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 72, height: 41, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.thumbPlaceholder },
  rowTitle: { ...typography.body13Medium, lineHeight: 18, color: colors.text },
  rowSub: { ...typography.caption12, lineHeight: 18, color: colors.textSub },
  viewBtn: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.primary },
  viewBtnDone: { backgroundColor: palette.neutral[93] },
  divider: { position: 'absolute', left: 24, right: 24, bottom: 0, height: 1, backgroundColor: colors.divider },
});