// FOLDER-DETAIL / ARCHIVE-RECORDS-EMPTY / AGENT-FOLDER (피그마 11/06)
// ARCHIVE-07 + SEARCH-01(folderId) + SEARCH-02(키워드 AND) + 폴더 이름 변경·삭제
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { displayFolderName } from '@/api/archive';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen, Breadcrumb } from '@/components/AppShell';
import { FolderNameModal } from '@/components/FolderNameModal';
import { RecordList } from '@/components/RecordList';
import { Button, Chip, EmptyView, ErrorView, LoadingView } from '@/components/ui';
import { useDeleteFolder, useFolder, useRecordKeywords } from '@/hooks/queries';
import { useDebounced } from '@/hooks/useDebounced';
import { agentForFolder } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

export default function FolderDetailScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const folder = useFolder(folderId);
  const del = useDeleteFolder();
  const [searchOpen, setSearchOpen] = useState(false);
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const [keywordIds, setKeywordIds] = useState<string[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const facets = useRecordKeywords({ folderId, q: q || undefined, keywordIds });

  if (folder.isPending) return <AppScreen><LoadingView /></AppScreen>;
  if (folder.isError) return <AppScreen><ErrorView error={folder.error} onRetry={folder.refetch} /></AppScreen>;
  const f = folder.data;
  const name = displayFolderName(f.name);
  const filtered = !!q || keywordIds.length > 0;
  const toggleKw = (id: string) => setKeywordIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

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
    <View style={{ marginBottom: space.lg }}>
      <Breadcrumb label="‹ 폴더" />
      <View style={styles.titleRow}>
        <Text style={[font.title, { flex: 1 }]} numberOfLines={1}>{name}</Text>
        <Pressable hitSlop={12} onPress={more}><Text style={{ fontSize: 20, color: colors.textSub }}>⋯</Text></Pressable>
      </View>
      <Text style={[font.sub, { marginTop: space.xs }]}>{f.recordCount}개 기록</Text>
      <View style={[styles.row, { marginTop: space.lg }]}>
        <Button title="검색" variant="secondary" onPress={() => setSearchOpen((v) => !v)} style={styles.smallBtn} />
        <Button title="기록 추가" variant="secondary" onPress={() => router.push({ pathname: '/archive/folders/[folderId]/add', params: { folderId } })} style={styles.smallBtn} />
      </View>

      {searchOpen ? (
        <>
          <TextInput value={text} onChangeText={setText} placeholder="이 폴더에서 검색" placeholderTextColor={colors.textMuted} style={styles.search} autoFocus />
          {facets.data?.keywords.length ? (
            <>
              <View style={[styles.rowBetween, { marginTop: space.md }]}>
                <Text style={font.sub}>관련 키워드</Text>
                {keywordIds.length ? <Pressable onPress={() => setKeywordIds([])}><Text style={font.caption}>초기화</Text></Pressable> : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.sm }}>
                {/* 키워드가 많아도 상위 7개만 보여준다 (피그마 메모) */}
                {facets.data.keywords.slice(0, 7).map((k) => (
                  <Chip key={k.keywordId} label={k.name} count={k.recordCount} selected={keywordIds.includes(k.keywordId)} onPress={() => toggleKw(k.keywordId)} />
                ))}
              </ScrollView>
            </>
          ) : null}
        </>
      ) : null}
      <Text style={[font.caption, { marginTop: space.md }]}>최신 분석순 · 기록을 누르면 분석 결과로 이동해요</Text>
    </View>
  );

  return (
    <AppScreen onAgent={() => setAgentOpen(true)}>
      <RecordList
        query={{ folderId, q: q || undefined, keywordIds }}
        header={header}
        empty={filtered
          ? <EmptyView title="조건에 맞는 기록이 없어요" desc="키워드를 하나 빼거나 필터를 초기화해 보세요." action={<Button title="필터 초기화" variant="secondary" onPress={() => { setKeywordIds([]); setText(''); }} />} />
          : <EmptyView title="아직 추가된 기록이 없어요" desc="분석 기록을 이 폴더에 모아 보세요." action={<Button title="기록 추가" onPress={() => router.push({ pathname: '/archive/folders/[folderId]/add', params: { folderId } })} />} />}
        footer={(matched, shown) => `${matched}개 중 ${shown}개 기록`}
      />
      <FolderNameModal visible={renaming} editing={f} onClose={() => setRenaming(false)} />
      <AgentSheet visible={agentOpen} onClose={() => setAgentOpen(false)} context={agentForFolder(folderId, name, f.recordCount)} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  smallBtn: { height: 40, marginRight: space.sm, paddingHorizontal: space.xl },
  search: { marginTop: space.lg, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 15, color: colors.text },
});
