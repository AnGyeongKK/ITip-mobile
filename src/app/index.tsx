import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '@/api/client';
import { formatDuration, getJob } from '@/api/intake';
import type { Video } from '@/api/types';
import { AppScreen } from '@/components/AppShell';
import { IntakeError, toIssue, type Issue } from '@/components/IntakeError';
import { RecordCard } from '@/components/RecordCard';
import { Button, ErrorView, LoadingView, SectionTitle } from '@/components/ui';
import { VideoInfoCard, VideoThumb } from '@/components/VideoInfoCard';
import { parseYoutubeUrl } from '@/features/analysis/parseYoutubeUrl';
import { useHome } from '@/hooks/queries';
import { useCreateBatch, useImportResource, useQuota } from '@/hooks/intakeQueries';
import { formatRange } from '@/lib/format';
import { openResult } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

type Candidate = { videoId: string; metadata: Video | null };

export default function Home() {
  const { sharedUrl, ts } = useLocalSearchParams<{ sharedUrl?: string; ts?: string }>();
  const home = useHome();
  const quota = useQuota();
  const importResource = useImportResource();
  const createBatch = useCreateBatch();

  const [text, setText] = useState('');
  const [issue, setIssue] = useState<Issue | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  const submit = useCallback(async (raw: string) => {
    setIssue(null);
    setCandidate(null);
    const parsed = parseYoutubeUrl(raw);
    if (parsed.type === 'invalid') return setIssue({ code: 'INVALID_YOUTUBE_URL' });
    if (parsed.type === 'playlist') {
      return router.push({ pathname: '/playlist/[playlistId]', params: { playlistId: parsed.playlistId } });
    }
    try {
      const r = await importResource.mutateAsync(raw.trim());
      if (r.type === 'PLAYLIST') {
        return router.push({ pathname: '/playlist/[playlistId]', params: { playlistId: r.playlistId } });
      }
      // 기존 결과가 있으면 결과로, 진행 중이면 작업의 배치 진행 화면으로
      if (r.existing.status === 'COMPLETED' && r.existing.analysisId) return openResult(r.existing.analysisId);
      if (r.existing.status === 'PROCESSING' && r.existing.jobId) {
        const job = await getJob(r.existing.jobId);
        return router.push({ pathname: '/analyze/[batchId]', params: { batchId: job.batchId } });
      }
      const d = r.metadata?.durationMs;
      if (d != null && d > r.captionRequirement.maxDurationMs) return setIssue({ code: 'DURATION_EXCEEDED' });
      setCandidate({ videoId: r.videoId, metadata: r.metadata });
    } catch (e) {
      setIssue(toIssue(e));
    }
  }, [importResource.mutateAsync]); // eslint-disable-line react-hooks/exhaustive-deps

  // 공유 받기 / "바로 분석하기"로 넘어온 링크는 자동으로 판별한다
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!sharedUrl) return;
    const key = `${sharedUrl}|${ts ?? ''}`;
    if (handled.current === key) return;
    handled.current = key;
    setText(sharedUrl);
    submit(sharedUrl);
  }, [sharedUrl, ts, submit]);

  const start = async () => {
    if (!candidate) return;
    try {
      const b = await createBatch.mutateAsync({ videoIds: [candidate.videoId] });
      router.push({ pathname: '/analyze/[batchId]', params: { batchId: b.batchId } });
    } catch (e) {
      if (e instanceof ApiError && e.isLimit) {
        quota.refetch();
        setIssue({ code: 'ANALYSIS_QUOTA_EXCEEDED' });
      } else {
        setIssue(toIssue(e));
      }
    }
  };

  const cr = home.data?.continueReading;
  const needMs = candidate?.metadata?.durationMs ?? null;
  return (
    <AppScreen onAgent={() => router.push('/agent')}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={font.title}>어떤 영상을 분석할까요?</Text>
        <TextInput
          value={text}
          onChangeText={(t) => { setText(t); setIssue(null); setCandidate(null); }}
          placeholder="YouTube 영상 또는 재생목록 링크"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
          onSubmitEditing={() => submit(text)}
        />
        <Button title="링크 확인" onPress={() => submit(text)} loading={importResource.isPending} disabled={!text.trim()} />

        {issue ? (
          <View style={{ marginTop: space.lg }}>
            <IntakeError issue={issue} remainingMs={quota.data?.remainingMs} neededMs={needMs} onClose={() => setIssue(null)} />
          </View>
        ) : null}

        {candidate ? (
          <View style={styles.preview}>
            {candidate.metadata ? (
              <>
                <VideoThumb video={candidate.metadata} width={160} />
                <View style={{ marginTop: space.sm }}><VideoInfoCard video={candidate.metadata} /></View>
              </>
            ) : (
              <Text style={font.sub}>영상 정보를 불러오지 못했어요. 한국어 자막 여부는 수집한 뒤에 확인돼요.</Text>
            )}
            {quota.data ? (
              <Text style={[font.caption, { marginTop: space.sm }]}>
                남은 분석 시간 {formatDuration(quota.data.remainingMs)}{needMs ? ` · 이 영상 ${formatDuration(needMs)}` : ''}
              </Text>
            ) : null}
            <Button title="이 영상 분석하기" onPress={start} loading={createBatch.isPending} style={{ marginTop: space.md }} />
          </View>
        ) : null}

        <View style={{ height: space.xl }} />
        {home.isPending ? <LoadingView /> : home.isError ? <ErrorView error={home.error} onRetry={home.refetch} /> : (
          <>
            {cr ? (
              <Pressable
                style={styles.continue}
                onPress={() => router.push({ pathname: '/section/[analysisId]/[sectionId]', params: { analysisId: cr.analysisId, sectionId: cr.sectionId } })}
              >
                <Text style={font.caption}>이어서 보기 · {formatRange(cr.startMs, cr.endMs)}</Text>
                <Text style={font.h3}>{cr.sectionTitle}</Text>
                <Text style={font.sub} numberOfLines={2}>{cr.sectionSummary}</Text>
                <Text style={[font.caption, { marginTop: 4 }]}>실무 팁 {cr.practicalTipCount}개 · {cr.videoTitle}</Text>
              </Pressable>
            ) : null}
            <SectionTitle right={<Pressable onPress={() => router.push('/archive/records')}><Text style={font.caption}>전체 보기 ›</Text></Pressable>}>최근 분석</SectionTitle>
            {home.data.recentAnalyses.map((r) => <RecordCard key={r.recordId} item={r} onPress={() => openResult(r.analysisId)} />)}
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  input: { marginVertical: space.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  preview: { marginTop: space.lg, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  continue: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space.xl },
});