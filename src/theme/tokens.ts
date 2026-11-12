// 디자인 토큰. 피그마 '디자인 확정 화면'(11/11) 기준.
// 화면 코드는 의미 이름(colors.text 등)을 쓰고, 팔레트 값은 palette에서만 바꾼다.
import type { TextStyle } from 'react-native';

export const palette = {
  primary: {
    main: '#00A2E2',
    30: '#004C6C',
    40: '#00658F',
    50: '#007FB2',
    60: '#019AD7',
    70: '#35B6F7',
    95: '#E5F3FF',
  },
  neutral: {
    10: '#0D1D28',
    20: '#23323D',
    30: '#394954',
    40: '#51606D',
    50: '#697986',
    60: '#8393A0',
    70: '#9FAFBD',
    80: '#CED4D9',
    90: '#E8EAED',
    93: '#F3F3F3',
    94: '#F6F8FA',
    white: '#FFFFFF',
  },
  red60: '#FF5260',
} as const;

const p = palette.primary;
const n = palette.neutral;

export const colors = {
  bg: n.white,
  surface: n[94],
  surfaceStrong: n[90],
  border: n[80],
  divider: n[90],
  text: n[10],
  textStrong: n[20],
  textBody: n[40],
  textSub: n[50],
  textMuted: n[70],
  textDisabled: n[60],
  icon: n[30],
  primary: p.main,
  primaryDark: p[30],
  primaryStrong: p[50],
  primaryDeep: p[40],
  primarySoft: p[95],
  primaryLine: p[70],
  onPrimary: n.white,
  accent: p[50],
  danger: palette.red60,
  aiBadgeBg: p[95],
  aiBadgeText: p[40],
  sourceBadgeBg: n[90],
  sourceBadgeText: n[20],
  thumbPlaceholder: n[70],
  fabShadow: 'rgba(159,175,189,0.5)',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 4, md: 8, lg: 12, pill: 999 };

/** Pretendard. Android는 fontWeight로 굵기를 고르지 못해서 굵기마다 family를 따로 쓴다. */
export const fontFamily = {
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
} as const;

/** 피그마 텍스트 스타일 (letterSpacing -2%) */
function t(size: number, family: keyof typeof fontFamily, lh: number, color: string = colors.text): TextStyle {
  return {
    fontFamily: fontFamily[family],
    fontSize: size,
    lineHeight: Math.round(size * lh),
    letterSpacing: -0.02 * size,
    color,
  };
}

export const typography = {
  heading22: t(22, 'bold', 1.4),
  heading20: t(20, 'bold', 1.4),
  heading18: t(18, 'bold', 1.4),
  subtitle16Bold: t(16, 'bold', 1.6),
  subtitle16Semibold: t(16, 'semibold', 1.6),
  body14Medium: t(14, 'medium', 1.6),
  body14Semibold: t(14, 'semibold', 1.6),
  body14Bold: t(14, 'bold', 1.6),
  body13Medium: t(13, 'medium', 1.6),
  caption12: t(12, 'medium', 1.4, colors.textSub),
  button16: t(16, 'semibold', 1.6),
  button12: t(12, 'semibold', 1.6),
};

/** 예전 이름. 기존 화면이 그대로 새 글꼴을 받도록 유지한다. */
export const font = {
  title: typography.heading20,
  h2: typography.heading18,
  h3: typography.subtitle16Bold,
  body: typography.body14Medium,
  sub: { ...typography.body13Medium, color: colors.textSub },
  caption: typography.caption12,
};
