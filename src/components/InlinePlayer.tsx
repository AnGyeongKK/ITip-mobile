// 앱 안 YouTube 재생 (11/5 회의 결정: 타임스탬프를 누르면 상단 영상이 펼쳐지고 그 자리에서 재생)
// react-native-youtube-iframe(WebView 기반) 사용. 외부 YouTube 앱 이동은 '원본 보기' 버튼에서만.
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { formatMs } from '../lib/format';
import { colors, font, space } from '../theme/tokens';

export interface InlinePlayerHandle {
  /** 플레이어를 펼치고 해당 위치부터 재생 */
  playAt: (ms: number) => void;
  collapse: () => void;
}

export const InlinePlayer = forwardRef<InlinePlayerHandle, { videoId: string }>(({ videoId }, ref) => {
  const { width } = useWindowDimensions();
  const player = useRef<YoutubeIframeRef>(null);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [startSec, setStartSec] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    playAt: (ms: number) => {
      const sec = Math.floor(ms / 1000);
      setOpen(true);
      setStartSec(sec);
      if (ready) player.current?.seekTo(sec, true);
      setPlaying(true);
    },
    collapse: () => { setPlaying(false); setOpen(false); },
  }), [ready]);

  const onReady = useCallback(() => {
    setReady(true);
    if (startSec) player.current?.seekTo(startSec, true);
  }, [startSec]);

  const openExternal = () => Linking.openURL(`https://www.youtube.com/watch?v=${videoId}&t=${startSec}s`);

  if (!open) {
    return (
      <Pressable style={styles.collapsed} onPress={() => { setOpen(true); setPlaying(true); }}>
        <Text style={font.sub}>▶ 영상 펼쳐서 보기</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      {failed ? (
        <View style={[styles.fail, { height: (width * 9) / 16 }]}>
          <Text style={[font.sub, { color: '#ddd' }]}>앱에서 재생할 수 없는 영상이에요.</Text>
          <Pressable onPress={openExternal} style={{ marginTop: space.sm }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>YouTube에서 {formatMs(startSec * 1000)}부터 보기</Text>
          </Pressable>
        </View>
      ) : (
        <YoutubePlayer
          ref={player}
          height={(width * 9) / 16}
          width={width}
          videoId={videoId}
          play={playing}
          initialPlayerParams={{ start: startSec }}
          onReady={onReady}
          onError={() => setFailed(true)}
          onChangeState={(state: string) => { if (state === 'ended' || state === 'paused') setPlaying(false); if (state === 'playing') setPlaying(true); }}
        />
      )}
      <View style={styles.bar}>
        <Pressable onPress={() => { setPlaying(false); setOpen(false); }}><Text style={font.caption}>영상 접기 ▲</Text></Pressable>
        <Pressable onPress={openExternal}><Text style={font.caption}>YouTube 앱에서 열기 ↗</Text></Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#000' },
  collapsed: { paddingVertical: space.md, alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surface },
  fail: { alignItems: 'center', justifyContent: 'center' },
});
