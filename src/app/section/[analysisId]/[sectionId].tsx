// SEGMENT-DETAIL (피그마 11/06) · ANALYSIS-05
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen, Breadcrumb } from '@/components/AppShell';
import { PlayerModal } from '@/components/PlayerModal';
import { Button, Chip, ErrorView, LoadingView, OriginBadge } from '@/components/ui';
import { RELATED_VIDEOS_ENABLED, useSaveReadingPosition, useSection } from '@/hooks/queries';
import { formatDate, formatMs, formatRange } from '@/lib/format';
import { agentForSection } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

export default function SectionScreen() {
  const { analysisId, sectionId } = useLocalSearchParams<{ analysisId: string; sectionId: string }>();
  const q = useSection(analysisId, sectionId);
  const save = useSaveReadingPosition();
  const [agentOpen, setAgentOpen] = useState(false);
  const [playAt, setPlayAt] = useState<number | null>(null);

  // 이어서 보기용: 이 구간을 마지막 열람 위치로 저장
  useEffect(() => {
    if (q.data) save.mutate({ recordId: q.data.recordId, tab: 'DETAIL', sectionId: q.data.sectionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.sectionId]);

  if (q.isPending) return <AppScreen><LoadingView /></AppScreen>;
  if (q.isError) return <AppScreen><ErrorView error={q.error} onRetry={q.refetch} /></AppScreen>;
  const s = q.data;
  const d = s.detail;
  const sourceTips = d.applicationTips.filter((t) => t.origin === 'SOURCE');
  const aiTips = d.applicationTips.filter((t) => t.origin === 'AI_SUGGESTION');

  return (
    <AppScreen onAgent={() => setAgentOpen(true)}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <Breadcrumb
          label="‹ 분석 결과로 돌아가기"
          onPress={() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/result/[analysisId]', params: { analysisId } }))}
        />
        <Text style={[font.caption, { marginTop: space.sm }]}>{formatRange(s.startMs, s.endMs)} · 구간 요약</Text>
        <Text style={[font.title, { marginTop: space.xs }]}>{s.title}</Text>

        <View style={[styles.rowBetween, { marginTop: space.lg }]}>
          <Text style={[font.sub, { fontWeight: '700', color: colors.text }]}>{s.video.channelName}</Text>
          <Text style={font.caption}>{formatDate(s.video.publishedAt)}</Text>
        </View>
        <Text style={[font.sub, { marginTop: 2 }]}>{s.videoOneLine}</Text>

        <View style={styles.panel}>
          <Text style={font.h3}>이 구간의 핵심</Text>
          <Text style={[font.body, { fontWeight: '700', marginTop: space.sm }]}>{d.takeaway}</Text>
          <Text style={[font.sub, { marginTop: space.xs }]}>{d.explanation}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={font.h3}>실무 적용 팁</Text>
          {d.recommendedTools.length ? (
            <>
              <Text style={[font.sub, styles.label]}>추천 툴</Text>
              {d.recommendedTools.map((t) => <Text key={t.name} style={[font.body, { marginTop: 4 }]}>{t.name} — {t.reason}</Text>)}
              <Text style={[font.caption, { marginTop: space.xs }]}>실무 적용을 위한 추천 툴이며, 원본 영상에서 사용한 툴로 확인된 것은 아니에요.</Text>
            </>
          ) : null}
          {d.usageKeywords.length ? (
            <>
              <Text style={[font.sub, styles.label]}>활용 키워드</Text>
              <View style={styles.wrap}>{d.usageKeywords.map((k) => <Chip key={k} label={k} />)}</View>
            </>
          ) : null}
          {[...sourceTips, ...aiTips].map((t, i) => (
            <View key={i} style={{ marginTop: space.md }}>
              <OriginBadge origin={t.origin} />
              <Text style={[font.body, { marginTop: 4 }]}>{t.text}</Text>
            </View>
          ))}
        </View>

        {d.examples.length ? (
          <>
            <Text style={[font.h2, { marginTop: space.xl }]}>이렇게 활용해볼 수 있어요</Text>
            <View style={styles.example}>
              <Text style={[font.sub, { fontWeight: '700', color: colors.text }]}>실무 적용 예시</Text>
              {d.examples.map((e, i) => (
                <View key={i} style={{ marginTop: space.sm }}>
                  <Text style={font.body}>{e.text}</Text>
                  <Text style={font.caption}>{e.origin === 'AI_SUGGESTION' ? '영상 속 발언이 아닌, 실습을 위한 예시예요.' : '영상에서 소개한 사례예요.'}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[font.caption, { marginTop: space.xl }]}>YouTube · 원본 영상의 {formatMs(s.startMs)} 구간</Text>
        <Button title={`${formatMs(s.startMs)}부터 원본 영상 보기 ↗`} variant="secondary" onPress={() => setPlayAt(s.startMs)} style={{ marginTop: space.sm }} />
        <Text style={[font.caption, { marginTop: space.sm }]}>제공된 영상 내용을 바탕으로 정리했어요. 실제 발언과 자세한 내용은 원본에서 확인해주세요.</Text>

        {RELATED_VIDEOS_ENABLED ? <>
        <Text style={[font.h2, { marginTop: space.xl }]}>관련 내용을 더 찾아볼까요?</Text>
        <Text style={[font.sub, { marginTop: space.xs }]}>ITip Agent가 이 구간과 관련된 YouTube 영상을 찾아드려요.</Text>
        <Pressable
          style={styles.related}
          onPress={() => router.push({ pathname: '/related/[analysisId]/[sectionId]', params: { analysisId, sectionId } })}
        >
          {/* TODO: '· 2 Credits' 표시는 크레딧 정책이 API에 생기면 추가 */}
          <Text style={font.h3}>관련 영상 찾아보기</Text>
          <Text style={{ fontSize: 18, color: colors.textSub }}>›</Text>
        </Pressable>
        </> : null}
      </ScrollView>

      <PlayerModal videoId={s.videoId} startMs={playAt} title={s.title} onClose={() => setPlayAt(null)} />
      <AgentSheet
        visible={agentOpen}
        onClose={() => setAgentOpen(false)}
        context={agentForSection(s.recordId, s.sectionId, `${formatMs(s.startMs)} · ${s.title}`, s.video.title, formatRange(s.startMs, s.endMs))}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginTop: space.lg },
  label: { fontWeight: '700', color: colors.text, marginTop: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  example: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.lg, marginTop: space.md },
  related: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, marginTop: space.md },
});
