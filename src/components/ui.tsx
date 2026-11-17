// 공통 UI 조각. A 파트와 같이 쓰는 컴포넌트는 여기에 둔다.
import React from 'react';
import { Image, type ImageSource } from 'expo-image';
import { ActivityIndicator, ImageStyle, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ApiError } from '../api/client';
import type { Origin } from '../api/types';
import { colors, font, radius, space, typography } from '../theme/tokens';

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
  secondary: { box: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }, text: { color: colors.textStrong } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: colors.textSub } },
  danger: { box: { backgroundColor: colors.danger }, text: { color: colors.onPrimary } },
};

/** 피그마에서 받은 SVG 아이콘. 원본 크기를 그대로 쓴다. */
export function Icon({ source, width, height, style }: { source: ImageSource | number; width: number; height: number; style?: ImageStyle }) {
  return <Image source={source} style={[{ width, height }, style]} contentFit="contain" />;
}

/** 작은 라벨 칩: 도구(회색) / 키워드(#, 파랑 글자) / 타임스탬프(연파랑) */
export function Tag({ label, variant = 'tool', onPress, left }: { label: string; variant?: keyof typeof tag; onPress?: () => void; left?: React.ReactNode }) {
  const v = tag[variant];
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.tag, v.box]}>
      {left}
      <Text style={[typography.button12, v.text]}>{label}</Text>
    </Pressable>
  );
}

const tag = {
  tool: { box: { backgroundColor: colors.surfaceStrong }, text: { color: colors.textStrong } },
  keyword: { box: { backgroundColor: colors.surface }, text: { color: colors.primaryStrong } },
  time: { box: { backgroundColor: colors.primarySoft, paddingLeft: 4 }, text: { color: colors.primaryDeep } },
  // 색 있는 카드(구간 카드·마인드맵 노드) 위에 올리는 흰 칩
  keywordOnTint: { box: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.surface }, text: { color: colors.primaryStrong } },
  timeOnTint: { box: { backgroundColor: colors.bg, paddingLeft: 4 }, text: { color: colors.primaryStrong } },
};

/** ▶ 04:32 타임스탬프 칩 */
export function TimeTag({ label, onTint, onPress }: { label: string; onTint?: boolean; onPress?: () => void }) {
  const play = onTint ? require('../../assets/icons/play-strong.svg') : require('../../assets/icons/play-deep.svg');
  return (
    <Tag
      label={label}
      variant={onTint ? 'timeOnTint' : 'time'}
      onPress={onPress}
      left={
        <View style={s.playBox}>
          <Icon source={play} width={6.625} height={5.95} style={{ transform: [{ rotate: '90deg' }] }} />
        </View>
      }
    />
  );
}

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

export function SectionTitle({ children, right, icon, desc }: { children: React.ReactNode; right?: React.ReactNode; icon?: React.ReactNode; desc?: string }) {
  return (
    <View style={s.sectionTitleRow}>
      <View style={{ flex: 1 }}>
        <View style={s.sectionTitleLabel}>
          <Text style={typography.subtitle16Bold}>{children}</Text>
          {icon}
        </View>
        {desc ? <Text style={[typography.caption12, { color: colors.textMuted }]}>{desc}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function LoadingView({ label = '불러오는 중이에요' }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.primary} />
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

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: space.lg }} />;

const s = StyleSheet.create({
  btn: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  btnText: typography.button16,
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, marginRight: space.sm, marginBottom: space.sm },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body13Medium, color: colors.textStrong },
  chipTextOn: { ...typography.body13Medium, fontFamily: typography.body14Semibold.fontFamily, color: colors.onPrimary },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, alignSelf: 'flex-start' },
  playBox: { width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, alignSelf: 'flex-start' },
  badgeText: typography.button12,
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  sectionTitleLabel: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, minHeight: 240 },
});
