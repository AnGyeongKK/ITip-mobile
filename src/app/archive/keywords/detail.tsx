// KEYWORD-DETAIL / KEYWORD-AND / KEYWORD-AND-EMPTY / AGENT-KEYWORD (피그마 11/06)
// 키워드 1개 → '# RAG' + 함께 등장한 키워드 / 2개 이상 → 'RAG + LLM' 교집합(AND)
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen, Breadcrumb } from '@/components/AppShell';
import { RecordList } from '@/components/RecordList';
import { Button, Chip, EmptyView } from '@/components/ui';
import { useRecordKeywords } from '@/hooks/queries';
import { agentForKeywords } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

export default function KeywordDetailScreen() {
  const params = useLocalSearchParams<{ keywordIds: string; label?: string }>();
  const first = useMemo(() => (params.keywordIds ?? '').split(',').filter(Boolean), [params.keywordIds]);
  const [ids, setIds] = useState<string[]>(first);
  const [agentOpen, setAgentOpen] = useState(false);
  const facets = useRecordKeywords({ keywordIds: ids });
  // 선택된 키워드 이름은 facets 응답에서 찾고, 없으면 진입 시 받은 label 사용
  const nameOf = (id: string) => facets.data?.keywords.find((k) => k.keywordId === id)?.name ?? (id === first[0] ? params.label ?? id : id);
  const title = ids.length <= 1 ? `# ${nameOf(ids[0] ?? '')}` : ids.map(nameOf).join(' + ');
  const count = facets.data?.matchedCount ?? 0;
  const related = (facets.data?.keywords ?? []).filter((k) => !ids.includes(k.keywordId) && k.recordCount > 0).slice(0, 6);

  const header = (
    <View style={{ marginBottom: space.lg }}>
      <Breadcrumb label="‹ 키워드" />
      <Text style={[font.title, { marginTop: space.sm }]}>{title}</Text>
      <Text style={[font.sub, { marginTop: space.xs }]}>{count}개 분석 기록</Text>

      {ids.length > 1 ? (
        <>
          <View style={styles.rowBetween}>
            <Text style={font.sub}>선택한 키워드</Text>
            <Pressable onPress={() => setIds(first.slice(0, 1))}><Text style={font.caption}>초기화</Text></Pressable>
          </View>
          <View style={styles.wrap}>
            {ids.map((id) => (
              <Pressable key={id} style={styles.selected} onPress={() => setIds((l) => (l.length > 1 ? l.filter((x) => x !== id) : l))}>
                <Text style={[font.sub, { color: colors.text, fontWeight: '600' }]}>{nameOf(id)}  ✕</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {related.length ? (
        <>
          <Text style={[font.sub, { fontWeight: '700', color: colors.text, marginTop: space.lg }]}>{ids.length > 1 ? '키워드 더 선택' : '함께 등장한 키워드'}</Text>
          <View style={[styles.wrap, { marginTop: space.sm }]}>
            {related.map((k) => <Chip key={k.keywordId} label={k.name} onPress={() => setIds((l) => [...l, k.keywordId])} />)}
          </View>
          <Text style={font.caption}>키워드를 더 선택하면 함께 포함된 기록만 보여요.</Text>
        </>
      ) : null}
    </View>
  );

  return (
    <AppScreen onAgent={() => setAgentOpen(true)}>
      <RecordList
        query={{ keywordIds: ids }}
        header={header}
        empty={<EmptyView title="모두 포함한 기록이 없어요" desc="키워드를 하나 빼 보세요." action={<Button title="키워드 하나 빼기" variant="secondary" onPress={() => setIds((l) => l.slice(0, -1))} />} />}
        footer={(matched, shown) => `${matched}개 중 ${shown}개 기록 · ${ids.length > 1 ? `${ids.map(nameOf).join('와 ')}를 모두 포함해요.` : '최신 분석순'}`}
      />
      <AgentSheet
        visible={agentOpen}
        onClose={() => setAgentOpen(false)}
        context={agentForKeywords(ids, ids.map(nameOf).join(' + '), count)}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  selected: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.surfaceStrong, marginRight: space.sm, marginTop: space.sm },
});
