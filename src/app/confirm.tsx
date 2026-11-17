// 링크 확인 중 → 영상 분석이 가능해요! (피그마 SHARE-01, VIDEO-CONFIRM-FREE)
// 사용: router.push({ pathname: '/confirm', params: { url } })  — 홈이 2단계에서 연결한다.
import { getJob } from '@/api/intake';
import { minutes } from '@/api/quota';
import type { Video } from '@/api/types';
import { AppScreen } from '@/components/AppShell';
import { IntakeError, toIssue, type Issue } from '@/components/IntakeError';
import { Button } from '@/components/ui';
import { VideoConfirmCard } from '@/components/VideoConfirmCard';
import { useCollectStore } from '@/features/analysis/collectStore';
import { lookupIssue } from '@/features/analysis/lookupIssue';
import { parseYoutubeUrl } from '@/features/analysis/parseYoutubeUrl';
import { useCreateBatch, useImportResource } from '@/hooks/intakeQueries';
import { useQuota } from '@/hooks/useQuota';
import { colors, palette, radius, typography } from '@/theme/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

// 디자인 문구. IT 판정·한국어 자막 확인은 앱이 아직 검증하지 못하는 내용이라 바뀔 수 있어 한곳에 모았다.
const TEXT = {
  checkingTitle: '영상이 분석 가능한지 확인할게요',
  checkingHeading: 'ITip이 정보를 처리중이에요...',
  steps: ['영상 정보를 불러오는 중이에요', 'IT 관련 영상인지 확인하고 있어요', 'IT 관련 영상인지 확인하는 중'],
  note: '영상은 단일 분석하고, 재생목록은 영상 선택 화면으로 이동해 분석할 수 있어요.',
  readyTitle: '영상 분석이 가능해요!',
  quotaLabel: '이번 달 분석 가능 시간',
  start: '분석 하기',
  later: '나중에',
};
const MIN_CHECKING_MS = 1200; // 조회가 빨라도 확인 화면이 깜빡이지 않게 최소로 보여주는 시간
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Resource = { videoId: string; metadata: Video | null };
type Phase = 'checking' | 'ready' | 'error';

