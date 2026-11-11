// SEARCH-01/02 + ARCHIVE-05~14 (기록 목록·검색, 키워드, 폴더, 재생목록 그룹, 홈)
import { ApiError, USE_MOCK, cleanParams, delay, newIdempotencyKey, request } from './client';
import * as db from './mock/db';
import type {
  AddRecordsResult, Folder, HomeData, KeywordFacets, MatchField, PlaylistGroup, RecordItem, RecordPage, RecordQuery, CursorPage,
} from './types';

const PAGE = 20;

// ---------------- 폴더 이름 규칙 ----------------
export const FOLDER_NAME_MAX = 20;

export function normalizeFolderName(input: string) {
  return input.trim();
}
export function folderNameKey(name: string) {
  return normalizeFolderName(name).replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}
export function folderNameLength(name: string) {
  return Array.from(normalizeFolderName(name)).length;
}
/** 클라이언트 1차 검증. 서버 응답(400/409)이 항상 최종 기준. */
export function validateFolderName(input: string, existing: Folder[], editingId?: string): string | null {
  const n = normalizeFolderName(input);
  if (!n) return '폴더 이름을 입력해 주세요.';
  if (folderNameLength(n) > FOLDER_NAME_MAX) return `폴더 이름은 ${FOLDER_NAME_MAX}자까지 쓸 수 있어요.`;
  if (existing.some((f) => f.folderId !== editingId && folderNameKey(f.name) === folderNameKey(n))) return '같은 이름의 폴더가 이미 있어요.';
  return null;
}

// ---------------- 기록 목록·검색 (SEARCH-01) ----------------
function mockSearch(q: RecordQuery, cursor?: string): RecordPage {
  const text = (q.q ?? '').trim().toLowerCase();
  let list = [...db.records].sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt));
  if (q.folderId) {
    const set = db.folderRecords[q.folderId];
    if (!set) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    list = list.filter((r) => set.has(r.recordId));
  }
  if (q.keywordIds?.length) list = list.filter((r) => q.keywordIds!.every((k) => r.keywords.some((x) => x.keywordId === k)));
  const withMatches: RecordItem[] = [];
  list.forEach((r) => {
    const matches: RecordItem['matches'] = [];
    if (text) {
      const push = (field: MatchField, value: string, sectionId: string | null = null) => {
        if (value.toLowerCase().includes(text) && !matches.some((m) => m.field === field)) matches.push({ field, text: value, sectionId });
      };
      push('TITLE', r.video.title);
      push('ONE_LINE', r.oneLine);
      r.keywords.forEach((k) => push('KEYWORD', k.name));
      // 회의 결정: 요약·마인드맵 내용까지 검색 (백엔드 반영 전 mock에서만 흉내)
      const a = db.analyses[r.analysisId];
      a?.summary.keyPoints.forEach((p) => push('DETAIL', p));
      a?.sections.forEach((s) => { push('DETAIL', s.title, s.sectionId); s.subtopics.forEach((t) => push('DETAIL', t, s.sectionId)); });
      a?.summary.mentionedTools.forEach((t) => push('TOOL', t.name));
      if (!matches.length) return;
    }
    const membership = q.targetFolderId ? { folderId: q.targetFolderId, included: !!db.folderRecords[q.targetFolderId]?.has(r.recordId) } : null;
    withMatches.push({ ...r, matches, folderMembership: membership });
  });
  const start = cursor ? Number(cursor) : 0;
  const size = q.limit ?? PAGE;
  const items = withMatches.slice(start, start + size);
  const next = start + size < withMatches.length ? String(start + size) : null;
  return {
    items,
    nextCursor: next,
    hasNext: !!next,
    matchedCount: withMatches.length,
    filters: { q: q.q ?? null, folderId: q.folderId ?? null, keywordIds: q.keywordIds ?? [], playlistGroupId: q.playlistGroupId ?? null },
    selectionContext: { targetFolderId: q.targetFolderId ?? null },
  };
}

export async function listRecords(q: RecordQuery, cursor?: string): Promise<RecordPage> {
  if (USE_MOCK) { await delay(); return mockSearch(q, cursor); }
  return request({ method: 'GET', url: '/api/v1/records', params: cleanParams({ ...q, cursor }) });
}

// ---------------- 필터용 키워드 (SEARCH-02) ----------------
export async function listRecordKeywords(q: Omit<RecordQuery, 'targetFolderId' | 'limit'>): Promise<KeywordFacets> {
  if (USE_MOCK) {
    await delay(200);
    const base = mockSearch({ ...q, keywordIds: [], limit: 999 }).items;
    const scoped = mockSearch({ ...q, limit: 999 }).items;
    const map = new Map<string, { keywordId: string; name: string; recordCount: number; selected: boolean }>();
    base.forEach((r) => r.keywords.forEach((k) => {
      const inScoped = scoped.some((s) => s.recordId === r.recordId);
      const cur = map.get(k.keywordId) ?? { ...k, recordCount: 0, selected: !!q.keywordIds?.includes(k.keywordId) };
      if (inScoped) cur.recordCount += 1;
      map.set(k.keywordId, cur);
    }));
    const keywords = [...map.values()].sort((a, b) => Number(b.selected) - Number(a.selected) || b.recordCount - a.recordCount);
    return { keywords, matchedCount: scoped.length };
  }
  return request({ method: 'GET', url: '/api/v1/record-keywords', params: cleanParams(q) });
}

