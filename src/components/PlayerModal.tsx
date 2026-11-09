// '04:32부터 원본 영상 보기' → 앱 안에서 재생 (11/5 회의: 앱 안 YouTube 재생)
// 재생이 막힌 영상은 InlinePlayer 안에서 YouTube 앱으로 열기를 안내한다.
import React, { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMs } from '../lib/format';
import { colors, font, space } from '../theme/tokens';
import { InlinePlayer, InlinePlayerHandle } from './InlinePlayer';

export function PlayerModal({ videoId, startMs, title, onClose }: { videoId: string; startMs: number | null; title?: string; onClose: () => void }) {
  const ref = useRef<InlinePlayerHandle>(null);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (startMs != null) setTimeout(() => ref.current?.playAt(startMs), 0);
  }, [startMs]);
  return (
    <Modal visible={startMs != null} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={styles.head}>
          <Text style={[font.h3, { flex: 1 }]} numberOfLines={1}>{title ?? '원본 영상'}{startMs != null ? ` · ${formatMs(startMs)}` : ''}</Text>
          <Pressable hitSlop={16} onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="영상 닫기">
            <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600' }}>닫기 ✕</Text>
          </Pressable>
        </View>
        <InlinePlayer ref={ref} videoId={videoId} />
        <Text style={[font.caption, { padding: space.lg }]}>제공된 영상 내용을 바탕으로 정리했어요. 자세한 내용은 원본에서 확인해 주세요.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
  closeBtn: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 999, backgroundColor: colors.surface, marginLeft: space.sm },
});
