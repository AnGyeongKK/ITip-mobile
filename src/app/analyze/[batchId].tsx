import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { newIdempotencyKey } from '@/api/client';
import { canCollectCaption, isBatchDone, overallStep, type BatchItem, type Stage } from '@/api/intake';
import { AppScreen } from '@/components/AppShell';
import { IntakeError, toIssue, type Issue } from '@/components/IntakeError';
import { Button, ErrorView, LoadingView } from '@/components/ui';
import { VideoThumb } from '@/components/VideoInfoCard';
import { itemKey, useCollectStore, type Phase } from '@/features/analysis/collectStore';
import { useCaptionCollection } from '@/features/analysis/useCaptionCollection';
import { useBatch, useRetryJob } from '@/hooks/intakeQueries';
import { qk } from '@/hooks/queries';
import { openResult, startAnalysisFromVideo } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

const STEPS = ['영상 확인', '확인 완료', '내용 확인', 'AI 정리'];
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
  const retryKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [issue, setIssue] = useState<Issue | null>(null);
  const canRetry = it.status === 'FAILED' && !!it.jobId && it.error?.retryable === true;
  const needsNewBatch = (it.status === 'AWAITING_UPLOAD' && !phase && !canCollectCaption(it)) ||
    it.error?.code === 'CAPTION_UPLOAD_EXPIRED' || it.error?.code === 'COLLECTION_RATE_LIMITED' ||
    issue?.code === 'CAPTION_REUPLOAD_REQUIRED';

  async function retryAnalysis() {
    if (!canRetry || !it.jobId || inFlight.current) return;
    inFlight.current = true;
    retryKey.current ??= newIdempotencyKey();
    setIssue(null);
    try {
      const job = await retry.mutateAsync({ jobId: it.jobId, idempotencyKey: retryKey.current });
      retryKey.current = null;
      onRefresh();
      router.replace({ pathname: '/analyze/[batchId]', params: { batchId: job.batchId } });
    } catch (e) {
      const failure = toIssue(e);
      setIssue(failure);
      if (failure.code === 'JOB_NOT_RETRYABLE' || failure.code === 'RESOURCE_NOT_FOUND') {
        retryKey.current = null;
        onRefresh();
      }
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
      {it.status === 'FAILED' ? (
        <View style={{ marginTop: space.sm }}>
          <IntakeError issue={{ code: it.error?.code ?? 'GENERIC', message: it.error?.message }} />
        </View>
      ) : null}
      {issue ? <View style={{ marginTop: space.sm }}><IntakeError issue={issue} /></View> : null}
      {needsNewBatch ? (
        <Button title="새 분석 요청"
          variant="secondary" style={{ marginTop: space.sm }} onPress={() => startAnalysisFromVideo(it.videoId)} />
      ) : canRetry ? (
        <Button title={retry.isPending ? '재시도 요청 중' : '분석 다시 시도'} variant="secondary"
          style={{ marginTop: space.sm }} loading={retry.isPending} onPress={retryAnalysis} />
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

  const step = overallStep(batch);
  const canResume = batch.items.some(canCollectCaption) && (blocked || !allowed);
  const rateLimited = batch.items.some((i) => i.error?.code === 'COLLECTION_RATE_LIMITED');

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
    : batch.status === 'COMPLETED' ? '분석이 끝났어요'
    : batch.status === 'PARTIALLY_FAILED' ? '일부 영상을 분석하지 못했어요'
    : '분석하지 못했어요';

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        <Text style={font.title}>{title}</Text>
        {batch.counts.total > 1 ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>{batch.counts.completed} / {batch.counts.total}개 완료</Text>
        ) : null}
        {blocked && (canResume || rateLimited) ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>자막 수집이 제한됐어요. 서버에 접수한 분석은 계속 진행돼요.</Text>
        ) : canResume ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>아직 자막을 보내지 않은 영상이 있어요.</Text>
        ) : batch.counts.awaitingUpload > 0 ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>자막을 이 기기에서 수집해요. 수집이 끝날 때까지 앱을 켜 두세요.</Text>
        ) : !done ? (
          <Text style={[font.sub, { marginTop: space.xs }]}>이 화면을 벗어나도 분석은 계속돼요.</Text>
        ) : null}
        {canResume ? <Button title={blocked ? '다시 시도' : '자막 수집 재개'} onPress={resumeCollection}
          loading={resuming} style={{ marginTop: space.md }} /> : null}
        {resumeIssue ? <View style={{ marginTop: space.sm }}><IntakeError issue={resumeIssue} /></View> : null}

        {!done ? (
          <View style={{ marginVertical: space.xl, gap: space.md }}>
            {STEPS.map((label, i) => {
              const n = i + 1;
              const st = n < step ? 'done' : n === step ? 'now' : 'wait';
              return (
                <View key={label} style={s.stepRow}>
                  <View style={[s.dot, st === 'done' && s.dotDone, st === 'now' && s.dotNow]}>
                    <Text style={{ color: st === 'wait' ? colors.textMuted : '#fff', fontSize: 12 }}>{st === 'done' ? '✓' : n}</Text>
                  </View>
                  <Text style={[font.body, st === 'wait' && { color: colors.textMuted }, st === 'now' && { fontWeight: '700' }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        ) : <View style={{ height: space.lg }} />}

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
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.primary },
  dotNow: { backgroundColor: colors.accent },
  item: { padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm },
  thumbEmpty: { width: 96, height: 54, borderRadius: radius.sm, backgroundColor: colors.surfaceStrong },
});
