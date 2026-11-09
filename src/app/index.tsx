// ⚠️ 임시 홈: HOME-01은 A 파트 담당. A의 홈이 들어오면 이 파일을 A 코드로 교체한다.
// B 화면을 바로 확인할 수 있게 최근 분석(ARCHIVE-14)과 이어서 보기 카드만 보여준다.
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { USE_MOCK } from '@/api/client';
import { AppScreen } from '@/components/AppShell';
import { RecordCard } from '@/components/RecordCard';
import { ErrorView, LoadingView, SectionTitle } from '@/components/ui';
import { useHome } from '@/hooks/queries';
import { openResult } from '@/lib/handoff';
import { formatRange } from '@/lib/format';
import { colors, font, radius, space } from '@/theme/tokens';

export default function TempHome() {
  const { sharedUrl } = useLocalSearchParams<{ sharedUrl?: string }>();
  const home = useHome();

  return (
    <AppScreen onAgent={() => router.push('/agent')}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <View style={styles.notice}>
          <Text style={font.caption}>B 개발용 임시 홈{USE_MOCK ? ' · mock 데이터' : ''}</Text>
          <Text style={font.sub}>영상 추가·분석(HOME-01)은 A 파트 화면이 들어올 자리예요.</Text>
          {sharedUrl ? <Text style={[font.caption, { marginTop: 4 }]}>A로 넘길 링크: {sharedUrl}</Text> : null}
        </View>

        {home.isPending ? <LoadingView /> : home.isError ? <ErrorView error={home.error} onRetry={home.refetch} /> : (
          <>
            {home.data.continueReading ? (
              <Pressable
                style={styles.continue}
                onPress={() => router.push({ pathname: '/section/[analysisId]/[sectionId]', params: { analysisId: home.data.continueReading!.analysisId, sectionId: home.data.continueReading!.sectionId } })}
              >
                <Text style={font.caption}>이어서 보기 · {formatRange(home.data.continueReading.startMs, home.data.continueReading.endMs)}</Text>
                <Text style={font.h3}>{home.data.continueReading.sectionTitle}</Text>
                <Text style={font.sub} numberOfLines={2}>{home.data.continueReading.sectionSummary}</Text>
                <Text style={[font.caption, { marginTop: 4 }]}>실무 팁 {home.data.continueReading.practicalTipCount}개 · {home.data.continueReading.videoTitle}</Text>
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
  notice: { padding: space.md, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginBottom: space.lg },
  continue: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space.xl },
});
