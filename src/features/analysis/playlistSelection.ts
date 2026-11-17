import type { PlaylistItem } from '../../api/intake';

export const isSelectable = (item: PlaylistItem) => item.eligibility !== 'INELIGIBLE' && item.existing.status === 'NONE';

/** 충돌 후에도 새로 접수할 수 있는 선택만 유지한다. */
export function availableSelection(selected: Set<string>, items: PlaylistItem[]): Set<string> {
  const available = new Set(items.filter(isSelectable).map((item) => item.videoId));
  return new Set([...selected].filter((id) => available.has(id)));
}
