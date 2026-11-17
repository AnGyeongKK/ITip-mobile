// 링크 확인 중 / 분석 가능 화면의 영상 카드 (피그마 SHARE-01, VIDEO-CONFIRM-FREE)
import type { Video } from '@/api/types';
import { ChannelAvatar } from '@/components/VideoInfoCard';
import { formatMs, youtubeThumb } from '@/lib/format';
import { colors, radius, typography } from '@/theme/tokens';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const OVERLAY = '#747576'; // 재생 원·길이 알약 (피그마)

export function VideoConfirmCard({ videoId, video }: { videoId: string; video: Video | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={s.card}>
      <View style={s.thumb}>
        {!failed ? (
          <Image source={{ uri: youtubeThumb(videoId, video?.thumbnailUrl) }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
        ) : null}
        <View style={s.play}><View style={s.triangle} /></View>
        {video?.durationMs != null ? (
          <View style={s.pill}><Text style={s.pillText}>{formatMs(video.durationMs)}</Text></View>
        ) : null}
      </View>
      <View style={s.row}>
        <ChannelAvatar uri={video?.channelImageUrl ?? null} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={typography.body14Bold} numberOfLines={2}>{video?.title ?? '영상 정보를 불러오지 못했어요'}</Text>
          <Text style={s.channel} numberOfLines={1}>{video?.channelName ?? '자막은 수집한 뒤에 확인돼요'}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.divider, borderRadius: 16, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 24, backgroundColor: colors.bg },
  thumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  play: { width: 54, height: 54, borderRadius: 27, backgroundColor: OVERLAY, alignItems: 'center', justifyContent: 'center' },
  triangle: { marginLeft: 5, width: 0, height: 0, borderTopWidth: 11, borderBottomWidth: 11, borderLeftWidth: 18, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: colors.onPrimary },
  pill: { position: 'absolute', right: 12, bottom: 12, height: 19, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: OVERLAY, justifyContent: 'center' },
  pillText: { ...typography.button12, lineHeight: 17, color: colors.onPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  channel: { ...typography.body13Medium, color: colors.textSub },
});