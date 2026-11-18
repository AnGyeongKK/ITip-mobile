import { newIdempotencyKey, USE_MOCK } from '@/api/client';
import {
  canCollectCaption, isBatchDone, needsRecollect, resolveRetry,
  type BatchItem, type RetryOutcome, type Stage,
} from '@/api/intake';
import { AppScreen } from '@/components/AppShell';
import { IntakeError, toIssue, type Issue } from '@/components/IntakeError';
import { Button, ErrorView, LoadingView } from '@/components/ui';
import { VideoThumb } from '@/components/VideoInfoCard';
import { itemKey, useCollectStore, type Phase } from '@/features/analysis/collectStore';
import { useCaptionCollection } from '@/features/analysis/useCaptionCollection';
import { resumeLocalAnalysis } from '@/features/analysis/localBackground';
import { LOCAL_ANALYSIS_NOTIFICATIONS } from '@/features/notifications/mode';
import { useBatch, useCreateBatch, useRetryJob } from '@/hooks/intakeQueries';
import { qk } from '@/hooks/queries';
import { openResult } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

// 진행 문구는 서버가 주는 단계(stage)에 그대로 맞춘다.
const STAGE_LABEL: Record<Stage, string> = { VALIDATING: '자막 확인 중', SUMMARIZING: '요약 중', INDEXING: '검색 정보 정리 중', FINISHING: '마무리 중' };

function statusLabel(it: BatchItem, phase?: Phase): string | null {
  switch (it.status) {
    case 'AWAITING_UPLOAD': return phase === 'COLLECTING' ? '이 기기에서 자막 수집 중' : phase === 'UPLOADING' ? '자막 업로드 중' : canCollectCaption(it) ? '수집 대기 중' : '자막 업로드 시간이 지났어요';
    case 'QUEUED': return '분석 대기 중';
    case 'PROCESSING': return it.stage ? STAGE_LABEL[it.stage] : '분석 중';
    case 'RETRY_WAIT': return '자동으로 다시 시도하고 있어요';
    default: return null;
  }
}

function ItemRow({ it, phase, onRefresh }: { it: BatchItem; phase?: Phase; onRefresh: () => void }) {
  const label = statusLabel(it, phase);
  const retry = useRetryJob();
  const recollectBatch = useCreateBatch();
  const retryKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [issue, setIssue] = useState<Issue | null>(null);

  // RETRY_WAIT는 서버가 자동으로 다시 시도하므로 수동 재시도 버튼을 보여주지 않는다.
  const canRetry = it.status === 'FAILED' && !!it.jobId && it.error?.retryable === true;
  // 원본 자막 유실·업로드 기한 경과·수집 제한, 수동 재시도 410은 retryable과 상관없이 자막 다시 수집하기로 이어진다.
  const recollect = (needsRecollect(it) && !phase) || issue?.code === 'CAPTION_REUPLOAD_REQUIRED';

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
    <View style={s.item}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        {it.video ? <VideoThumb video={it.video} width={96} /> : <View style={s.thumbEmpty} />}
        <View style={{ flex: 1 }}>
          <Text style={font.body} numberOfLines={2}>{it.video?.title ?? `영상 ${it.videoId}`}</Text>
          {label ? <Text style={[font.caption, { marginTop: 4 }]}>{label}</Text> : null}
        </View>
      </View>
      {it.status === 'FAILED' && issue?.code !== 'CAPTION_REUPLOAD_REQUIRED' ? (
        <View style={{ marginTop: space.sm }}>
          <IntakeError issue={{ code: it.error?.code ?? 'GENERIC', message: it.error?.message }} />
        </View>
      ) : null}
      {issue ? <View style={{ marginTop: space.sm }}><IntakeError issue={issue} /></View> : null}
      {recollect ? (
        <Button title="자막 다시 수집하기" variant="secondary" style={{ marginTop: space.sm }}
          loading={recollectBatch.isPending} onPress={recollectCaptions} />
      ) : canRetry ? (
        <Button title="분석 다시 시도" variant="secondary" style={{ marginTop: space.sm }}
          loading={retry.isPending} onPress={retryAnalysis} />
      ) : null}
      {it.status === 'COMPLETED' && it.analysisId ? (
        <Button title="결과 보기" variant="secondary" style={{ marginTop: space.sm }} onPress={() => openResult(it.analysisId!)} />
      ) : null}
    </View>
  );
}

