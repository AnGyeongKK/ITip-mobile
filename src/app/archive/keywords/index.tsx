// KEYWORD-01 / KEYWORD-EMPTY (피그마 11/06) · SEARCH-02 (범위 없이 전체 기록의 키워드)
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen, Breadcrumb } from '@/components/AppShell';
import { Button, EmptyView, ErrorView, LoadingView } from '@/components/ui';
import { useRecordKeywords } from '@/hooks/queries';
import { agentForAll } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

const TOP = 6;

export default function KeywordsScreen() {
  const q = useRecordKeywords({});
  const [text, setText] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const list = useMemo(() => {
    const all = [...(q.data?.keywords ?? [])].sort((a, b) => b.recordCount - a.recordCount);
    const t = text.trim().toLowerCase();
    const filtered = t ? all.filter((k) => k.name.toLowerCase().includes(t)) : all;
    return showAll || t ? filtered : filtered.slice(0, TOP);
  }, [q.data, text, showAll]);

  return (
    <AppScreen onAgent={() => setAgentOpen(true)}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
        <Breadcrumb label="내 아카이브 > 키워드" onPress={() => {}} />
        <Text style={[font.title, { marginTop: space.sm }]}>키워드</Text>
        <Text style={[font.sub, { marginTop: space.xs }]}>분석한 영상에서 자주 등장한 주제를 모았어요.</Text>
        <TextInput value={text} onChangeText={setText} placeholder="키워드 검색" placeholderTextColor={colors.textMuted} style={styles.search} />

        {q.isPending ? <LoadingView /> : q.isError ? <ErrorView error={q.error} onRetry={q.refetch} /> : list.length === 0 ? (
          <EmptyView title={text ? '찾는 키워드가 없어요' : '아직 키워드가 없어요'} desc="키워드는 영상 분석 후 자동으로 모아져요." />
        ) : (
          <>
            <Text style={[font.h3, { marginTop: space.xl, marginBottom: space.md }]}>{text ? '검색 결과' : showAll ? '전체 키워드' : '자주 등장한 키워드'}</Text>
            <View style={styles.grid}>
              {list.map((k) => (
                <Pressable
                  key={k.keywordId}
                  style={styles.cell}
                  onPress={() => router.push({ pathname: '/archive/keywords/detail', params: { keywordIds: k.keywordId, label: k.name } })}
                >
                  <View style={styles.cellHead}>
                    <Text style={[font.h3, { flex: 1 }]} numberOfLines={1}>{k.name}</Text>
                    <Text style={{ color: colors.textSub }}>›</Text>
                  </View>
                  <Text style={[font.caption, { marginTop: space.sm }]}>{k.recordCount}개 기록</Text>
                </Pressable>
              ))}
            </View>
            {!text && (q.data?.keywords.length ?? 0) > TOP ? (
              <Button title={showAll ? '자주 등장한 키워드만 보기' : '전체 키워드 보기'} variant="secondary" onPress={() => setShowAll((v) => !v)} style={{ marginTop: space.md }} />
            ) : null}
            <Text style={[font.caption, { marginTop: space.lg }]}>키워드는 영상 분석 후 자동으로 모아져요.</Text>
          </>
        )}
      </ScrollView>
      <AgentSheet visible={agentOpen} onClose={() => setAgentOpen(false)} context={agentForAll()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: space.lg, height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 15, color: colors.text, backgroundColor: colors.surface },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: { width: '48.5%', minHeight: 96, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space.md },
  cellHead: { flexDirection: 'row', alignItems: 'center' },
});
