// FOLDER-LIST / FOLDER-LIST-EMPTY (피그마 최종 디자인) · ARCHIVE-05/06
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen, Breadcrumb } from '@/components/AppShell';
import { FolderNameModal } from '@/components/FolderNameModal';
import { EmptyState, ErrorView, Icon, LoadingView, TextButton } from '@/components/ui';
import { useFolders } from '@/hooks/queries';
import { agentForAll } from '@/lib/handoff';
import { colors, radius, space, typography } from '@/theme/tokens';

export default function FoldersScreen() {
  const q = useFolders();
  const [creating, setCreating] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const folders = q.data?.items ?? [];
  const empty = q.isSuccess && folders.length === 0;

  return (
    <AppScreen onAgent={() => setAgentOpen(true)} agentTone="archive" agentDisabled={empty}>
      <FlatList
        data={folders}
        keyExtractor={(f) => f.folderId}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={[styles.header, empty && { marginBottom: 60 - space.md }]}>
            <Breadcrumb label="내 아카이브  >  폴더" onPress={() => {}} />
            <View style={styles.titleRow}>
              <Text style={typography.heading20}>폴더</Text>
              <TextButton title="+ 새 폴더" onPress={() => setCreating(true)} accessibilityLabel="새 폴더 만들기" />
            </View>
            <Text style={[typography.body14Medium, { color: colors.textBody }]}>분석 기록을 목적에 따라 직접 정리해보세요.</Text>
            {folders.length ? <Text style={typography.subtitle16Bold}>내 폴더 · {folders.length}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.folder, pressed && { opacity: 0.7 }]}
            onPress={() => router.push({ pathname: '/archive/folders/[folderId]', params: { folderId: item.folderId } })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={typography.body14Semibold} numberOfLines={1}>{item.name}</Text>
              <Text style={[typography.body14Medium, { color: colors.textBody }]}>{item.recordCount}개 기록</Text>
            </View>
            <Icon source={require('../../../../assets/icons/chevron-source.svg')} width={19} height={18} style={{ transform: [{ scaleX: -1 }] }} />
          </Pressable>
        )}
        ListEmptyComponent={q.isPending ? <LoadingView /> : q.isError ? <ErrorView error={q.error} onRetry={q.refetch} /> : (
          <EmptyState
            icon={<Icon source={require('../../../../assets/icons/empty-folder.svg')} width={120} height={120} />}
            title="아직 만든 폴더가 없어요"
            desc="분석 기록을 원하는 기준으로 묶어보세요."
            actionTitle="새 폴더 만들기"
            onAction={() => setCreating(true)}
          />
        )}
      />
      <FolderNameModal
        visible={creating}
        onClose={() => setCreating(false)}
        onDone={(f) => router.push({ pathname: '/archive/folders/[folderId]', params: { folderId: f.folderId } })}
      />
      <AgentSheet visible={agentOpen} onClose={() => setAgentOpen(false)} context={agentForAll()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md, marginBottom: space.md },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  folder: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md, paddingBottom: 20, paddingHorizontal: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, marginBottom: space.md },
});