export default function Confirm() {
  const { url } = useLocalSearchParams<{ url?: string }>();
  const qc = useQueryClient();
  const importResource = useImportResource();
  const createBatch = useCreateBatch();
  const quota = useQuota();

  const [phase, setPhase] = useState<Phase>('checking');
  const [lookupDone, setLookupDone] = useState(false);
  const [resource, setResource] = useState<Resource | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [startIssue, setStartIssue] = useState<Issue | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPhase('checking');
      setLookupDone(false);
      setResource(null);
      setIssue(null);
      setStartIssue(null);
      const startedAt = Date.now();
      const raw = url?.trim() ?? '';
      const parsed = parseYoutubeUrl(raw);
      if (parsed.type === 'invalid') {
        setIssue({ code: 'INVALID_YOUTUBE_URL' });
        setPhase('error');
        return;
      }
      if (parsed.type === 'playlist') {
        router.replace({ pathname: '/playlist/[playlistId]', params: { playlistId: parsed.playlistId } });
        return;
      }
      try {
        const r = await importResource.mutateAsync(raw);
        if (cancelled) return;
        if (r.type === 'PLAYLIST') {
          router.replace({ pathname: '/playlist/[playlistId]', params: { playlistId: r.playlistId } });
          return;
        }
        // 기존 결과가 있으면 결과로, 진행 중이면 그 작업의 배치 진행 화면으로
        if (r.existing.status === 'COMPLETED' && r.existing.analysisId) {
          router.replace({ pathname: '/result/[analysisId]', params: { analysisId: r.existing.analysisId } });
          return;
        }
        if (r.existing.status === 'PROCESSING' && r.existing.jobId) {
          const job = await getJob(r.existing.jobId);
          if (cancelled) return;
          useCollectStore.getState().rememberBatch(job.batchId);
          router.replace({ pathname: '/analyze/[batchId]', params: { batchId: job.batchId } });
          return;
        }
        const d = r.metadata?.durationMs;
        if (d != null && d > r.captionRequirement.maxDurationMs) {
          setIssue({ code: 'DURATION_EXCEEDED' });
          setPhase('error');
          return;
        }
        setResource({ videoId: r.videoId, metadata: r.metadata });
        setLookupDone(true);
        await wait(Math.max(0, MIN_CHECKING_MS - (Date.now() - startedAt)));
        if (!cancelled) setPhase('ready');
      } catch (e) {
        if (!cancelled) {
          setIssue(lookupIssue(e));
          setPhase('error');
        }
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [url, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (!resource || createBatch.isPending) return;
    setStartIssue(null);
    try {
      await createBatch.mutateAsync({ videoIds: [resource.videoId] });
      void qc.invalidateQueries({ queryKey: ['quota'] });
      router.replace('/'); // 진행은 홈의 '분석 중' 카드로 본다
    } catch (e) {
      setStartIssue(toIssue(e));
    }
  };

  // ---------- 분석 가능 ----------
  if (phase === 'ready' && resource) {
    const remainingMs = quota.data?.remainingMs ?? null;
    const needMs = resource.metadata?.durationMs ?? null;
    const enough = remainingMs == null || needMs == null || needMs <= remainingMs;
    return (
      <AppScreen back>
        <ScrollView contentContainerStyle={s.readyContent}>
          <Text style={[typography.heading20, s.center]}>{TEXT.readyTitle}</Text>
          {remainingMs != null ? (
            <Text style={[typography.subtitle16Semibold, s.center, { color: colors.textBody, marginTop: 4 }]}>
              {TEXT.quotaLabel}{'  '}
              <Text style={[typography.subtitle16Bold, { color: palette.primary[60] }]}>{minutes(remainingMs)}</Text>
            </Text>
          ) : null}
          <View style={{ marginTop: 16 }}>
            <VideoConfirmCard videoId={resource.videoId} video={resource.metadata} />
          </View>
          {remainingMs != null && needMs != null ? (
            <View style={[s.quotaPill, !enough && { backgroundColor: colors.surface }]}>
              <Text style={[typography.body13Medium, { color: enough ? palette.primary[60] : colors.danger }]}>
                {enough ? `분석 후 ${minutes(remainingMs - needMs)} 남아요.` : `남은 분석 시간이 ${minutes(remainingMs)}이라 분석할 수 없어요.`}
              </Text>
            </View>
          ) : null}
          {startIssue ? <View style={{ marginTop: 16 }}><IntakeError issue={startIssue} onClose={() => setStartIssue(null)} /></View> : null}
          <Button title={TEXT.start} onPress={start} disabled={!enough} loading={createBatch.isPending} style={{ marginTop: 14 }} />
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.later}>
            <Text style={[typography.body14Medium, { color: colors.textDisabled }]}>{TEXT.later}</Text>
          </Pressable>
        </ScrollView>
      </AppScreen>
    );
  }

  // ---------- 확인 중 / 오류 ----------
  return (
    <AppScreen back>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={[typography.heading20, s.pageTitle]}>{TEXT.checkingTitle}</Text>
        {phase === 'error' && issue ? (
          <View style={{ marginTop: 20 }}>
            <IntakeError
              issue={issue}
              onRetry={issue.code === 'LOOKUP_FAILED' ? () => setAttempt((n) => n + 1) : undefined}
              onClose={() => router.back()}
            />
          </View>
        ) : (
          <>
            <View style={{ marginTop: 20 }}>
              <VideoConfirmCard videoId={resource?.videoId ?? ''} video={resource?.metadata ?? null} />
            </View>
            <Text style={[typography.subtitle16Bold, s.stepsHeading]}>{TEXT.checkingHeading}</Text>
            <View style={s.stepsBox}>
              <StepRow label={TEXT.steps[0]} done={lookupDone} />
              <StepRow label={TEXT.steps[1]} done={lookupDone} style={{ marginTop: 20 }} />
              <StepRow label={TEXT.steps[2]} done={false} connector={lookupDone} style={{ marginTop: 23 }} />
            </View>
            <View style={s.note}>
              <View style={s.infoIcon}><Text style={s.infoI}>i</Text></View>
              <Text style={[typography.caption12, { flex: 1, color: colors.textDisabled }]}>{TEXT.note}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function StepRow({ label, done, connector, style }: { label: string; done: boolean; connector?: boolean; style?: ViewStyle }) {
  return (
    <View style={[s.stepRow, style]}>
      {connector ? <View style={s.connector} /> : null}
      {done ? (
        <View style={s.checkCircle}><Text style={s.checkMark}>✓</Text></View>
      ) : (
        <View style={s.dashedCircle} />
      )}
      <Text style={s.stepText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { textAlign: 'center' },
  pageTitle: { paddingHorizontal: 8, marginTop: 20 },
  stepsHeading: { paddingHorizontal: 8, marginTop: 36 },
  stepsBox: { marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 18, paddingHorizontal: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 18 },
  stepText: { ...typography.body14Medium, lineHeight: 18, color: colors.textBody },
  checkCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: colors.onPrimary, fontSize: 11, lineHeight: 13, fontWeight: '700' },
  dashedCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textMuted },
  connector: { position: 'absolute', left: 8, top: -23, width: 2, height: 23, backgroundColor: colors.primary },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 3, marginTop: 16, paddingHorizontal: 12 },
  infoIcon: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.textDisabled, alignItems: 'center', justifyContent: 'center', marginTop: 2.5 },
  infoI: { fontSize: 8, lineHeight: 10, fontWeight: '700', color: colors.textDisabled },
  readyContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  quotaPill: { alignSelf: 'center', marginTop: 24, height: 23, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.primarySoft, justifyContent: 'center' },
  later: { alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
});