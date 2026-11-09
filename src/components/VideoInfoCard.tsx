// 영상 정보 카드: A의 VIDEO-01과 B의 결과·구간 상단에서 같이 쓴다.
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Video } from '../api/types';
import { formatDate, formatMs, youtubeThumb } from '../lib/format';
import { colors, font, radius, space } from '../theme/tokens';

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
      <Text style={[font.body, { marginTop: space.sm, fontWeight: '600' }]} numberOfLines={2}>{video.title}</Text>
      {oneLine ? <Text style={[font.sub, { marginTop: space.xs }]}>{oneLine}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  duration: { position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 4 },
  durationText: { color: '#fff', fontSize: 11 },
});
