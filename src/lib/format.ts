/** 밀리초 → m:ss 또는 h:mm:ss */
export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '--:--';
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const formatRange = (start: number, end: number) => `${formatMs(start)} – ${formatMs(end)}`;

const KST = 9 * 60 * 60 * 1000;
const kstDayIndex = (iso: string) => Math.floor((Date.parse(iso) + KST) / 86400000);

/** 2026.11.08 형식 (Asia/Seoul). null이면 빈 문자열 — 날짜를 추정하지 않는다. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) + KST);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** HISTORY-01 날짜 묶음: 오늘 / 어제 / 지난 7일 / 이전 (분석일 기준, 한국 시간) */
export type DateGroup = '오늘' | '어제' | '지난 7일' | '이전';
export function dateGroup(iso: string, now = new Date().toISOString()): DateGroup {
  const diff = kstDayIndex(now) - kstDayIndex(iso);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return '지난 7일';
  return '이전';
}

export function youtubeThumb(videoId: string, url?: string | null) {
  return url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
