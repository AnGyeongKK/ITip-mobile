import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import { formatDuration } from '@/api/intake';
import { Button } from '@/components/ui';
import { colors, font, radius, space } from '@/theme/tokens';

export type Issue = { code: string; message?: string };

/** API·수집 오류를 화면에서 쓰는 Issue로 바꾼다. 분기는 message가 아니라 HTTP 상태·code로 한다. */
export function toIssue(e: unknown): Issue {
  if (e instanceof ApiError) return e.isNetwork ? { code: 'NETWORK' } : { code: e.code, message: e.message };
  return { code: 'GENERIC' };
}

const COPY: Record<string, { title: string; desc: string }> = {
  INVALID_YOUTUBE_URL: { title: '올바른 링크가 아니에요', desc: 'YouTube 영상 또는 재생목록 링크를 입력해 주세요.' },
  VIDEO_UNAVAILABLE: { title: '접근할 수 없는 영상이에요', desc: '비공개이거나 삭제된 영상일 수 있어요.' },
  DURATION_EXCEEDED: { title: '영상이 너무 길어요', desc: '60분 이하의 영상만 분석할 수 있어요.' },
  KOREAN_CAPTION_NOT_FOUND: { title: '한국어 자막이 없어요', desc: '한국어 자막이 있는 영상만 분석할 수 있어요.' },
  COLLECTION_RATE_LIMITED: { title: '자막 수집이 잠시 제한됐어요', desc: '잠시 후 다시 시도해 주세요.' },
  UPLOAD_FAILED: { title: '자막을 가져오지 못했어요', desc: '잠시 후 다시 시도해 주세요.' },
  PLAYLIST_NOT_FOUND: { title: '재생목록을 찾을 수 없어요', desc: '링크를 확인해 주세요.' },
  PLAYLIST_NOT_ACCESSIBLE: { title: '접근할 수 없는 재생목록이에요', desc: '공개 재생목록 링크인지 확인해 주세요.' },
  YOUTUBE_LOOKUP_UNAVAILABLE: { title: '목록을 불러오지 못했어요', desc: '잠시 후 다시 시도해 주세요.' },
  NETWORK: { title: '연결이 불안정해요', desc: '네트워크를 확인하고 다시 시도해 주세요.' },
  GENERIC: { title: '요청을 처리하지 못했어요', desc: '잠시 후 다시 시도해 주세요.' },
};

interface Props {
  issue: Issue;
  /** ANALYSIS_QUOTA_EXCEEDED 문구용 (영상 시간 기준) */
  remainingMs?: number | null;
  neededMs?: number | null;
  onRetry?: () => void;
  onClose?: () => void;
}

export function IntakeError({ issue, remainingMs, neededMs, onRetry, onClose }: Props) {
  let title: string;
  let desc: string;
  if (issue.code === 'ANALYSIS_QUOTA_EXCEEDED') {
    title = '남은 분석 시간이 부족해요';
    desc = remainingMs != null
      ? `남은 분석 시간 ${formatDuration(remainingMs)}${neededMs ? ` · 선택한 영상 ${formatDuration(neededMs)}` : ''}`
      : '이번에 분석할 수 있는 영상 시간을 넘었어요.';
  } else if (COPY[issue.code]) {
    ({ title, desc } = COPY[issue.code]);
  } else {
    title = '분석하지 못했어요';
    desc = issue.message ?? '잠시 후 다시 시도해 주세요.'; // 서버 job.error 문구는 그대로 보여준다
  }
  return (
    <View style={s.box}>
      <Text style={font.h3}>{title}</Text>
      <Text style={[font.sub, { marginTop: space.xs }]}>{desc}</Text>
      {onRetry || onClose ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          {onRetry ? <Button title="다시 시도" onPress={onRetry} style={{ flex: 1 }} /> : null}
          {onClose ? <Button title="확인" variant="secondary" onPress={onClose} style={{ flex: 1 }} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});