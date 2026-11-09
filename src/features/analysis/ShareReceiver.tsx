import { router, useRootNavigationState } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect } from 'react';

/** YouTube 공유로 받은 링크를 홈의 sharedUrl로 넘긴다. 내비게이션이 준비된 뒤에만 이동한다. */
export function ShareReceiver() {
  const nav = useRootNavigationState();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!nav?.key || !hasShareIntent) return;
    const raw = shareIntent.webUrl ?? shareIntent.text ?? ''; // "제목 https://youtu.be/..." 형태도 처리
    const url = raw.match(/https?:\/\/\S+/)?.[0];
    resetShareIntent();
    if (url) router.replace({ pathname: '/', params: { sharedUrl: url, ts: String(Date.now()) } });
  }, [nav?.key, hasShareIntent]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}