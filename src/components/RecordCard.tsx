// 분석 기록 카드 (피그마 최종 디자인 ARCHIVE-RECORDS·FOLDER-DETAIL·KEYWORD-DETAIL)
// [제목 / 한 줄 요약] › · [키워드 칩] 분석일. 썸네일 없음.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MatchField, RecordItem } from '../api/types';
import { formatDate } from '../lib/format';
import { colors, radius, space, typography } from '../theme/tokens';
import { Icon } from './ui';

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
      <View style={styles.topRow}>
        {checkbox ? (
          <View style={[styles.check, checkbox.checked && styles.checkOn]}>
            {checkbox.checked ? <Icon source={require('../../assets/icons/check.svg')} width={16} height={12} /> : null}
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={typography.body14Semibold} numberOfLines={2}>{item.video.title}</Text>
          <Text style={[typography.body14Medium, { color: colors.textBody }]} numberOfLines={2}>{item.oneLine}</Text>
        </View>
        {!checkbox ? <Icon source={require('../../assets/icons/chevron-source.svg')} width={19} height={18} style={{ transform: [{ scaleX: -1 }] }} /> : null}
      </View>
      {matches.length ? (
        <Text style={[typography.caption12, { color: colors.primaryStrong }]} numberOfLines={1}>
          일치: {matches.slice(0, 2).map((m) => `${FIELD_LABEL[m.field]} · ${m.text}`).join(', ')}
        </Text>
      ) : null}
      <View style={styles.bottomRow}>
        <View style={styles.tags}>
          {item.keywords.slice(0, 4).map((k) => (
            <View key={k.keywordId} style={styles.tag}><Text style={[typography.button12, { color: colors.icon }]}>{k.name}</Text></View>
          ))}
        </View>
        <Text style={[typography.body14Medium, { color: colors.textDisabled }]}>{formatDate(item.analyzedAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: space.md, paddingBottom: 20, paddingHorizontal: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, gap: space.sm, marginBottom: space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  tags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { backgroundColor: colors.bg, borderWidth: 1.4, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  check: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  checkOn: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
});
