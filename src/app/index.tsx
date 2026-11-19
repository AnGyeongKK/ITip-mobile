import { isBatchDone } from '@/api/intake';
import { AppScreen } from '@/components/AppShell';
import { IntakeError, type Issue } from '@/components/IntakeError';
import { ErrorView, LoadingView } from '@/components/ui';
import { useCollectStore } from '@/features/analysis/collectStore';
import { parseYoutubeUrl } from '@/features/analysis/parseYoutubeUrl';
import { useCaptionCollection } from '@/features/analysis/useCaptionCollection';
import { AnalyzingCard, LinkCard, NewBanner, RecentCard, SectionHeader, UsageSection } from '@/features/home/HomeSections';
import { useBatch } from '@/hooks/intakeQueries';
import { qk, useHome } from '@/hooks/queries';
import { useQuota } from '@/hooks/useQuota';
import { openResult } from '@/lib/handoff';
import { formatRange } from '@/lib/format';
import { colors, typography } from '@/theme/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const PASTE_MIN_CHARS = 8; // 한 번에 이만큼 늘어나면 붙여넣기로 보고 바로 확인 화면으로 간다

export default function Home() {
  const { sharedUrl, ts } = useLocalSearchParams<{ sharedUrl?: string; ts?: string }>();
  const qc = useQueryClient();
  const home = useHome();
  const quota = useQuota();
  const savedBatchId = useCollectStore((st) => (st.hydrated ? st.batchId : null));
  const savedBatch = useBatch(savedBatchId ?? '');
  const batch = savedBatch.data;

  // 홈에서도 기기 자막 수집을 이어간다(분석 하기 뒤 홈에서 기다려도 진행되도록)
  useCaptionCollection(batch);

  const done = !!batch && isBatchDone(batch);
  const analyzing = batch && !done ? batch : null;
  useEffect(() => {
    if (!done) return;
    qc.invalidateQueries({ queryKey: qk.home });
    qc.invalidateQueries({ queryKey: ['records'] });
    qc.invalidateQueries({ queryKey: ['quota'] });
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const [text, setText] = useState('');
  const [issue, setIssue] = useState<Issue | null>(null);
  const prevLen = useRef(0);

  const openLink = useCallback((raw: string) => {
    setIssue(null);
    const parsed = parseYoutubeUrl(raw);
    if (parsed.type === 'invalid') return setIssue({ code: 'INVALID_YOUTUBE_URL' });
    setText('');
    prevLen.current = 0;
    if (parsed.type === 'playlist') {
      return router.push({ pathname: '/playlist/[playlistId]', params: { playlistId: parsed.playlistId } });
    }
    router.push({ pathname: '/confirm', params: { url: raw.trim() } });
  }, []);

  const onChange = (t: string) => {
    const pasted = t.length - prevLen.current >= PASTE_MIN_CHARS;
    prevLen.current = t.length;
    setText(t);
    setIssue(null);
    if (pasted) openLink(t);
  };

  // 공유 받기 / "바로 분석하기"로 넘어온 링크는 바로 확인 화면으로 보낸다
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!sharedUrl) return;
    const key = `${sharedUrl}|${ts ?? ''}`;
    if (handled.current === key) return;
    handled.current = key;
    openLink(sharedUrl);
  }, [sharedUrl, ts, openLink]);

  const recent = home.data?.recentAnalyses ?? [];
  const hasNew = recent.some((r) => r.lastViewedAt == null);
  const cr = home.data?.continueReading;

  return (
    <AppScreen onAgent={() => router.push('/agent')}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <LinkCard value={text} onChange={onChange} onSubmit={() => openLink(text)} />
        <Text style={s.caption}>영상은 바로 분석, 재생목록은 분석할 영상을 선택해요.</Text>
        {issue ? <View style={{ marginTop: 12 }}><IntakeError issue={issue} onClose={() => setIssue(null)} /></View> : null}

        {analyzing && savedBatchId ? (
          <>
            <SectionHeader title="분석 중" marginTop={16} />
            <AnalyzingCard batch={analyzing} onPress={() => router.push({ pathname: '/analyze/[batchId]', params: { batchId: savedBatchId } })} />
          </>
        ) : null}

        {home.isPending ? <LoadingView /> : home.isError ? <ErrorView error={home.error} onRetry={home.refetch} /> : (
          <>
            {cr ? <Pressable style={s.continue} onPress={() => router.push({
              pathname: '/section/[analysisId]/[sectionId]', params: { analysisId: cr.analysisId, sectionId: cr.sectionId },
            })}>
              <Text style={typography.caption12}>이어서 보기 · {formatRange(cr.startMs, cr.endMs)}</Text>
              <Text style={typography.subtitle16Bold}>{cr.sectionTitle}</Text>
              <Text style={typography.body14Medium} numberOfLines={2}>{cr.sectionSummary}</Text>
            </Pressable> : null}
            <SectionHeader
              title="최근 분석"
              marginTop={analyzing ? 32 : 16}
              right={<Pressable onPress={() => router.push('/archive/records')} hitSlop={8}><Text style={s.seeAll}>전체 보기</Text></Pressable>}
            />
            {recent.length === 0 ? (
              <Text style={s.empty}>아직 분석한 영상이 없어요.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {hasNew ? <NewBanner /> : null}
                {recent.map((r) => <RecentCard key={r.recordId} item={r} onPress={() => openResult(r.analysisId)} />)}
              </View>
            )}
          </>
        )}

        {quota.data ? <UsageSection quota={quota.data} /> : null}
      </ScrollView>
    </AppScreen>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  caption: { ...typography.body14Medium, color: colors.textDisabled, marginTop: 8, paddingHorizontal: 8 },
  seeAll: { ...typography.body13Medium, color: colors.textDisabled },
  empty: { ...typography.body14Medium, color: colors.textDisabled, paddingHorizontal: 8 },
  continue: { padding: 16, borderRadius: 16, backgroundColor: colors.surface, marginTop: 16, gap: 4 },
});
