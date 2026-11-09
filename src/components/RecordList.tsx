// 커서 무한 스크롤 기록 목록 (SEARCH-01). 분석 기록·폴더 상세·키워드 상세에서 같이 쓴다.
import React from 'react';
import { ActivityIndicator, Alert, AlertButton, FlatList, Text, View } from 'react-native';
import type { RecordItem, RecordQuery } from '../api/types';
import { useDeleteRecord, useRecords, useRemoveRecordFromFolder } from '../hooks/queries';
import { openResult } from '../lib/handoff';
import { colors, font, space } from '../theme/tokens';
import { RecordCard } from './RecordCard';
import { ErrorView, LoadingView } from './ui';

type Props = {
  query: RecordQuery;
  header?: React.ReactElement;
  empty: React.ReactElement;
  /** 하단 안내 문구 (matchedCount, 보이는 개수를 받아서) */
  footer?: (matched: number, shown: number) => string;
};

export function RecordList({ query, header, empty, footer }: Props) {
  const q = useRecords(query);
  const del = useDeleteRecord();
  const unlink = useRemoveRecordFromFolder();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const matched = q.data?.pages[0]?.matchedCount ?? 0;

  const onLong = (r: RecordItem) => {
    const buttons: AlertButton[] = [{ text: '취소', style: 'cancel' }];
    if (query.folderId) {
      buttons.push({ text: '이 폴더에서 빼기', onPress: () => unlink.mutate({ folderId: query.folderId!, recordId: r.recordId }) });
    }
    buttons.push({
      text: '기록 삭제',
      style: 'destructive',
      onPress: () =>
        Alert.alert('분석 기록을 삭제할까요?', '삭제한 기록은 복구할 수 없고, 모든 폴더에서 빠져요. 다시 분석하면 이용 한도가 차감돼요. 기존 대화 내용은 남아요.', [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: () => del.mutate(r.recordId) },
        ]),
    });
    Alert.alert(r.video.title, undefined, buttons);
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(r) => r.recordId}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      ListHeaderComponent={header}
      renderItem={({ item }) => <RecordCard item={item} onPress={() => openResult(item.analysisId)} onLongPress={() => onLong(item)} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
      refreshing={q.isRefetching && !q.isFetchingNextPage}
      onRefresh={q.refetch}
      ListEmptyComponent={q.isPending ? <LoadingView /> : q.isError ? <ErrorView error={q.error} onRetry={q.refetch} /> : empty}
      ListFooterComponent={
        <View style={{ paddingVertical: space.md }}>
          {q.isFetchingNextPage ? <ActivityIndicator color={colors.textSub} /> : null}
          {items.length && footer ? <Text style={font.caption}>{footer(matched, items.length)}</Text> : null}
        </View>
      }
    />
  );
}
