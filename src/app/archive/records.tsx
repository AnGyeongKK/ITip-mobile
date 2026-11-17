// ARCHIVE-RECORDS / ARCHIVE-RECORDS-EMPTY (피그마 최종 디자인) · SEARCH-01 · 기록을 길게 누르면 삭제 (HISTORY-DELETE)
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen, Breadcrumb } from '@/components/AppShell';
import { RecordList } from '@/components/RecordList';
import { EmptyState, Icon, SearchBar } from '@/components/ui';
import { useRecords } from '@/hooks/queries';
import { useDebounced } from '@/hooks/useDebounced';
import { agentForAll } from '@/lib/handoff';
import { colors, space, typography } from '@/theme/tokens';

export default function RecordsScreen() {
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const [agentOpen, setAgentOpen] = useState(false);
  // 기록이 하나도 없으면 Agent 버튼을 흐리게 (목록과 같은 조회라 캐시를 같이 쓴다)
  const all = useRecords({ q: undefined });
  const noRecords = all.isSuccess && (all.data.pages[0]?.items.length ?? 0) === 0;

  return (
    <AppScreen onAgent={() => setAgentOpen(true)} agentTone="archive" agentDisabled={noRecords}>
      <RecordList
        query={{ q: q || undefined }}
        header={
          <View style={styles.header}>
            <Breadcrumb label="내 아카이브  >  분석 기록" onPress={() => {}} />
            <Text style={typography.heading20}>분석 기록</Text>
            <Text style={[typography.body14Medium, { color: colors.textBody }]}>분석한 영상이 자동으로 기록돼요.</Text>
            <SearchBar value={text} onChangeText={setText} placeholder="분석 기록 검색" />
            {noRecords && !q ? null : (
              <View>
                <Text style={typography.subtitle16Bold}>{q ? '검색 결과' : '전체 분석 기록'}</Text>
                <Text style={[typography.body13Medium, { color: colors.textSub, marginTop: space.md }]}>최신 분석순</Text>
              </View>
            )}
          </View>
        }
        empty={q
          ? <EmptyState title="검색 결과가 없어요" desc="검색어를 바꿔 보세요. 요약·마인드맵 내용까지 찾아요." />
          : (
            <EmptyState
              icon={<Icon source={require('../../../assets/icons/empty-video.svg')} width={96} height={96} />}
              title="아직 분석한 영상이 없어요"
              desc="영상을 분석하면 여기에 자동으로 기록돼요."
              actionTitle="영상 분석하기"
              onAction={() => router.navigate('/')}
            />
          )}
        footer={() => '날짜는 분석일 기준이에요.'}
      />
      <AgentSheet visible={agentOpen} onClose={() => setAgentOpen(false)} context={agentForAll()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md, marginBottom: space.md },
});
