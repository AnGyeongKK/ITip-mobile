// RESULT-SUMMARY / RESULT-MINDMAP / RESULT-DETAIL (피그마 '디자인 확정 화면' 11/11) · ANALYSIS-04
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import type { Analysis, ResultTab } from '@/api/types';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen } from '@/components/AppShell';
import { Mindmap } from '@/components/Mindmap';
import { PlayerModal } from '@/components/PlayerModal';
import { VideoSummaryCard } from '@/components/VideoInfoCard';
import { EmptyView, ErrorView, Icon, LoadingView, OriginBadge, SectionTitle, Tag, TimeTag } from '@/components/ui';
import { useAnalysis, useRecord, useSaveReadingPosition } from '@/hooks/queries';
import { formatMs } from '@/lib/format';
import { agentForVideo } from '@/lib/handoff';
import { colors, radius, space, typography } from '@/theme/tokens';

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

  if (q.isPending) return <AppScreen back><LoadingView /></AppScreen>;
  if (q.isError) {
    const notReady = q.error instanceof ApiError && q.error.code === 'ANALYSIS_NOT_READY';
    return (
      <AppScreen back>
        {notReady
          ? <EmptyView title="아직 분석 중이에요" desc="분석이 끝나면 알림으로 알려드릴게요." />
          : <ErrorView error={q.error} onRetry={q.refetch} />}
      </AppScreen>
    );
  }
  const a = q.data;
  const summaryOnly = a.coverage === 'SUMMARY_ONLY';
  const selectedSectionId = record.data?.readingPosition.sectionId ?? null;
  const shownTab: ResultTab = summaryOnly ? 'SUMMARY' : tab;

  return (
    <AppScreen back onAgent={() => setAgentOpen(true)} agentExtended={shownTab === 'DETAIL'}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} stickyHeaderIndices={[1]}>
        <View>
          <Text style={styles.pageTitle}>분석 결과</Text>
          <View style={styles.side}>
            <VideoSummaryCard video={a.video} onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${a.video.videoId}`)} />
          </View>
          {summaryOnly ? (
            <View style={[styles.side, { marginTop: space.lg }]}>
              <Text style={typography.heading18}>이 영상은 요약만 제공해요</Text>
              <Text style={[typography.body13Medium, { marginTop: space.xs, color: colors.textSub }]}>ITip의 마인드맵과 상세 분석은 현재 IT 콘텐츠에 최적화되어 있어요. 다른 분야의 영상은 우선 핵심 요약만 제공하고 있어요.</Text>
              <View style={styles.coverage}>
                {[['요약', '제공'], ['마인드맵', 'IT 콘텐츠에서 지원'], ['상세 내용', 'IT 콘텐츠에서 지원']].map(([k, v]) => (
                  <View key={k} style={styles.rowBetween}>
                    <Text style={[typography.body13Medium, { color: colors.textSub }]}>{k}</Text>
                    <Text style={k === '요약' ? [typography.body14Semibold, { color: colors.primaryStrong }] : [typography.body13Medium, { color: colors.textSub }]}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.tabBar}>
          <View style={styles.tabs}>
            {TABS.map((t) => {
              const locked = summaryOnly && t.key !== 'SUMMARY';
              const on = shownTab === t.key;
              return (
                <Pressable key={t.key} disabled={locked} onPress={() => changeTab(t.key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on, disabled: locked }}>
                  <View style={styles.tabLabel}>
                    <Text style={on ? styles.tabTextOn : styles.tabText}>{t.label}</Text>
                    {locked ? <Text style={[typography.caption12, { fontSize: 10, lineHeight: 14, color: colors.textMuted }]}>IT 콘텐츠에서 지원</Text> : null}
                  </View>
                  <View style={[styles.tabLine, on && styles.tabLineOn]} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          {shownTab === 'SUMMARY' ? <SummaryTab a={a} onSection={openSection} /> : null}
          {shownTab === 'MINDMAP' ? <View style={{ paddingTop: 40 }}><Mindmap analysis={a} onPressSection={openSection} /></View> : null}
          {shownTab === 'DETAIL' ? <DetailTab a={a} selectedId={selectedSectionId} onSection={openSection} onPlay={setPlayAt} /> : null}
        </View>
      </ScrollView>

      <PlayerModal videoId={a.video.videoId} startMs={playAt} title={a.video.title} onClose={() => setPlayAt(null)} />
      <AgentSheet visible={agentOpen} onClose={() => setAgentOpen(false)} context={agentForVideo(a.recordId, a.video.title)} />
    </AppScreen>
  );
}

function SummaryTab({ a, onSection }: { a: Analysis; onSection: (id: string) => void }) {
  const highlights = a.summary.highlightSectionIds.map((id) => a.sections.find((s) => s.sectionId === id)).filter(Boolean) as Analysis['sections'];
  return (
    <View style={styles.summary}>
      <View style={styles.block}>
        <Text style={typography.subtitle16Bold}>한줄 요약</Text>
        <Text style={[typography.subtitle16Semibold, { marginTop: space.xs }]}>{a.summary.oneLine}</Text>
      </View>

      {a.summary.keyPoints.length ? (
        <View style={styles.block}>
          <SectionTitle>핵심 포인트</SectionTitle>
          <View style={{ gap: space.xs }}>
            {a.summary.keyPoints.map((t, i) => (
              <View key={i} style={styles.numRow}>
                <Text style={[typography.button12, styles.num]}>{i + 1}</Text>
                <Text style={[typography.body14Medium, { flex: 1 }]}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {a.summary.practicalPoints.length ? (
        <View style={styles.tipBox}>
          <SectionTitle>실무 적용 TIP</SectionTitle>
          <View style={{ gap: space.xs }}>
            {a.summary.practicalPoints.map((p, i) => (
              <View key={i} style={styles.tipRow}>
                <Icon source={require('../../../assets/icons/check.svg')} width={16} height={12} style={{ marginTop: 5 }} />
                <View style={{ flex: 1 }}>
                  {/* [AI 제안]은 영상 내용과 구분해서 표시 (origin 필드) */}
                  {p.origin === 'AI_SUGGESTION' ? <OriginBadge origin={p.origin} /> : null}
                  <Text style={typography.body14Medium}>{p.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 빈 도구 목록은 섹션째 숨김 */}
      {a.summary.mentionedTools.length ? (
        <View style={styles.block}>
          <SectionTitle>소개된 기술 · 도구</SectionTitle>
          <View style={[styles.wrap, { gap: space.sm }]}>{a.summary.mentionedTools.map((t) => <Tag key={t.name} label={t.name} />)}</View>
        </View>
      ) : null}

      {highlights.length ? (
        <View style={styles.tsBlock}>
          <View style={{ paddingHorizontal: space.sm }}>
            <SectionTitle desc="각 구간별 자세히 분석한 내용을 볼 수 있어요">주요 타임스탬프</SectionTitle>
          </View>
          <View style={{ gap: space.md }}>
            {highlights.map((s) => (
              <Pressable key={s.sectionId} style={({ pressed }) => [styles.tsCard, pressed && { opacity: 0.7 }]} onPress={() => onSection(s.sectionId)}>
                <View style={styles.tsLeft}>
                  <TimeTag label={formatMs(s.startMs)} />
                  <Text style={[typography.body14Semibold, { flexShrink: 1 }]} numberOfLines={1}>{s.title}</Text>
                </View>
                <View style={styles.moreBtn}>
                  <Text style={[typography.button12, { color: colors.textDisabled }]}>상세 내용</Text>
                  <Icon source={require('../../../assets/icons/chevron-small.svg')} width={9} height={9} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {a.summary.keywords.length ? (
        <View style={styles.block}>
          <SectionTitle>키워드</SectionTitle>
          <View style={[styles.wrap, { gap: 6 }]}>
            {a.summary.keywords.map((k) => (
              <Tag key={k.keywordId} variant="keyword" label={`# ${k.name}`} onPress={() => router.push({ pathname: '/archive/keywords/detail', params: { keywordIds: k.keywordId, label: k.name } })} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DetailTab({ a, selectedId, onSection, onPlay }: { a: Analysis; selectedId: string | null; onSection: (id: string) => void; onPlay: (ms: number) => void }) {
  return (
    <View style={styles.detail}>
      {a.sections.map((s, i) => (
        <View key={s.sectionId} style={[styles.detailCard, s.sectionId === selectedId && styles.detailSelected]}>
          <View style={{ gap: space.sm }}>
            <View style={{ gap: 2 }}>
              <View style={styles.rowBetweenTop}>
                <Text style={[typography.subtitle16Bold, { color: colors.textDisabled }]}>{String(i + 1).padStart(2, '0')}</Text>
                <TimeTag label={formatMs(s.startMs)} onPress={() => onPlay(s.startMs)} />
              </View>
              <Text style={typography.subtitle16Bold}>{s.title}</Text>
            </View>
            <Text style={[typography.body14Medium, { color: colors.textBody }]}>{s.summary}</Text>
          </View>
          {s.keywords.length ? (
            <View style={[styles.wrap, { gap: space.xs }]}>
              {s.keywords.map((k) => <Tag key={k.keywordId} variant="keywordOnTint" label={`# ${k.name}`} />)}
            </View>
          ) : null}
          <View style={styles.cardDivider} />
          <Pressable onPress={() => onSection(s.sectionId)} style={styles.rowBetween} hitSlop={8}>
            <Text style={[typography.button12, { color: colors.icon }]}>구간 자세히 보기</Text>
            <Icon source={require('../../../assets/icons/chevron-14.svg')} width={14} height={14} style={{ transform: [{ scaleX: -1 }] }} />
          </Pressable>
        </View>
      ))}
      <Text style={[typography.caption12, { color: colors.textMuted }]}>원본 영상은 앱 안에서 재생돼요. 제공된 요약을 바탕으로 정리했어요. 자세한 내용은 원본에서 확인해 주세요.</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  side: { paddingHorizontal: space.lg },
  pageTitle: { ...typography.heading20, paddingHorizontal: space.xl, paddingVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBetweenTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  coverage: { marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, gap: space.xs },
  tabBar: { backgroundColor: colors.bg, paddingTop: space.xxl, alignItems: 'center' },
  tabs: { flexDirection: 'row', width: '100%', paddingHorizontal: 16.5 },
  tab: { flex: 1 },
  tabLabel: { height: 44, alignItems: 'center', justifyContent: 'center' },
  tabText: { ...typography.body14Medium, color: colors.textMuted },
  tabTextOn: { ...typography.body14Bold, color: colors.textStrong },
  tabLine: { height: 2, backgroundColor: colors.divider },
  tabLineOn: { backgroundColor: colors.text },
  summary: { paddingTop: 18, gap: space.md, alignItems: 'stretch' },
  block: { paddingHorizontal: space.xl, paddingVertical: 10 },
  numRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  num: { color: colors.primaryStrong, lineHeight: 22 },
  tipBox: { marginHorizontal: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg, paddingTop: space.md, paddingBottom: 20, paddingHorizontal: space.lg },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tsBlock: { padding: 10, marginHorizontal: 6 },
  tsCard: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  tsLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 10, paddingRight: 6, paddingVertical: 4 },
  detail: { paddingTop: space.xxl, paddingHorizontal: space.lg, gap: 20 },
  detailCard: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingTop: space.md, paddingBottom: 20, paddingHorizontal: space.lg, gap: 10 },
  detailSelected: { backgroundColor: colors.primarySoft },
  cardDivider: { height: 1, backgroundColor: colors.border },
});
