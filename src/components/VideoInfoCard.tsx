// 영상 정보 카드: A의 VIDEO-01과 B의 결과·구간 상단에서 같이 쓴다.
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Video } from '../api/types';
import { formatDate, formatMs, youtubeThumb } from '../lib/format';
import { colors, font, radius, space, typography } from '../theme/tokens';
import { Icon } from './ui';

export function ChannelAvatar({ uri, size = 32 }: { uri: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceStrong };
  if (!uri || failed) return <View style={style} />;
  return <Image source={{ uri }} style={style} onError={() => setFailed(true)} />;
}

export function VideoThumb({ video, width = 120 }: { video: Video; width?: number }) {
  const [failed, setFailed] = useState(false);
  const height = Math.round((width * 9) / 16);
  return (
    <View style={{ width, height, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceStrong }}>
      {!failed ? (
        <Image source={{ uri: youtubeThumb(video.videoId, video.thumbnailUrl) }} style={{ width, height }} onError={() => setFailed(true)} />
      ) : null}
      {video.durationMs != null ? (
        <View style={styles.duration}><Text style={styles.durationText}>{formatMs(video.durationMs)}</Text></View>
      ) : null}
    </View>
  );
}

/** 채널 이미지·채널명·원본 업로드일 + 제목 + (선택) 한 줄 설명 */
export function VideoInfoCard({ video, oneLine }: { video: Video; oneLine?: string }) {
  const uploaded = formatDate(video.publishedAt);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <ChannelAvatar uri={video.channelImageUrl} />
        <View style={{ marginLeft: space.sm, flex: 1 }}>
          <Text style={font.h3} numberOfLines={1}>{video.channelName}</Text>
          {uploaded ? <Text style={font.caption}>{uploaded} 업로드</Text> : null}
        </View>
      </View>
      <Text style={[typography.body14Semibold, { marginTop: space.sm }]} numberOfLines={2}>{video.title}</Text>
      {oneLine ? <Text style={[font.sub, { marginTop: space.xs }]}>{oneLine}</Text> : null}
    </View>
  );
}

/** 결과·구간 상세 상단의 영상 카드 (피그마 '디자인 확정 화면'): 썸네일 · 제목 · ▶채널 · 업로드일 · › */
export function VideoSummaryCard({ video, onPress }: { video: Video; onPress?: () => void }) {
  const [failed, setFailed] = useState(false);
  const uploaded = formatDate(video.publishedAt);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.summaryCard, pressed && { opacity: 0.7 }]} accessibilityRole={onPress ? 'link' : undefined}>
      <View style={styles.summaryThumb}>
        {!failed ? (
          <Image source={{ uri: youtubeThumb(video.videoId, video.thumbnailUrl) }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryTitle} numberOfLines={2}>{video.title}</Text>
        <View style={styles.metaRow}>
          <View style={styles.ytBox}><Icon source={require('../../assets/icons/youtube.svg')} width={14.53} height={11.87} /></View>
          <Text style={[typography.caption12, { flexShrink: 1 }]} numberOfLines={1}>{video.channelName}</Text>
          {uploaded ? (
            <>
              <Icon source={require('../../assets/icons/dot.svg')} width={2} height={2} />
              <Text style={typography.caption12}>{uploaded}</Text>
            </>
          ) : null}
        </View>
      </View>
      {onPress ? <Icon source={require('../../assets/icons/chevron-card.svg')} width={19} height={18} style={{ transform: [{ scaleX: -1 }] }} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: 15, paddingRight: space.sm, paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  summaryThumb: { width: 72, height: 41, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.thumbPlaceholder },
  summaryTitle: { ...typography.body13Medium, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 21 },
  ytBox: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  card: { padding: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  duration: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 4 },
  durationText: { ...typography.caption12, fontSize: 11, lineHeight: 15, color: colors.onPrimary },
});
