export type ParsedUrl =
  | { type: 'video'; videoId: string }
  | { type: 'playlist'; playlistId: string }
  | { type: 'invalid' };

export function parseYoutubeUrl(input: string): ParsedUrl {
  let url: URL;
  try { url = new URL(input.trim()); } catch { return { type: 'invalid' }; }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  const list = url.searchParams.get('list');
  const v = url.searchParams.get('v');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return id ? { type: 'video', videoId: id } : { type: 'invalid' };
  }
  if (host === 'youtube.com') {
    if (url.pathname === '/watch' && v) return { type: 'video', videoId: v }; // &list= 가 있어도 단일 영상
    if (url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/')[2];
      return id ? { type: 'video', videoId: id } : { type: 'invalid' };
    }
    if (url.pathname === '/playlist' && list) return { type: 'playlist', playlistId: list };
  }
  return { type: 'invalid' };
}