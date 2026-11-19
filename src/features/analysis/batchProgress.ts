import { canCollectCaption, type Batch, type BatchItem, type Stage } from '@/api/intake';

// 홈의 '분석 중' 카드용. 서버가 정확한 진행률을 주지 않아서 서버 단계(stage)로 추정한 값이다.
// 표시 방식을 바꾸려면 이 파일만 고치면 된다.
const STAGE_ORDER: Stage[] = ['VALIDATING', 'SUMMARIZING', 'INDEXING', 'FINISHING'];
const STAGE_PCT: Record<Stage, number> = { VALIDATING: 35, SUMMARIZING: 55, INDEXING: 75, FINISHING: 90 };
const STAGE_TEXT: Record<Stage, string> = {
  VALIDATING: '자막을 확인하고 있어요',
  SUMMARIZING: '내용을 정리하고 있어요',
  INDEXING: '검색 정보를 정리하고 있어요',
  FINISHING: '마무리하고 있어요',
};

function itemPct(it: BatchItem): number {
  switch (it.status) {
    case 'COMPLETED':
    case 'FAILED': return 100;
    case 'PROCESSING': return it.stage ? STAGE_PCT[it.stage] : 30;
    case 'QUEUED':
    case 'RETRY_WAIT': return 20;
    default: return 10; // AWAITING_UPLOAD: 기기에서 자막 수집 중
  }
}

export function batchProgress(b: Batch): number {
  if (b.items.length === 0) return 0;
  return Math.round(b.items.reduce((sum, it) => sum + itemPct(it), 0) / b.items.length);
}

export function batchStatusText(b: Batch): string {
  const active = b.items.filter((i) => i.status !== 'COMPLETED' && i.status !== 'FAILED');
  if (active.some((i) => i.status === 'AWAITING_UPLOAD')) {
    return active.some(canCollectCaption) ? '자막을 수집하고 있어요' : '자막 업로드 시간이 지났어요';
  }
  if (active.some((i) => i.status === 'QUEUED')) return '분석을 기다리고 있어요';
  if (active.some((i) => i.status === 'RETRY_WAIT')) return '자동으로 다시 시도하고 있어요';
  const stages = active.map((i) => i.stage).filter((s): s is Stage => !!s);
  if (stages.length) {
    const earliest = stages.reduce((a, c) => (STAGE_ORDER.indexOf(a) <= STAGE_ORDER.indexOf(c) ? a : c));
    return STAGE_TEXT[earliest];
  }
  return '분석하고 있어요';
}

export function batchTitle(b: Batch): string {
  const first = b.items[0];
  if (!first) return '분석 중';
  const name = first.video?.title ?? `영상 ${first.videoId}`;
  return b.items.length > 1 ? `${name} 외 ${b.items.length - 1}개` : name;
}