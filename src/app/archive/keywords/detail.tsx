// KEYWORD-DETAIL / KEYWORD-AND / KEYWORD-AND-EMPTY / KEYWORD-MORE-SHEET / AGENT-KEYWORD (피그마 최종 디자인)
// 선택한 키워드(파란 칩 ✕) + 함께 등장한 키워드(+ 칩) + '+ 키워드 더보기' 시트. 2개 이상이면 교집합(AND)
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen } from '@/components/AppShell';
import { KeywordAddSheet } from '@/components/KeywordAddSheet';
import { KeywordChip } from '@/components/KeywordChips';
import { RecordList } from '@/components/RecordList';
import { EmptyState, Icon } from '@/components/ui';
import { useRecordKeywords } from '@/hooks/queries';
import { agentForKeywords } from '@/lib/handoff';
import { colors, space, typography } from '@/theme/tokens';

const SUGGEST = 3;

export default function KeywordDetailScreen() {
  const params = useLocalSearchParams<{ keywordIds: string; label?: string }>();
  const first = useMemo(() => (params.keywordIds ?? '').split(',').filter(Boolean), [params.keywordIds]);
  const [ids, setIds] = useState<string[]>(first);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const facets = useRecordKeywords({ keywordIds: ids });
  // '총 12개 중 7개'의 12: 처음 고른 키워드 하나만의 기록 수
  const base = useRecordKeywords({ keywordIds: ids.slice(0, 1) });
  // 선택된 키워드 이름은 facets 응답에서 찾고, 없으면 진입 시 받은 label 사용
  const nameOf = (id: string) => facets.data?.keywords.find((k) => k.keywordId === id)?.name ?? (id === first[0] ? params.label ?? id : id);
  const count = facets.data?.matchedCount ?? 0;
  const baseCount = base.data?.matchedCount ?? count;
  const candidates = (facets.data?.keywords ?? []).filter((k) => !ids.includes(k.keywordId) && k.recordCount > 0);
  const changed = ids.join(',') !== first.join(',');

  const remove = (id: string) => {
    if (ids.length <= 1) { router.back(); return; } // 마지막 키워드를 빼면 키워드 목록으로
    setIds((l) => l.filter((x) => x !== id));
  };

  const header = (
    <View>
      <View style={styles.titleRow}>
        <Text style={typography.heading20}>키워드</Text>
        {changed ? (
          <Pressable onPress={() => setIds(first)} hitSlop={8} style={styles.reset} accessibilityRole="button">
            <Icon source={require('../../../../assets/icons/reset.svg')} width={16} height={16} />
            <Text style={[typography.body14Medium, { color: colors.textStrong }]}>초기화</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chips}>
        {ids.map((id) => <KeywordChip key={id} kind="selected" label={nameOf(id)} removable onPress={() => remove(id)} />)}
        {candidates.slice(0, SUGGEST).map((k) => (
          <KeywordChip key={k.keywordId} kind="selectable" label={`+ ${k.name}`} onPress={() => setIds((l) => [...l, k.keywordId])} />
        ))}
        {candidates.length > SUGGEST ? <KeywordChip kind="more" label="+ 키워드 더보기" onPress={() => setSheetOpen(true)} /> : null}
      </View>

      <View style={styles.countRow}>
        <Text style={typography.subtitle18Semibold}>
          {ids.length > 1 ? (
            <>총 <Text style={styles.num}>{baseCount}</Text>개 중 <Text style={styles.num}>{count}</Text>개</>
          ) : (
            <>총 <Text style={styles.num}>{count}</Text>개 기록</>
          )}
        </Text>
        <Text style={[typography.body13Medium, { color: colors.textSub }]}>최신 분석순</Text>
      </View>
    </View>
  );

  return (
    <AppScreen back onAgent={() => setAgentOpen(true)} agentTone="archive" agentDisabled={facets.isSuccess && count === 0}>
      <RecordList
        query={{ keywordIds: ids }}
        header={header}
        empty={(
          <EmptyState
            icon={<Icon source={require('../../../../assets/icons/empty-search.svg')} width={96} height={96} />}
            title="일치하는 결과가 없어요"
            desc="영상을 분석하면 주요 키워드가 자동으로 모아져요."
          />
        )}
      />
      <KeywordAddSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedIds={ids}
        nameOf={nameOf}
        candidates={candidates}
        onApply={setIds}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.lg, paddingBottom: space.xxl },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.md },
  num: { color: colors.primary },
});
