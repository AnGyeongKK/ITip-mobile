// 분석 기록 카드 (피그마 11/06 ARCHIVE-RECORDS·FOLDER-DETAIL·KEYWORD-DETAIL)
// 제목 › / 한 줄 요약 / 키워드 칩 / 분석일. 썸네일 없음.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MatchField, RecordItem } from '../api/types';
import { formatDate } from '../lib/format';
import { colors, font, radius, space } from '../theme/tokens';

const FIELD_LABEL: Record<MatchField, string> = {
  TITLE: '제목', ONE_LINE: '한 줄 요약', KEYWORD: '키워드', DETAIL: '상세', TECHNOLOGY: '기술', TOOL: '도구',
};

type Props = {
  item: Pick<RecordItem, 'recordId' | 'video' | 'oneLine' | 'keywords' | 'analyzedAt'> & Partial<Pick<RecordItem, 'matches'>>;
  onPress?: () => void;
  onLongPress?: () => void;
  /** 기록 추가 화면용. disabled = 이미 폴더에 포함 */
  checkbox?: { checked: boolean; disabled?: boolean };
};

export function RecordCard({ item, onPress, onLongPress, checkbox }: Props) {
  const matches = item.matches ?? [];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={checkbox?.disabled}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }, checkbox?.disabled && { opacity: 0.5 }]}
    >
      <View style={styles.titleRow}>
        {checkbox ? (
          <View style={[styles.check, checkbox.checked && styles.checkOn]}>
            {checkbox.checked ? <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text> : null}
          </View>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>{item.video.title}</Text>
        {!checkbox ? <Text style={styles.chev}>›</Text> : null}
      </View>
      <Text style={[font.sub, { marginTop: space.xs }]} numberOfLines={2}>{item.oneLine}</Text>
      {item.keywords.length ? (
        <View style={styles.tags}>
          {item.keywords.slice(0, 4).map((k) => (
            <View key={k.keywordId} style={styles.tag}><Text style={styles.tagText}>{k.name}</Text></View>
          ))}
        </View>
      ) : null}
      {matches.length ? (
        <Text style={[font.caption, { marginTop: space.xs, color: colors.accent }]} numberOfLines={1}>
          일치: {matches.slice(0, 2).map((m) => `${FIELD_LABEL[m.field]} · ${m.text}`).join(', ')}
        </Text>
      ) : null}
      <Text style={[font.caption, { marginTop: space.sm }]}>{formatDate(item.analyzedAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  chev: { fontSize: 20, color: colors.textSub, marginLeft: space.sm, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  tag: { backgroundColor: colors.surfaceStrong, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, marginRight: space.xs, marginBottom: space.xs },
  tagText: { fontSize: 11, color: colors.textSub },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.textMuted, marginRight: space.sm, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
