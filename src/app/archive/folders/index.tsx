// FOLDER-LIST / FOLDER-LIST-EMPTY (피그마 11/06) · ARCHIVE-05/06
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { displayFolderName } from '@/api/archive';
import { AgentSheet } from '@/components/AgentSheet';
import { AppScreen, Breadcrumb } from '@/components/AppShell';
import { FolderNameModal } from '@/components/FolderNameModal';
import { Button, EmptyView, ErrorView, LoadingView } from '@/components/ui';
import { useFolders } from '@/hooks/queries';
import { agentForAll } from '@/lib/handoff';
import { colors, font, radius, space } from '@/theme/tokens';

export default function FoldersScreen() {
  const q = useFolders();
  const [creating, setCreating] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const folders = q.data?.items ?? [];

  return (
    <AppScreen onAgent={() => setAgentOpen(true)}>
      <FlatList
        data={folders}
        keyExtractor={(f) => f.folderId}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.lg }}>
            <Breadcrumb label="내 아카이브 > 폴더" onPress={() => {}} />
            <View style={styles.titleRow}>
              <Text style={font.title}>폴더</Text>
              <Button title="+ 새 폴더" variant="secondary" onPress={() => setCreating(true)} style={{ height: 36 }} />
            </View>
            <Text style={[font.sub, { marginTop: space.xs }]}>분석 기록을 목적에 따라 직접 정리해보세요.</Text>
            {folders.length ? <Text style={[font.h3, { marginTop: space.xl }]}>내 폴더 · {folders.length}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.folder} onPress={() => router.push({ pathname: '/archive/folders/[folderId]', params: { folderId: item.folderId } })}>
            <View style={styles.icon}><Text style={{ fontSize: 18, color: colors.textSub }}>▢</Text></View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={font.h3}>{displayFolderName(item.name)}</Text>
              <Text style={[font.caption, { marginTop: 2 }]}>{item.recordCount}개 기록</Text>
            </View>
            <Text style={{ fontSize: 18, color: colors.textSub }}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={q.isPending ? <LoadingView /> : q.isError ? <ErrorView error={q.error} onRetry={q.refetch} /> : (
          <EmptyView title="아직 폴더가 없어요" desc="목적별로 폴더를 만들고 분석 기록을 모아 보세요." action={<Button title="새 폴더 만들기" onPress={() => setCreating(true)} />} />
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
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  folder: { flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space.md },
  icon: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
});
