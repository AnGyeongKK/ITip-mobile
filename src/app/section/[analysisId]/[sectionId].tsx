// SEGMENT-DETAIL (피그마 '디자인 확정 화면' 11/11) · ANALYSIS-05
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen } from '@/components/AppShell';
import { PlayerModal } from '@/components/PlayerModal';
import { Button, ErrorView, Icon, LoadingView, OriginBadge } from '@/components/ui';
import { RELATED_VIDEOS_ENABLED, useSaveReadingPosition, useSection } from '@/hooks/queries';
import { formatMs, formatRange } from '@/lib/format';
import { agentForSection } from '@/lib/handoff';
import { colors, radius, space, typography } from '@/theme/tokens';

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

  // 바로 들어온 경우(이어서 보기 등) 뒤로가기는 분석 결과로
  const goBack = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/result/[analysisId]', params: { analysisId } }));

  if (q.isPending) return <AppScreen back onBack={goBack}><LoadingView /></AppScreen>;
  if (q.isError) return <AppScreen back onBack={goBack}><ErrorView error={q.error} onRetry={q.refetch} /></AppScreen>;
  const s = q.data;
  const d = s.detail;
  const tips = [...d.applicationTips.filter((t) => t.origin === 'SOURCE'), ...d.applicationTips.filter((t) => t.origin === 'AI_SUGGESTION')];
  const hasTipBox = d.recommendedTools.length > 0 || d.usageKeywords.length > 0 || tips.length > 0;

  return (
    <AppScreen back onBack={goBack} onAgent={() => setAgentOpen(true)}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.head}>
          {/* 구간 시간: 누르면 이 구간부터 앱 안에서 재생 */}
          <Pressable onPress={() => setPlayAt(s.startMs)} style={styles.rangeChip} accessibilityRole="button" accessibilityLabel={`${formatMs(s.startMs)}부터 원본 영상 보기`}>
            <Text style={[typography.button12, { color: colors.primary }]}>{formatRange(s.startMs, s.endMs)}</Text>
          </Pressable>
          <Text style={typography.heading20}>{s.title}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.coreBox}>
            <Text style={[typography.body14Semibold, { color: colors.primaryDeep }]}>이 구간의 핵심</Text>
            <Text style={[typography.subtitle16Bold, { marginTop: 2 }]}>{d.takeaway}</Text>
            {d.explanation ? <Text style={[typography.body14Medium, { color: colors.textBody, marginTop: space.xs }]}>{d.explanation}</Text> : null}
          </View>

          {hasTipBox ? (
            <View style={styles.tipBox}>
              <Text style={typography.subtitle16Bold}>실무 적용 TIP</Text>

              {d.recommendedTools.length ? (
                <View style={{ gap: space.md }}>
                  <Text style={styles.label}>추천 툴</Text>
                  {d.recommendedTools.map((t) => (
                    <View key={t.name} style={styles.toolCard}>
                      <Text style={typography.body14Semibold}>{t.name}</Text>
                      {t.reason ? <Text style={[typography.body13Medium, { color: colors.textDisabled }]}>{t.reason}</Text> : null}
                    </View>
                  ))}
                  <Text style={[typography.caption12, { color: colors.textDisabled }]}>실무 적용을 위한 추천 툴이며, 원본 영상에서 사용한 툴로 확인된 것은 아니에요.</Text>
                </View>
              ) : null}

              {d.usageKeywords.length ? (
                <>
                  {d.recommendedTools.length ? <View style={styles.divider} /> : null}
                  <View style={{ gap: 6 }}>
                    <Text style={styles.label}>활용 키워드</Text>
                    <View style={styles.wrap}>
                      {d.usageKeywords.map((k) => (
                        <View key={k} style={styles.kwChip}><Text style={[typography.button12, { color: colors.icon }]}># {k}</Text></View>
                      ))}
                    </View>
                  </View>
                </>
              ) : null}

              {tips.length ? (
                <>
                  {d.recommendedTools.length || d.usageKeywords.length ? <View style={styles.divider} /> : null}
                  <View style={{ gap: space.md }}>
                    {tips.map((t, i) => (
                      <View key={i} style={styles.tipRow}>
                        <Icon source={require('../../../../assets/icons/tip-note.svg')} width={16} height={16} style={{ marginTop: 3 }} />
                        <View style={{ flex: 1, gap: 2 }}>
                          {/* [영상] / [AI 제안] 구분 (origin 필드) */}
                          <OriginBadge origin={t.origin} />
                          <Text style={typography.body14Medium}>{t.text}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </View>

        {d.examples.length ? (
          <View style={{ marginTop: space.xl }}>
            <Text style={styles.blockTitle}>이렇게 활용해 볼 수 있어요</Text>
            <View style={styles.exampleCard}>
              <Text style={[typography.body14Semibold, { color: colors.primaryDeep }]}>실무 적용 예시</Text>
              {d.examples.map((e, i) => (
                <View key={i} style={{ gap: space.xs }}>
                  <Text style={typography.body14Medium}>{e.text}</Text>
                  <Text style={[typography.caption12, { color: colors.textDisabled }]}>{e.origin === 'AI_SUGGESTION' ? '영상 속 발언이 아닌, 실습을 위한 예시예요.' : '영상에서 소개한 사례예요.'}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[typography.caption12, styles.disclaimer]}>제공된 영상 내용을 바탕으로 정리했어요. 실제 발언과 자세한 내용은 원본에서 확인해주세요.</Text>

        {RELATED_VIDEOS_ENABLED ? (
          <View style={styles.related}>
            <View style={{ paddingHorizontal: space.sm, gap: space.xs }}>
              <Text style={typography.subtitle16Bold}>관련 내용을 더 찾아볼까요?</Text>
              <Text style={[typography.body14Medium, { color: colors.textSub }]}>이 구간과 관련된 유익한 YouTube 영상을 찾아드려요.</Text>
            </View>
            {/* '2 Credits' 칩은 크레딧 정책이 API에 생기면 추가 */}
            <Button
              title="관련 영상 찾아보기"
              onPress={() => router.push({ pathname: '/related/[analysisId]/[sectionId]', params: { analysisId, sectionId } })}
              style={{ backgroundColor: colors.primaryStrong }}
            />
          </View>
        ) : null}
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
  head: { paddingHorizontal: space.xl, paddingVertical: space.md, gap: 6, alignItems: 'flex-start' },
  rangeChip: { borderWidth: 1, borderColor: colors.primaryLine, borderRadius: 20, paddingHorizontal: space.sm, paddingVertical: 2 },
  body: { paddingHorizontal: space.lg, gap: 20, marginTop: space.sm },
  coreBox: { backgroundColor: colors.primarySoft, borderRadius: radius.lg, paddingTop: space.md, paddingBottom: 20, paddingHorizontal: space.lg },
  tipBox: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingTop: space.lg, paddingBottom: space.xl, paddingHorizontal: space.lg, gap: 20 },
  label: { ...typography.body14Semibold, color: colors.textBody },
  toolCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: space.sm, alignItems: 'flex-start' },
  divider: { height: 1, backgroundColor: colors.divider },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  kwChip: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  blockTitle: { ...typography.subtitle16Bold, paddingHorizontal: space.xl, paddingVertical: 10 },
  exampleCard: { marginHorizontal: space.lg, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingTop: 20, paddingBottom: space.xl, paddingHorizontal: space.lg, gap: space.md },
  disclaimer: { color: colors.textMuted, paddingHorizontal: space.xl, marginTop: space.xl },
  related: { marginTop: space.xl, marginHorizontal: 14, gap: 14 },
});
