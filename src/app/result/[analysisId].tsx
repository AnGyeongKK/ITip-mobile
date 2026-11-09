// RESULT-SUMMARY / RESULT-MINDMAP / RESULT-DETAIL (피그마 11/06) · ANALYSIS-04
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import type { Analysis, ResultTab } from '@/api/types';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen } from '@/components/AppShell';
import { Mindmap } from '@/components/Mindmap';
import { PlayerModal } from '@/components/PlayerModal';
import { ChannelAvatar } from '@/components/VideoInfoCard';
import { Chip, EmptyView, ErrorView, LoadingView, OriginBadge } from '@/components/ui';
import { useAnalysis, useRecord, useSaveReadingPosition } from '@/hooks/queries';
import { formatDate, formatMs } from '@/lib/format';
import { agentForVideo } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

const TABS: { key: ResultTab; label: string }[] = [
  { key: 'SUMMARY', label: '요약' },
  { key: 'MINDMAP', label: '마인드맵' },
  { key: 'DETAIL', label: '상세 내용' },
];

export default function ResultScreen() {
  const { analysisId, tab: tabParam } = useLocalSearchParams<{ analysisId: string; tab?: ResultTab }>();
  const q = useAnalysis(analysisId);
  const record = useRecord(q.data?.recordId ?? '');
  const save = useSaveReadingPosition();
  const [tab, setTab] = useState<ResultTab>(tabParam ?? 'SUMMARY');
  const [agentOpen, setAgentOpen] = useState(false);
  const [playAt, setPlayAt] = useState<number | null>(null);

  // 처음 열었을 때 저장된 탭으로 이동 (파라미터가 없을 때만)
  useEffect(() => {
    if (!tabParam && record.data?.readingPosition.tab) setTab(record.data.readingPosition.tab);
  }, [record.data?.readingPosition.tab, tabParam]);

  const changeTab = (t: ResultTab) => {
    setTab(t);
    if (q.data) save.mutate({ recordId: q.data.recordId, tab: t, sectionId: null });
  };
  const openSection = (sectionId: string) => {
    if (q.data) save.mutate({ recordId: q.data.recordId, tab, sectionId });
    router.push({ pathname: '/section/[analysisId]/[sectionId]', params: { analysisId, sectionId } });
  };

  if (q.isPending) return <AppScreen><LoadingView /></AppScreen>;
  if (q.isError) {
    const notReady = q.error instanceof ApiError && q.error.code === 'ANALYSIS_NOT_READY';
    return (
      <AppScreen>
        {notReady
          ? <EmptyView title="아직 분석 중이에요" desc="분석이 끝나면 알림으로 알려드릴게요." />
          : <ErrorView error={q.error} onRetry={q.refetch} />}
      </AppScreen>
    );
  }
  const a = q.data;
  const summaryOnly = a.coverage === 'SUMMARY_ONLY';
  const selectedSectionId = record.data?.readingPosition.sectionId ?? null;

  return (
    <AppScreen onAgent={() => setAgentOpen(true)}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }} stickyHeaderIndices={[1]}>
        <View>
          <Text style={[font.title, { marginBottom: space.md }]}>분석 결과</Text>
          <View style={styles.videoCard}>
            <View style={styles.row}>
              <ChannelAvatar uri={a.video.channelImageUrl} size={40} />
              <View style={{ flex: 1, marginLeft: space.sm }}>
                <Text style={font.h3} numberOfLines={1}>{a.video.channelName}</Text>
                {a.video.publishedAt ? <Text style={font.caption}>{formatDate(a.video.publishedAt)}</Text> : null}
              </View>
              <Pressable style={styles.originBtn} onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${a.video.videoId}`)}>
                <Text style={styles.originBtnText}>원본 영상 보기 ↗</Text>
              </Pressable>
            </View>
            <Text style={[font.sub, { marginTop: space.sm }]} numberOfLines={2}>{a.video.title}</Text>
          </View>
          {summaryOnly ? (
            <View style={{ marginVertical: space.lg }}>
              <Text style={font.h2}>이 영상은 요약만 제공해요</Text>
              <Text style={[font.sub, { marginTop: space.xs }]}>ITip의 마인드맵과 상세 분석은 현재 IT 콘텐츠에 최적화되어 있어요. 다른 분야의 영상은 우선 핵심 요약만 제공하고 있어요.</Text>
              <View style={styles.coverage}>
                {[['요약', '제공'], ['마인드맵', 'IT 콘텐츠에서 지원'], ['상세 내용', 'IT 콘텐츠에서 지원']].map(([k, v]) => (
                  <View key={k} style={styles.rowBetween}><Text style={font.sub}>{k}</Text><Text style={[font.sub, k === '요약' && { fontWeight: '700', color: colors.text }]}>{v}</Text></View>
                ))}
              </View>
            </View>
          ) : (
            <View style={[styles.row, { marginVertical: space.lg }]}>
              <View style={styles.doneDot}><Text style={{ color: '#fff', fontSize: 12 }}>✓</Text></View>
              <Text style={[font.h3, { marginLeft: space.sm }]}>영상 정리가 끝났어요</Text>
            </View>
          )}
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => {
            const locked = summaryOnly && t.key !== 'SUMMARY';
            return (
              <Pressable key={t.key} disabled={locked} onPress={() => changeTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]}>
                <Text style={[font.body, tab === t.key ? { fontWeight: '700' } : { color: locked ? colors.textMuted : colors.textSub }]}>{t.label}</Text>
                {locked ? <Text style={[font.caption, { fontSize: 10 }]}>IT 콘텐츠에서 지원</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={{ paddingTop: space.lg }}>
          {tab === 'SUMMARY' || summaryOnly ? <SummaryTab a={a} onSection={openSection} /> : null}
          {!summaryOnly && tab === 'MINDMAP' ? <Mindmap analysis={a} onPressSection={openSection} /> : null}
          {!summaryOnly && tab === 'DETAIL' ? <DetailTab a={a} selectedId={selectedSectionId} onSection={openSection} onPlay={setPlayAt} /> : null}
        </View>
      </ScrollView>

      <PlayerModal videoId={a.video.videoId} startMs={playAt} title={a.video.title} onClose={() => setPlayAt(null)} />
      <AgentSheet visible={agentOpen} onClose={() => setAgentOpen(false)} context={agentForVideo(a.recordId, a.video.title)} />
    </AppScreen>
  );
}

function Bullets({ items }: { items: string[] }) {
  return <>{items.map((t, i) => <Text key={i} style={[font.body, { marginTop: space.xs }]}>• {t}</Text>)}</>;
}

function SummaryTab({ a, onSection }: { a: Analysis; onSection: (id: string) => void }) {
  const highlights = a.summary.highlightSectionIds.map((id) => a.sections.find((s) => s.sectionId === id)).filter(Boolean) as Analysis['sections'];
  return (
    <View style={styles.panel}>
      <Text style={font.h3}>한 줄 요약</Text>
      <Text style={[font.body, { marginTop: space.xs }]}>{a.summary.oneLine}</Text>

      {a.summary.keyPoints.length ? (<><Text style={[font.h3, styles.gap]}>핵심 포인트</Text><Bullets items={a.summary.keyPoints} /></>) : null}

      {a.summary.practicalPoints.length ? (
        <>
          <Text style={[font.h3, styles.gap]}>실무 적용 포인트</Text>
          {a.summary.practicalPoints.map((p, i) => (
            <View key={i} style={{ marginTop: space.xs }}>
              {p.origin === 'AI_SUGGESTION' ? <OriginBadge origin={p.origin} /> : null}
              <Text style={font.body}>• {p.text}</Text>
            </View>
          ))}
        </>
      ) : null}

      {/* 빈 도구 목록은 섹션째 숨김 */}
      {a.summary.mentionedTools.length ? (
        <>
          <Text style={[font.h3, styles.gap]}>소개된 기술 · 도구</Text>
          <View style={styles.wrap}>{a.summary.mentionedTools.map((t) => <Chip key={t.name} label={t.name} />)}</View>
        </>
      ) : null}

      {highlights.length ? (
        <>
          <Text style={[font.h3, styles.gap]}>주요 타임스탬프</Text>
          <Text style={[font.caption, { marginBottom: space.sm }]}>각 구간의 상세 내용으로 이동합니다</Text>
          {highlights.map((s) => (
            <Pressable key={s.sectionId} style={styles.tsCard} onPress={() => onSection(s.sectionId)}>
              <Text style={font.caption}>{formatMs(s.startMs)}</Text>
              <Text style={[font.body, { fontWeight: '700' }]}>{s.title}</Text>
              <Text style={font.caption}>구간 자세히 보기 ›</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      <View style={[styles.wrap, { marginTop: space.md }]}>
        {a.summary.keywords.map((k) => (
          <Chip key={k.keywordId} label={k.name} onPress={() => router.push({ pathname: '/archive/keywords/detail', params: { keywordIds: k.keywordId, label: k.name } })} />
        ))}
      </View>
    </View>
  );
}

function DetailTab({ a, selectedId, onSection, onPlay }: { a: Analysis; selectedId: string | null; onSection: (id: string) => void; onPlay: (ms: number) => void }) {
  return (
    <View>
      {a.sections.map((s, i) => (
        <View key={s.sectionId} style={[styles.detailCard, s.sectionId === selectedId && styles.detailSelected]}>
          <View style={styles.rowBetween}>
            <Text style={[font.sub, { fontWeight: '700' }]}>{String(i + 1).padStart(2, '0')}</Text>
            <View style={styles.row}>
              {s.sectionId === selectedId ? <View style={styles.selBadge}><Text style={font.caption}>선택한 구간</Text></View> : null}
              <Text style={font.caption}>{formatMs(s.startMs)}</Text>
            </View>
          </View>
          <Text style={[font.h3, { marginTop: space.sm }]}>{s.title}</Text>
          <Text style={[font.body, { marginTop: space.sm, color: colors.textSub }]}>{s.summary}</Text>
          <Pressable onPress={() => onPlay(s.startMs)} style={{ marginTop: space.md }}>
            <Text style={[font.caption, { color: colors.text, fontWeight: '600' }]}>{formatMs(s.startMs)}부터 원본 영상 보기 ↗</Text>
          </Pressable>
          <View style={styles.cardDivider} />
          <Pressable onPress={() => onSection(s.sectionId)}><Text style={[font.sub, { fontWeight: '700', color: colors.text }]}>구간 자세히 보기 ›</Text></Pressable>
        </View>
      ))}
      <Text style={font.caption}>↗ 원본 영상은 앱 안에서 재생돼요. 제공된 요약을 바탕으로 정리했어요. 자세한 내용은 원본에서 확인해 주세요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  videoCard: { padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  originBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  originBtnText: { color: colors.onPrimary, fontSize: 12, fontWeight: '600' },
  doneDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.text },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg },
  gap: { marginTop: space.xl },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  tsCard: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  detailCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginBottom: space.lg },
  detailSelected: { borderWidth: 1, borderColor: colors.textMuted, backgroundColor: colors.bg },
  selBadge: { backgroundColor: colors.surfaceStrong, borderRadius: radius.sm, paddingHorizontal: 6, marginRight: space.sm },
  coverage: { marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, gap: space.xs },
  cardDivider: { height: 1, backgroundColor: colors.border, marginVertical: space.md },
});