// ---------------- 폴더 (ARCHIVE-05~11) ----------------
export async function listFolders(cursor?: string): Promise<CursorPage<Folder>> {
  if (USE_MOCK) { await delay(200); return { items: [...db.folders], nextCursor: null, hasNext: false }; }
  return request({ method: 'GET', url: '/api/v1/folders', params: cleanParams({ cursor, limit: 50 }) });
}

export async function getFolder(folderId: string): Promise<Folder> {
  if (USE_MOCK) {
    await delay(200);
    const f = db.folders.find((x) => x.folderId === folderId);
    if (!f) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    return { ...f };
  }
  return request({ method: 'GET', url: `/api/v1/folders/${folderId}` });
}

export async function createFolder(name: string, idempotencyKey = newIdempotencyKey()): Promise<Folder> {
  const serverName = normalizeFolderName(name);
  if (USE_MOCK) {
    await delay();
    if (db.folders.some((f) => folderNameKey(f.name) === folderNameKey(name))) throw new ApiError(409, 'FOLDER_NAME_DUPLICATED', '같은 이름의 폴더가 이미 있어요.');
    const f: Folder = { folderId: `f-${Date.now()}`, name: serverName, recordCount: 0, createdAt: new Date().toISOString() };
    db.folders.push(f);
    db.folderRecords[f.folderId] = new Set();
    return f;
  }
  return request({ method: 'POST', url: '/api/v1/folders', data: { name: serverName }, headers: { 'Idempotency-Key': idempotencyKey } });
}

export async function renameFolder(folderId: string, name: string): Promise<Folder> {
  const serverName = normalizeFolderName(name);
  if (USE_MOCK) {
    await delay();
    const f = db.folders.find((x) => x.folderId === folderId);
    if (!f) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    if (db.folders.some((x) => x.folderId !== folderId && folderNameKey(x.name) === folderNameKey(name))) throw new ApiError(409, 'FOLDER_NAME_DUPLICATED', '같은 이름의 폴더가 이미 있어요.');
    f.name = serverName;
    return { ...f };
  }
  return request({ method: 'PATCH', url: `/api/v1/folders/${folderId}`, data: { name: serverName } });
}

/** 폴더만 삭제. 기록은 최근 기록·다른 폴더에 그대로 남는다. */
export async function deleteFolder(folderId: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    const i = db.folders.findIndex((x) => x.folderId === folderId);
    if (i >= 0) db.folders.splice(i, 1);
    delete db.folderRecords[folderId];
    return;
  }
  await request({ method: 'DELETE', url: `/api/v1/folders/${folderId}` });
}

export async function addRecordsToFolder(folderId: string, recordIds: string[]): Promise<AddRecordsResult> {
  const ids = [...new Set(recordIds)];
  if (USE_MOCK) {
    await delay();
    const set = db.folderRecords[folderId];
    if (!set) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    const added: string[] = []; const already: string[] = [];
    ids.forEach((id) => (set.has(id) ? already.push(id) : (set.add(id), added.push(id))));
    db.syncFolderCounts();
    return { folderId, addedRecordIds: added, alreadyIncludedRecordIds: already, recordCount: set.size };
  }
  return request({ method: 'POST', url: `/api/v1/folders/${folderId}/records`, data: { recordIds: ids } });
}

/** 폴더와 기록의 연결만 해제 (기록은 유지) */
export async function removeRecordFromFolder(folderId: string, recordId: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    db.folderRecords[folderId]?.delete(recordId);
    db.syncFolderCounts();
    return;
  }
  await request({ method: 'DELETE', url: `/api/v1/folders/${folderId}/records/${recordId}` });
}

// ---------------- 재생목록 그룹 (ARCHIVE-12/13, 연동 협의) ----------------
export async function listPlaylistGroups(): Promise<CursorPage<PlaylistGroup>> {
  if (USE_MOCK) {
    await delay(200);
    return { items: [{ groupId: 'g-1', playlistId: 'PL_EXAMPLE', name: 'AI Trends 2026', recordCount: 1, updatedAt: '2026-11-04T00:00:00Z' }], nextCursor: null, hasNext: false };
  }
  return request({ method: 'GET', url: '/api/v1/playlist-groups' });
}

// ---------------- 홈 (ARCHIVE-14): A 파트 HOME-01이 B의 카드 컴포넌트로 보여준다 ----------------
export async function getHome(): Promise<HomeData> {
  if (USE_MOCK) {
    await delay();
    const recent = [...db.records].sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt)).slice(0, 3)
      .map(({ matches, folderMembership, ...r }) => ({ ...r, lastViewedAt: db.readingPositions[r.recordId]?.lastViewedAt ?? null }));
    const lastId = Object.entries(db.readingPositions).filter(([, p]) => p.sectionId).sort((a, b) => b[1].lastViewedAt.localeCompare(a[1].lastViewedAt))[0];
    let continueReading: HomeData['continueReading'] = null;
    if (lastId) {
      const rec = db.records.find((r) => r.recordId === lastId[0]);
      const sec = rec && db.sectionDetails[`${rec.analysisId}/${lastId[1].sectionId}`];
      if (rec && sec) {
        continueReading = {
          recordId: rec.recordId, analysisId: rec.analysisId, videoTitle: rec.video.title, tab: lastId[1].tab,
          sectionId: sec.sectionId, sectionTitle: sec.title, startMs: sec.startMs, endMs: sec.endMs, positionMs: null,
          lastViewedAt: lastId[1].lastViewedAt, sectionSummary: sec.summary, practicalTipCount: sec.detail.applicationTips.length,
        };
      }
    }
    return { recentAnalyses: recent, continueReading };
  }
  return request({ method: 'GET', url: '/api/v1/users/me/home' });
}
