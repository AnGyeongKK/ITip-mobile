// KEYWORD-01 / KEYWORD-EMPTY (피그마 최종 디자인) · SEARCH-02 (범위 없이 전체 기록의 키워드)
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen, Breadcrumb } from '@/components/AppShell';
import { KeywordEmptyIcon } from '@/components/KeywordChips';
import { Button, EmptyState, ErrorView, Icon, LoadingView, SearchBar } from '@/components/ui';
import { useRecordKeywords } from '@/hooks/queries';
import { agentForAll } from '@/lib/handoff';
import { colors, radius, space, typography } from '@/theme/tokens';

const TOP = 6;

export default function KeywordsScreen() {
  const q = useRecordKeywords({});
  const [text, setText] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const total = q.data?.keywords.length ?? 0;
  const noKeywords = q.isSuccess && total === 0;

  const list = useMemo(() => {
    const all = [...(q.data?.keywords ?? [])].sort((a, b) => b.recordCount - a.recordCount);
    const t = text.trim().toLowerCase();
    const filtered = t ? all.filter((k) => k.name.toLowerCase().includes(t)) : all;
    return showAll || t ? filtered : filtered.slice(0, TOP);
  }, [q.data, text, showAll]);

  return (
    <AppScreen onAgent={() => setAgentOpen(true)} agentTone="archive" agentDisabled={noKeywords}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <View style={{ gap: space.md }}>
              <Breadcrumb label="내 아카이브  >  키워드" onPress={() => {}} />
              <Text style={typography.heading20}>키워드</Text>
            </View>
            <Text style={[typography.body14Medium, { color: colors.textBody }]}>분석한 영상에서 자주 등장한 주제를 모았어요.</Text>
          </View>
          <SearchBar value={text} onChangeText={setText} placeholder="키워드 검색" />
        </View>

        {q.isPending ? <LoadingView /> : q.isError ? <ErrorView error={q.error} onRetry={q.refetch} /> : noKeywords ? (
          <EmptyState
            icon={<KeywordEmptyIcon />}
            title="아직 모아진 키워드가 없어요"
            desc="영상을 분석하면 주요 키워드가 자동으로 모아져요."
            actionTitle="영상 분석하기"
            onAction={() => router.navigate('/')}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Icon source={require('../../../../assets/icons/empty-search.svg')} width={96} height={96} />}
            title="찾는 키워드가 없어요"
            desc="키워드는 영상 분석 후 자동으로 모아져요."
          />
        ) : (
          <>
            <View style={{ gap: 20 }}>
              <Text style={typography.subtitle16Bold}>{text ? '검색 결과' : showAll ? '전체 키워드' : '자주 등장한 키워드'}</Text>
              <View style={{ gap: 14 }}>
                {list.map((k) => (
                  <Pressable
                    key={k.keywordId}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push({ pathname: '/archive/keywords/detail', params: { keywordIds: k.keywordId, label: k.name } })}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={typography.body14Semibold} numberOfLines={1}>{k.name}</Text>
                      <Text style={[typography.body14Medium, { color: colors.textBody }]}>{k.recordCount}개 기록</Text>
                    </View>
                    <Icon source={require('../../../../assets/icons/chevron-source.svg')} width={19} height={18} style={{ transform: [{ scaleX: -1 }] }} />
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ gap: space.sm }}>
              <Text style={[typography.body13Medium, { color: colors.textSub, textAlign: 'center' }]}>키워드는 영상 분석 후 자동으로 모아져요.</Text>
              {!text && total > TOP ? (
                <Button title={showAll ? '자주 등장한 키워드만 보기' : '전체 키워드 보기'} onPress={() => setShowAll((v) => !v)} />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
      <AgentSheet visible={agentOpen} onClose={() => setAgentOpen(false)} context={agentForAll()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: 120, gap: space.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.lg, paddingRight: space.md, paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
});
