import type { ChatScope } from '../../api/types';

export function savedScopePresentation(scope: ChatScope) {
  if (scope.type === 'RECORD') {
    return scope.focusSectionId
      ? { intro: '선택한 구간을 우선 참고하고 영상의 맥락을 함께 살펴봐요.', placeholder: '이 구간에 대해 물어보세요' }
      : { intro: '현재 영상의 요약과 분석을 참고하고 있어요.', placeholder: '이 영상에 대해 물어보세요' };
  }
  return {
    intro: scope.type === 'FILTERED' ? '선택한 범위의 분석 기록을 참고해요.' : '지금까지 분석한 모든 기록을 참고해요.',
    placeholder: '내 분석 기록에 대해 물어보세요',
  };
}
