// 홈 화면의 구성 요소 (피그마 HOME-FREE)
import type { Batch } from '@/api/intake';
import { minutes, type AnalysisQuota } from '@/api/quota';
import type { HomeData } from '@/api/types';
import { Icon } from '@/components/ui';
import { batchProgress, batchStatusText, batchTitle } from '@/features/analysis/batchProgress';
import { formatDate } from '@/lib/format';
import { colors, palette, radius, typography } from '@/theme/tokens';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// ---------- 섹션 제목 (좌우 8 들여쓰기) ----------
export function SectionHeader({ title, right, marginTop = 32, marginBottom = 12 }: {
  title: string; right?: React.ReactNode; marginTop?: number; marginBottom?: number;
}) {
  return (
    <View style={[s.sectionRow, { marginTop, marginBottom }]}>
      <Text style={typography.heading20}>{title}</Text>
      {right}
    </View>
  );
}

// ---------- 파란 입력 카드 ----------
function LinkIcon() {
  const p = { stroke: palette.primary[60], strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" {...p} />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" {...p} />
    </Svg>
  );
}

export function LinkCard({ value, onChange, onSubmit }: { value: string; onChange: (t: string) => void; onSubmit: () => void }) {
  return (
    <View style={s.linkCard}>
      <Text style={[typography.heading22, { color: colors.onPrimary }]}>무엇을 정리할까요?</Text>
      <Text style={[typography.body14Medium, { color: colors.onPrimary, marginTop: 2 }]}>IT 관련 Youtube 영상이나 재생목록을 분석해보세요.</Text>
      <View style={s.input}>
        <LinkIcon />
        <TextInput
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onSubmit}
          placeholder="YouTube 링크를 붙여넣어주세요"
          placeholderTextColor={colors.textDisabled}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          style={s.inputText}
        />
      </View>
    </View>
  );
}

// ---------- 분석 중 카드 ----------
export function AnalyzingCard({ batch, onPress }: { batch: Batch; onPress: () => void }) {
  const pct = batchProgress(batch);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.analyzing, pressed && { opacity: 0.7 }]}>
      <Text style={typography.subtitle16Bold} numberOfLines={1}>{batchTitle(batch)}</Text>
      <Text style={[typography.body14Medium, { color: colors.textSub, marginTop: 2 }]}>{batchStatusText(batch)}</Text>
      <View style={s.progressRow}>
        <Text style={[typography.subtitle16Bold, s.pct]}>{pct}%</Text>
        <View style={s.track}><View style={[s.fill, { width: `${pct}%` }]} /></View>
      </View>
    </Pressable>
  );
}

// ---------- 최근 분석 ----------
export function NewBanner() {
  return (
    <View style={s.banner}>
      <View style={s.dot} />
      <Text style={[typography.subtitle16Semibold, { color: colors.primaryDeep }]}>새로 정리된 영상이 있어요</Text>
    </View>
  );
}

export function RecentCard({ item, onPress }: { item: HomeData['recentAnalyses'][number]; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.recent, pressed && { opacity: 0.7 }]}>
      <Text style={[typography.body14Bold, { paddingRight: 28 }]} numberOfLines={1}>{item.video.title}</Text>
      <Text style={[typography.body14Medium, { color: colors.textSub, marginTop: 2, paddingRight: 28 }]} numberOfLines={1}>{item.oneLine}</Text>
      <View style={s.recentRow}>
        <View style={s.tags}>
          {item.keywords.slice(0, 3).map((k) => (
            <View key={k.keywordId} style={s.chip}><Text style={s.chipText}>{k.name}</Text></View>
          ))}
        </View>
        <Text style={[typography.body14Medium, { color: colors.textDisabled, marginLeft: 'auto' }]}>{formatDate(item.analyzedAt)}</Text>
      </View>
      <View style={s.chev} pointerEvents="none">
        <Icon source={require('../../../assets/icons/chevron-card.svg')} width={19} height={18} style={{ transform: [{ scaleX: -1 }] }} />
      </View>
    </Pressable>
  );
}

// ---------- 이번달 이용량 ----------
function Ring({ percent, color, textColor, size = 69, stroke = 8 }: { percent: number; color: string; textColor: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent)) / 100;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceStrong} strokeWidth={stroke} fill="none" />
        {p > 0 ? (
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${c * p} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text style={[typography.heading18, { color: textColor }]}>{Math.round(percent)}%</Text>
    </View>
  );
}

export function UsageSection({ quota }: { quota: AnalysisQuota }) {
  const pct = quota.limitMs > 0 ? (quota.remainingMs / quota.limitMs) * 100 : 0;
  return (
    <>
      <SectionHeader title="이번달 이용량" marginBottom={6} />
      <View style={s.planRow}>
        <Text style={[typography.body14Semibold, { color: colors.textSub }]}>현재 플랜</Text>
        <View style={s.planPill}><Text style={[typography.button12, { color: palette.primary[60] }]}>Free</Text></View>
      </View>
      <View style={s.usageRow}>
        <View style={s.usageCard}>
          <Text style={[typography.body14Semibold, { color: colors.textBody }]}>영상 분석</Text>
          <Text>
            <Text style={typography.heading18}>{minutes(quota.remainingMs)}</Text>
            <Text style={[typography.body14Medium, { color: colors.textSub }]}> 남음</Text>
          </Text>
          <View style={{ alignSelf: 'center', marginTop: 8 }}>
            <Ring percent={pct} color={colors.primary} textColor={colors.primaryStrong} />
          </View>
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  linkCard: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingTop: 28, paddingHorizontal: 16, paddingBottom: 25 },
  input: { marginTop: 12, height: 48, borderRadius: radius.lg, backgroundColor: colors.onPrimary, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 12, gap: 4 },
  inputText: {
    flex: 1, ...typography.body14Medium, paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  analyzing: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 20 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginRight: 16 },
  pct: { width: 52, color: colors.primaryDark },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  banner: { height: 46, borderRadius: radius.lg, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryDeep },
  recent: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 20 },
  recentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flexShrink: 1 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 5 },
  chipText: { ...typography.body14Semibold, lineHeight: 22, color: palette.neutral[30] },
  chev: { position: 'absolute', right: 16, top: 25 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, height: 23 },
  planPill: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2 },
  usageRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  usageCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 25 },
});