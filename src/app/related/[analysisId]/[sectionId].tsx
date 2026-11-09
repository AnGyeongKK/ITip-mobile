// RELATED-VIDEO-AGENT (피그마 11/06) · ANALYSIS-06 구간 관련 영상 추천
// '이 영상도 분석하기'는 A의 분석 흐름으로 넘긴다 (자동 분석 아님)
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Recommendation } from '@/api/types';
import { VideoThumb } from '@/components/VideoInfoCard';
import { Button, EmptyView, ErrorView, LoadingView } from '@/components/ui';
import { useRecommendations, useSection } from '@/hooks/queries';
import { formatMs } from '@/lib/format';
import { startAnalysisFromVideo } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

export default function RelatedScreen() {
  const { analysisId, sectionId } = useLocalSearchParams<{ analysisId: string; sectionId: string }>();
  const section = useSection(analysisId, sectionId);
  const recs = useRecommendations(analysisId, sectionId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.head}>
        <Text style={font.h2}>ITip Agent</Text>
        <Pressable hitSlop={12} onPress={() => router.back()}><Text style={{ fontSize: 18, color: colors.textSub }}>✕</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}>
        {section.data ? (
          <View style={styles.scope}>
            <Text style={font.caption}>참고 중</Text>
            <Text style={[font.body, { fontWeight: '700' }]}>{formatMs(section.data.startMs)} · {section.data.title}</Text>
            <Text style={font.caption}>{section.data.video.title}</Text>
          </View>
        ) : null}
        <View style={[styles.scope, { marginTop: space.md }]}>
          <Text style={font.caption}>요청 · 나의 요청</Text>
          <Text style={font.body}>관련 영상 찾아보기</Text>
        </View>

        {recs.isPending || recs.data?.status === 'PENDING' ? (
          <LoadingView label="관련 영상을 찾고 있어요" />
        ) : recs.isError ? (
          // 추천 실패는 이 화면 안에서만 처리하고 분석 결과에는 영향 없음
          <ErrorView error={recs.error} onRetry={recs.refetch} />
        ) : recs.data.items.length === 0 ? (
          <EmptyView title="관련 영상을 찾지 못했어요" desc="다른 구간에서 다시 찾아보세요." />
        ) : (
          <>
            <Text style={[font.title, { marginTop: space.xl }]}>관련 영상을 찾았어요</Text>
            <Text style={[font.sub, { marginTop: space.xs, marginBottom: space.lg }]}>선택한 구간의 내용을 더 살펴볼 수 있는 영상이에요.</Text>
            {recs.data.items.map((v) => <RecCard key={v.videoId} v={v} />)}
            <Text style={font.caption}>'이 영상도 분석하기'는 분석 단계로 이동해요. 자동으로 분석되지 않아요.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecCard({ v }: { v: Recommendation }) {
  const unsupported = v.eligibility === 'INELIGIBLE';
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <VideoThumb video={{ videoId: v.videoId, title: v.title, channelName: v.channelName, thumbnailUrl: v.thumbnailUrl, durationMs: v.durationMs, channelImageUrl: null, publishedAt: null }} width={110} />
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={[font.sub, { fontWeight: '700', color: colors.text }]}>{v.channelName}</Text>
          <Text style={font.caption}>YouTube</Text>
        </View>
      </View>
      <Text style={[font.h3, { marginTop: space.md }]}>{v.title}</Text>
      <Text style={[font.sub, { marginTop: space.xs }]}>{v.reason}</Text>
      <Button
        title={unsupported ? '분석을 지원하지 않는 영상이에요' : '이 영상도 분석하기'}
        variant="secondary"
        disabled={unsupported}
        onPress={() => startAnalysisFromVideo(v.videoId)}
        style={{ marginTop: space.md }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.md },
  scope: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.lg, marginBottom: space.lg },
});
