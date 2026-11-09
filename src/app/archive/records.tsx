// ARCHIVE-RECORDS (피그마 11/06) · SEARCH-01 · 기록을 길게 누르면 삭제 (HISTORY-DELETE)
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen, Breadcrumb } from '@/components/AppShell';
import { RecordList } from '@/components/RecordList';
import { EmptyView } from '@/components/ui';
import { useDebounced } from '@/hooks/useDebounced';
import { agentForAll } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

export default function RecordsScreen() {
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const [agentOpen, setAgentOpen] = useState(false);

  return (
    <AppScreen onAgent={() => setAgentOpen(true)}>
      <RecordList
        query={{ q: q || undefined }}
        header={
          <View style={{ marginBottom: space.lg }}>
            <Breadcrumb label="내 아카이브 > 분석 기록" onPress={() => {}} />
            <Text style={[font.title, { marginTop: space.sm }]}>분석 기록</Text>
            <Text style={[font.sub, { marginTop: space.xs }]}>분석한 영상이 자동으로 기록돼요.</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="분석 기록 검색"
              placeholderTextColor={colors.textMuted}
              style={styles.search}
              returnKeyType="search"
            />
            <View style={styles.listHead}>
              <Text style={font.h3}>{q ? '검색 결과' : '전체 분석 기록'}</Text>
              <Text style={font.caption}>최신 분석순</Text>
            </View>
          </View>
        }
        empty={q
          ? <EmptyView title="검색 결과가 없어요" desc="검색어를 바꿔 보세요. 요약·마인드맵 내용까지 찾아요." />
          : <EmptyView title="아직 분석한 영상이 없어요" desc="영상을 추가하면 분석 기록이 자동으로 쌓여요." />}
        footer={() => '날짜는 분석일 기준이에요. 기록을 길게 누르면 삭제할 수 있어요.'}
      />
      <AgentSheet visible={agentOpen} onClose={() => setAgentOpen(false)} context={agentForAll()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: space.lg, height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl },
});
