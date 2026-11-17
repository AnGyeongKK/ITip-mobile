// 키워드 칩·빈 상태 아이콘 (피그마 최종 디자인 KEYWORD-DETAIL / KEYWORD-MORE-SHEET / KEYWORD-EMPTY)
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, palette, space, typography } from '../theme/tokens';
import { Icon } from './ui';

type ChipKind = 'selected' | 'selectable' | 'more';

/** 36px 둥근 칩. selected: 파란 바탕(✕ 또는 개수), selectable: 파란 테두리, more: 회색 */
export function KeywordChip({ kind, label, count, onPress, removable }: {
  kind: ChipKind; label: string; count?: number; onPress?: () => void; removable?: boolean;
}) {
  const on = kind === 'selected';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.chip, styles[kind], pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={removable ? `${label} 선택 해제` : label}
    >
      <Text style={[typography.body14Semibold, { color: on ? colors.onPrimary : kind === 'more' ? colors.textStrong : colors.primary }]}>{label}</Text>
      {count != null ? <Text style={[typography.body14Medium, { color: on ? colors.onPrimary : colors.textSub }]}>{count}</Text> : null}
      {removable ? <Icon source={require('../../assets/icons/close-chip.svg')} width={14} height={14} /> : null}
    </Pressable>
  );
}

/** 키워드 빈 상태 아이콘: 점선 패널 + # + 점 두 개 (Figma icon/empty-keyword를 그대로 옮김) */
export function KeywordEmptyIcon() {
  return (
    <View style={styles.iconBox}>
      <View style={styles.panel} />
      <View style={[styles.bar, styles.v, { left: 36, top: 32 }]} />
      <View style={[styles.bar, styles.v, { left: 52, top: 29 }]} />
      <View style={[styles.bar, styles.h, { left: 23, top: 44 }]} />
      <View style={[styles.bar, styles.h, { left: 26, top: 60 }]} />
      <View style={{ position: 'absolute', left: 80, top: 2 }}><Icon source={require('../../assets/icons/dot-dark.svg')} width={12} height={12} /></View>
      <View style={{ position: 'absolute', left: 86, top: 18 }}><Icon source={require('../../assets/icons/dot-light.svg')} width={8} height={8} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.lg, borderRadius: 999 },
  selected: { backgroundColor: colors.primary, borderWidth: 1.4, borderColor: colors.primary },
  selectable: { backgroundColor: colors.bg, borderWidth: 1.4, borderColor: colors.primary },
  more: { backgroundColor: colors.surface },
  iconBox: { width: 96, height: 104, paddingBottom: space.sm },
  panel: { position: 'absolute', left: 6, top: 14, width: 76, height: 76, borderRadius: 20, borderWidth: 3, borderStyle: 'dashed', borderColor: palette.neutral[70], backgroundColor: colors.surface },
  bar: { position: 'absolute', borderRadius: 4, backgroundColor: palette.neutral[60], transform: [{ rotate: '-10deg' }] },
  v: { width: 8, height: 40 },
  h: { width: 40, height: 8 },
});
