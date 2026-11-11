// MYARC-02 기록 추가 · SEARCH-01(targetFolderId) + ARCHIVE-10
// 이미 폴더에 있는 기록은 체크·비활성. 같은 기록을 여러 폴더에 넣을 수 있다.
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Breadcrumb } from '@/components/AppShell';
import { RecordCard } from '@/components/RecordCard';
import { Button, EmptyView, ErrorView, LoadingView } from '@/components/ui';
import { useAddRecordsToFolder, useFolder, useRecords } from '@/hooks/queries';
import { useDebounced } from '@/hooks/useDebounced';
import { colors, font, radius, space } from '@/theme/tokens';

export default function AddRecordsScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const folder = useFolder(folderId);
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  // folderId가 아니라 targetFolderId: 전체 기록을 보면서 포함 여부만 받는다
  const list = useRecords({ targetFolderId: folderId, q: q || undefined });
  const add = useAddRecordsToFolder();
  const [picked, setPicked] = useState<string[]>([]);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const submit = async () => {
    await add.mutateAsync({ folderId, recordIds: picked });
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.recordId}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.lg }}>
            <Breadcrumb label="‹ 폴더로 돌아가기" />
            <Text style={[font.title, { marginTop: space.sm }]}>기록 추가</Text>
            <Text style={[font.sub, { marginTop: space.xs }]}>{folder.data ? `${folder.data.name} 폴더에 넣을 기록을 골라 주세요.` : ' '}</Text>
            <TextInput value={text} onChangeText={setText} placeholder="분석 기록 검색" placeholderTextColor={colors.textMuted} style={styles.search} />
          </View>
        }
        renderItem={({ item }) => {
          const included = !!item.folderMembership?.included;
          return (
            <RecordCard
              item={item}
              checkbox={{ checked: included || picked.includes(item.recordId), disabled: included }}
              onPress={() => toggle(item.recordId)}
            />
          );
        }}
        onEndReached={() => { if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage(); }}
        ListEmptyComponent={list.isPending ? <LoadingView /> : list.isError ? <ErrorView error={list.error} onRetry={list.refetch} /> : <EmptyView title="추가할 기록이 없어요" />}
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.textSub} /> : undefined}
      />
      <View style={styles.bottom}>
        {add.isError ? <Text style={[font.caption, { color: colors.danger, marginBottom: space.sm }]}>추가하지 못했어요. 다시 시도해 주세요.</Text> : null}
        <Button title={picked.length ? `${picked.length}개 추가하기` : '기록을 선택해 주세요'} disabled={!picked.length} loading={add.isPending} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: space.lg, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, fontSize: 15, color: colors.text },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
