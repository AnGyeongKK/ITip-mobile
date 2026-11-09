// 디자인 토큰. 수요일(11/11) 디자인이 나오면 이 파일 값만 바꾸면 전체에 반영된다.
// 현재 값은 피그마 10/23 와이어프레임(회색 톤) 기준 임시값.
export const colors = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceStrong: '#EBEBEB',
  border: '#E2E2E2',
  text: '#1A1A1A',
  textSub: '#5C5C5C',
  textMuted: '#9A9A9A',
  primary: '#3A3A3A',
  onPrimary: '#FFFFFF',
  accent: '#2F6FEB',
  danger: '#D64545',
  aiBadgeBg: '#EEF2FF',
  aiBadgeText: '#4338CA',
  sourceBadgeBg: '#F1F1F1',
  sourceBadgeText: '#4B4B4B',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };
export const font = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  sub: { fontSize: 13, color: colors.textSub, lineHeight: 19 },
  caption: { fontSize: 12, color: colors.textMuted },
};
