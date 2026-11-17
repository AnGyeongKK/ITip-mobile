// 재생목록 카드 머리(겹친 썸네일 · 이름 · 영상 수). 분석이 끝났어요 목록이 쓴다.
import { colors, radius, typography } from '@/theme/tokens';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

function ListIcon() {
  const p = { stroke: colors.textSub, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={16} height={14} viewBox="0 0 16 14" fill="none">
      <Path d="M1 2.5h9M1 7h6M1 11.5h6" {...p} />
      <Path d="M10 7.5l4.5 2.75L10 13z" {...p} />
    </Svg>
  );
}

export function PlaylistHeader({ title, thumbnailUrl, subtitle }: { title: string; thumbnailUrl: string | null; subtitle?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={s.header}>
      <View style={s.thumbWrap}>
        <View style={[s.stack, { top: -8, left: 12, right: 12, backgroundColor: colors.divider }]} />
        <View style={[s.stack, { top: -4, left: 6, right: 6, backgroundColor: colors.border }]} />
        <View style={s.thumb}>
          {thumbnailUrl && !failed ? <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} /> : null}
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={typography.subtitle16Bold} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <View style={s.subRow}>
            <ListIcon />
            <Text style={s.sub}>{subtitle}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 24, paddingHorizontal: 16 },
  thumbWrap: { width: 72, height: 41 },
  thumb: { width: 72, height: 41, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.thumbPlaceholder },
  stack: { position: 'absolute', height: 6, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { ...typography.body13Medium, lineHeight: 20, color: colors.textSub },
});