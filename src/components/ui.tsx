// 공통 UI 조각. A 파트와 같이 쓰는 컴포넌트는 여기에 둔다.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ApiError } from '../api/client';
import type { Origin } from '../api/types';
import { colors, font, radius, space } from '../theme/tokens';

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; loading?: boolean; style?: ViewStyle;
}) {
  const v = btn[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, v.box, (disabled || loading) && { opacity: 0.4 }, pressed && { opacity: 0.7 }, style]}
    >
      {loading ? <ActivityIndicator color={v.text.color} /> : <Text style={[s.btnText, v.text]}>{title}</Text>}
    </Pressable>
  );
}

const btn = {
  primary: { box: { backgroundColor: colors.primary }, text: { color: colors.onPrimary } },
  secondary: { box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, text: { color: colors.text } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: colors.textSub } },
  danger: { box: { backgroundColor: colors.danger }, text: { color: '#fff' } },
};

export function Chip({ label, selected, onPress, count }: { label: string; selected?: boolean; onPress?: () => void; count?: number }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.chip, selected && s.chipOn]}>
      <Text style={[s.chipText, selected && s.chipTextOn]}>
        {label}{count != null ? ` ${count}` : ''}
      </Text>
    </Pressable>
  );
}

/** [영상] / [AI 제안] 구분 라벨 (origin 필드) */
export function OriginBadge({ origin }: { origin: Origin }) {
  const ai = origin === 'AI_SUGGESTION';
  return (
    <View style={[s.badge, { backgroundColor: ai ? colors.aiBadgeBg : colors.sourceBadgeBg }]}>
      <Text style={[s.badgeText, { color: ai ? colors.aiBadgeText : colors.sourceBadgeText }]}>{ai ? 'AI 제안' : '영상'}</Text>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.sectionTitleRow}>
      <Text style={font.h3}>{children}</Text>
      {right}
    </View>
  );
}

export function LoadingView({ label = '불러오는 중이에요' }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.textSub} />
      <Text style={[font.sub, { marginTop: space.sm }]}>{label}</Text>
    </View>
  );
}

/** 네트워크 실패를 빈 화면으로 바꾸지 않는다 (명세 공통 규칙). */
export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  const title = e?.isNotFound ? '찾을 수 없는 항목이에요' : e?.isNetwork ? '연결이 불안정해요' : '불러오지 못했어요';
  const desc = e?.isNotFound ? '삭제되었거나 접근할 수 없어요.' : e?.message ?? '잠시 후 다시 시도해 주세요.';
  return (
    <View style={s.center}>
      <Text style={font.h3}>{title}</Text>
      <Text style={[font.sub, { marginTop: space.xs, textAlign: 'center' }]}>{desc}</Text>
      {onRetry && !e?.isNotFound ? <Button title="다시 시도" variant="secondary" onPress={onRetry} style={{ marginTop: space.lg }} /> : null}
    </View>
  );
}

export function EmptyView({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <View style={s.center}>
      <Text style={font.h3}>{title}</Text>
      {desc ? <Text style={[font.sub, { marginTop: space.xs, textAlign: 'center' }]}>{desc}</Text> : null}
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.lg }} />;

const s = StyleSheet.create({
  btn: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  btnText: { fontSize: 15, fontWeight: '600' },
  chip: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: space.sm, marginBottom: space.sm },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextOn: { color: colors.onPrimary, fontWeight: '600' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, minHeight: 240 },
});