export default function Analyze() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const q = useBatch(batchId);
  const qc = useQueryClient();
  const phases = useCollectStore((st) => st.phases);
  const blocked = useCollectStore((st) => st.blocked);
  const backgroundError = useCollectStore((st) => st.backgroundError);
  const hydrated = useCollectStore((st) => st.hydrated);
  const allowed = useCollectStore((st) => st.allowedBatches.includes(batchId));
  const allowBatch = useCollectStore((st) => st.allowBatch);
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

  if (q.isPending || !hydrated) return <AppScreen><LoadingView label="이전 분석 상태를 확인하고 있어요" /></AppScreen>;
  if (q.isError || !batch) return <AppScreen><ErrorView error={q.error} onRetry={q.refetch} /></AppScreen>;

  const hasUploadToResume = batch.items.some(canCollectCaption);
  const collecting = batch.items.some((item) => !!phases[itemKey(batch.batchId, item.itemId)]);
  const canResume = hasUploadToResume && (blocked || !allowed);
  const rateLimited = batch.items.some((i) => i.error?.code === 'COLLECTION_RATE_LIMITED');
  const { completed, failed, total } = batch.counts;

  async function resumeCollection() {
    setResuming(true);
    setResumeIssue(null);
    try {
      const next = await q.refetch({ throwOnError: true });
      if (next.data?.items.some(canCollectCaption)) {
        if (!USE_MOCK && LOCAL_ANALYSIS_NOTIFICATIONS) await resumeLocalAnalysis(batchId);
        allowBatch(batchId);
      }
    } catch (e) {
      setResumeIssue(toIssue(e));
    } finally {
      setResuming(false);
    }
  }

  async function reconnectBackground() {
    setResuming(true);
    try {
      await resumeLocalAnalysis(batchId);
      useCollectStore.setState({ backgroundError: null });
      await q.refetch();
    } catch (e) {
      setResumeIssue(toIssue(e));
    } finally {
      setResuming(false);
    }
  }
  const title = !done ? '분석하고 있어요'
    : batch.status === 'COMPLETED' ? '분석이 끝났어요'
    : batch.status === 'PARTIALLY_FAILED' ? '일부 영상을 분석하지 못했어요'
    : '분석하지 못했어요';

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Text style={font.title}>{title}</Text>
        {total > 1 ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>
            {failed > 0 ? `${completed}개 완료 · ${failed}개 실패` : `${completed} / ${total}개 완료`}
          </Text>
        ) : null}
        {blocked && (canResume || rateLimited) ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>자막 수집이 제한됐어요. 서버에 접수한 분석은 계속 진행돼요.</Text>
        ) : canResume ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>아직 자막을 보내지 않은 영상이 있어요.</Text>
        ) : hasUploadToResume || collecting ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>
            {LOCAL_ANALYSIS_NOTIFICATIONS
              ? '자막을 이 기기에서 수집해요. 화면을 닫아도 수집과 분석은 계속돼요.'
              : '자막을 이 기기에서 수집해요. 수집이 끝날 때까지 앱을 켜 두세요.'}
          </Text>
        ) : batch.counts.awaitingUpload > 0 ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>자막 업로드 시간이 지났어요. 필요한 영상은 자막을 다시 수집해 주세요.</Text>
        ) : !done ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>이 화면을 벗어나도 분석은 계속돼요.</Text>
        ) : null}
        {!done ? <Button title="완료 알림 설정" variant="secondary"
          style={{ marginTop: space.sm }} onPress={() => router.push('/settings/notifications')} /> : null}
        {backgroundError ? <Text style={[font.sub, { marginTop: space.sm }]}>{backgroundError}</Text> : null}
        {backgroundError && !hasUploadToResume ? <Button title="알림 상태 다시 연결" variant="secondary"
          loading={resuming} onPress={reconnectBackground} style={{ marginTop: space.sm }} /> : null}
        {canResume ? <Button title={blocked ? '다시 시도' : '자막 수집 재개'} onPress={resumeCollection}
          loading={resuming} style={{ marginTop: space.md }} /> : null}
        {resumeIssue ? <View style={{ marginTop: space.sm }}><IntakeError issue={resumeIssue} /></View> : null}

        <View style={{ height: space.lg }} />

        {batch.items.map((it) => (
          <ItemRow key={itemKey(batch.batchId, it.itemId)} it={it} phase={phases[itemKey(batch.batchId, it.itemId)]}
            onRefresh={() => { void q.refetch(); }} />
        ))}

        {done ? <Button title="홈으로" variant="ghost" onPress={() => router.replace('/')} style={{ marginTop: space.lg }} /> : null}
      </ScrollView>
    </AppScreen>
  );
}

const s = StyleSheet.create({
  item: { padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm },
  thumbEmpty: { width: 96, height: 54, borderRadius: radius.sm, backgroundColor: colors.surfaceStrong },
});
