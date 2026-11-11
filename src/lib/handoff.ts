// A 파트와 맞물리는 지점 (역할 분담 문서 'A와 B가 맞물리는 지점')
import { router } from 'expo-router';
import type { AgentContext } from '../components/AgentSheet';

/** 영상 ID를 홈의 링크 확인(IMPORT-01)으로 넘긴다. */
export function startAnalysisFromVideo(videoId: string) {
  router.push({ pathname: '/', params: { sharedUrl: `https://www.youtube.com/watch?v=${videoId}` } });
}

/** 분석 완료 → 결과 화면 (A가 호출) */
export function openResult(analysisId: string) {
  router.push({ pathname: '/result/[analysisId]', params: { analysisId } });
}

// ---------- 에이전트 범위별 문구 (피그마 11/06) ----------
export const agentForVideo = (recordId: string, title: string): AgentContext => ({
  scope: { type: 'RECORD', recordId },
  scopeTitle: title,
  suggestions: ['이 영상 핵심을 다시 설명해줘', '실무에서는 어떻게 활용할 수 있어?', '가장 중요한 부분이 어디야?'],
  intro: '현재 영상의 요약과 분석을 참고하고 있어요. 궁금한 내용을 물어보세요.',
  placeholder: '이 영상에 대해 물어보세요',
});

export const agentForSection = (recordId: string, sectionId: string, sectionLabel: string, videoTitle: string, rangeLabel?: string): AgentContext => ({
  ...agentForVideo(recordId, sectionLabel),
  scope: { type: 'RECORD', recordId, focusSectionId: sectionId },
  scopeSub: videoTitle,
  suggestions: ['이 구간 핵심만 설명해줘', '앞 구간과 어떤 차이가 있어?', '실무에서 적용하는 예시를 알려줘'],
  intro: `선택한 ${rangeLabel ?? '이'} 구간을 우선 참고해요. 필요하면 전체 영상의 맥락도 함께 살펴볼게요.`,
  placeholder: '이 구간에 대해 물어보세요',
});

export const agentForFolder = (folderId: string, name: string, count: number): AgentContext => ({
  scope: { type: 'FILTERED', folderId, keywordIds: [], q: null },
  scopeTitle: `${name} · ${count}개 기록`,
  suggestions: ['이 폴더의 핵심 개념을 정리해줘', '기록들에서 공통으로 다룬 내용은 뭐야?', `${name}를 어떤 순서로 복습하면 좋을까?`],
  intro: `${name} 폴더의 ${count}개 분석 기록을 참고하고 있어요. 핵심 개념이나 기록 간의 공통점에 대해 물어보세요.`,
  placeholder: '이 기록들에 대해 물어보세요',
});

export const agentForKeywords = (keywordIds: string[], label: string, count: number): AgentContext => ({
  scope: { type: 'FILTERED', folderId: null, keywordIds, q: null },
  scopeTitle: `${label} · ${count}개 기록`,
  suggestions: [`${label} 관련 기록을 비교해줘`, '공통으로 강조하는 내용은?', '처음 공부한다면 어떤 순서가 좋을까?'],
  intro: `${label} 키워드가 들어간 ${count}개 기록을 참고하고 있어요.`,
  placeholder: '이 기록들에 대해 물어보세요',
});

export const agentForAll = (): AgentContext => ({
  scope: { type: 'ALL', folderId: null, keywordIds: [], q: null },
  scopeTitle: '전체 분석 기록',
  suggestions: ['최근에 분석한 영상들을 요약해줘', '내 기록에서 가장 많이 다룬 주제는?', '다음에 볼 만한 주제를 추천해줘'],
  intro: '지금까지 분석한 모든 기록을 참고해요.',
  placeholder: '내 분석 기록에 대해 물어보세요',
});
