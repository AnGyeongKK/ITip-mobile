// 메뉴 > ITip Agent: 전체 기록으로 새 대화 + 저장된 대화 목록 (CHAT-02, CHAT-07)
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ConversationListItem } from '@/api/types';
import { AgentSheet, AgentContext } from '@/components/AgentSheet';
import { AppScreen } from '@/components/AppShell';
import { Button, EmptyView, ErrorView, LoadingView } from '@/components/ui';
import { useConversations, useDeleteConversation } from '@/hooks/queries';
import { formatDate } from '@/lib/format';
import { agentForAll } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

export default function AgentHub() {
  const q = useConversations();
  const del = useDeleteConversation();
  const [open, setOpen] = useState<{ context: AgentContext; conversationId?: string } | null>(null);

  const openSaved = (c: ConversationListItem) =>
    setOpen({
      conversationId: c.conversationId,
      context: { ...agentForAll(), scopeTitle: c.scopeLabel, suggestions: [] },
    });

  const remove = (c: ConversationListItem) => {
    if (c.activeAssistantMessageId) {
      Alert.alert('답변을 만드는 중이에요', '답변이 끝난 뒤에 삭제할 수 있어요.');
      return;
    }
    Alert.alert('대화를 삭제할까요?', '이 채팅방의 질문과 답변이 모두 삭제돼요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => del.mutate(c.conversationId) },
    ]);
  };

  return (
    <AppScreen>
      <FlatList
        data={q.data?.items ?? []}
        keyExtractor={(c) => c.conversationId}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.lg }}>
            <Text style={font.title}>ITip Agent</Text>
            <Text style={[font.sub, { marginTop: space.xs }]}>내 분석 기록을 근거로 답해요.</Text>
            <Button title="전체 기록에 질문하기" onPress={() => setOpen({ context: agentForAll(), })} style={{ marginTop: space.lg }} />
            {q.data?.items.length ? <Text style={[font.h3, { marginTop: space.xl }]}>최근 질문 기록</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openSaved(item)} onLongPress={() => remove(item)}>
            <Text style={font.h3} numberOfLines={1}>{item.title}</Text>
            {item.lastQuestion ? <Text style={[font.sub, { marginTop: 2 }]} numberOfLines={1}>{item.lastQuestion}</Text> : null}
            <Text style={[font.caption, { marginTop: space.xs }]}>{item.scopeLabel} · {formatDate(item.updatedAt)}{item.activeAssistantMessageId ? ' · 답변 생성 중' : ''}</Text>
          </Pressable>
        )}
        ListEmptyComponent={q.isPending ? <LoadingView /> : q.isError ? <ErrorView error={q.error} onRetry={q.refetch} /> : (
          <EmptyView title="아직 대화가 없어요" desc="분석 결과나 폴더 화면의 ITip Agent에서도 질문할 수 있어요." />
        )}
      />
      {open ? (
        <AgentSheet visible onClose={() => { setOpen(null); q.refetch(); }} context={open.context} conversationId={open.conversationId} startFull />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  row: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space.md },
});
