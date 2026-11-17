// FOLDER-DETAIL / AGENT-FOLDER (피그마 최종 디자인)
// ARCHIVE-07 + SEARCH-01(folderId) + SEARCH-02(키워드 AND) + 폴더 이름 변경·삭제
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen } from '@/components/AppShell';
import { FolderNameModal } from '@/components/FolderNameModal';
import { RecordList } from '@/components/RecordList';
import { Chip, EmptyState, ErrorView, LoadingView, SearchBar, TextButton } from '@/components/ui';
import { useDeleteFolder, useFolder, useRecordKeywords } from '@/hooks/queries';
import { useDebounced } from '@/hooks/useDebounced';
import { agentForFolder } from '@/lib/handoff';
import { colors, space, typography } from '@/theme/tokens';

export default function FolderDetailScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const folder = useFolder(folderId);
  const del = useDeleteFolder();
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const [keywordIds, setKeywordIds] = useState<string[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const facets = useRecordKeywords({ folderId, q: q || undefined, keywordIds });

  if (folder.isPending) return <AppScreen back><LoadingView /></AppScreen>;
  if (folder.isError) return <AppScreen back><ErrorView error={folder.error} onRetry={folder.refetch} /></AppScreen>;
  const f = folder.data;
  const name = f.name;
  const filtered = !!q || keywordIds.length > 0;
  const toggleKw = (id: string) => setKeywordIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const addRecords = () => router.push({ pathname: '/archive/folders/[folderId]/add', params: { folderId } });

  const more = () =>
    Alert.alert(name, undefined, [
      { text: '취소', style: 'cancel' },
      { text: '이름 바꾸기', onPress: () => setRenaming(true) },
      {
        text: '폴더 삭제',
        style: 'destructive',
        onPress: () => Alert.alert('폴더를 삭제할까요?', '폴더만 삭제되고, 안에 있던 분석 기록은 그대로 남아요.', [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: async () => { await del.mutateAsync(folderId); router.back(); } },
        ]),
      },
    ]);

  const header = (
    <View style={styles.header}>
      <Text style={[typography.body13Medium, { color: colors.textSub }]}>폴더</Text>
      <View style={styles.titleRow}>
        <Text style={[typography.heading20, { flex: 1 }]} numberOfLines={1}>{name}</Text>
        {/* 이름 바꾸기·삭제 (디자인에는 없지만 기존 기능 유지) */}
        <Pressable hitSlop={12} onPress={more} accessibilityLabel="폴더 메뉴"><Text style={styles.more}>⋯</Text></Pressable>
      </View>
      <Text style={[typography.body14Medium, { color: colors.textBody }]}>{f.recordCount}개 기록</Text>
      <View style={styles.searchRow}>
        <SearchBar value={text} onChangeText={setText} placeholder="검색" style={{ flex: 1 }} />
        <TextButton title="기록 추가" onPress={addRecords} />
      </View>

      {/* 검색하거나 키워드를 고른 뒤에만 관련 키워드를 보여준다 (상위 7개) */}
      {filtered && facets.data?.keywords.length ? (
        <View>
          <View style={styles.rowBetween}>
            <Text style={[typography.body13Medium, { color: colors.textSub }]}>관련 키워드</Text>
            {keywordIds.length ? <TextButton title="초기화" onPress={() => setKeywordIds([])} /> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.sm }}>
            {facets.data.keywords.slice(0, 7).map((k) => (
              <Chip key={k.keywordId} label={k.name} count={k.recordCount} selected={keywordIds.includes(k.keywordId)} onPress={() => toggleKw(k.keywordId)} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <Text style={[typography.body13Medium, { color: colors.textSub }]}>최신 분석순 · 기록을 누르면 분석 결과로 이동해요</Text>
    </View>
  );

  return (
    <AppScreen back onAgent={() => setAgentOpen(true)} agentTone="archive" agentDisabled={f.recordCount === 0}>
      <RecordList
        query={{ folderId, q: q || undefined, keywordIds }}
        header={header}
        empty={filtered
          ? <EmptyState title="조건에 맞는 기록이 없어요" desc="키워드를 하나 빼거나 필터를 초기화해 보세요." actionTitle="필터 초기화" onAction={() => { setKeywordIds([]); setText(''); }} />
          : <EmptyState title="아직 추가된 기록이 없어요" desc="분석 기록을 이 폴더에 모아 보세요." actionTitle="기록 추가" onAction={addRecords} />}
        footer={(matched, shown) => `${matched}개 중 ${shown}개 기록`}
      />
      <FolderNameModal visible={renaming} editing={f} onClose={() => setRenaming(false)} />
      <AgentSheet visible={agentOpen} onClose={() => setAgentOpen(false)} context={agentForFolder(folderId, name, f.recordCount)} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md, marginBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  more: { fontSize: 20, color: colors.icon },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
