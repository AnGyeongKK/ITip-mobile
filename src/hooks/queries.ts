// TanStack Query 훅. 화면은 API 함수를 직접 부르지 말고 이 훅을 쓴다.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as analysis from '../api/analysis';
import * as archive from '../api/archive';
import * as chat from '../api/chat';
import type { ChatScope, CursorPage, Folder, RecordQuery, ResultTab } from '../api/types';

export const qk = {
  analysis: (id: string) => ['analysis', id] as const,
  section: (a: string, s: string) => ['section', a, s] as const,
  recs: (a: string, s: string) => ['recommendations', a, s] as const,
  record: (id: string) => ['record', id] as const,
  records: (q: RecordQuery) => ['records', q] as const,
  keywords: (q: RecordQuery) => ['record-keywords', q] as const,
  folders: ['folders'] as const,
  folder: (id: string) => ['folder', id] as const,
  playlistGroups: ['playlist-groups'] as const,
  home: ['home'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (id: string) => ['messages', id] as const,
};

// ---------- 결과 ----------
export const useAnalysis = (analysisId: string) =>
  useQuery({ queryKey: qk.analysis(analysisId), queryFn: () => analysis.getAnalysis(analysisId), enabled: !!analysisId });

export const useSection = (analysisId: string, sectionId: string) =>
  useQuery({ queryKey: qk.section(analysisId, sectionId), queryFn: () => analysis.getSection(analysisId, sectionId), enabled: !!analysisId && !!sectionId });

export const RELATED_VIDEOS_ENABLED = false;

/** 추천은 PENDING이면 5초 뒤 다시 조회. 실패해도 본문 화면에는 영향을 주지 않는다. */
export const useRecommendations = (analysisId: string, sectionId: string) =>
  useQuery({
    queryKey: qk.recs(analysisId, sectionId),
    queryFn: () => analysis.getRecommendations(analysisId, sectionId),
    enabled: RELATED_VIDEOS_ENABLED && !!analysisId && !!sectionId,
    retry: 1,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 5000 : false),
  });

export const useRecord = (recordId: string) =>
  useQuery({ queryKey: qk.record(recordId), queryFn: () => analysis.getRecord(recordId), enabled: !!recordId });

export function useSaveReadingPosition() {
  return useMutation({
    mutationFn: (v: { recordId: string; tab: ResultTab; sectionId: string | null }) => analysis.saveReadingPosition(v.recordId, v.tab, v.sectionId),
  });
}

export function useDeleteRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => analysis.deleteRecord(recordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records'] });
      qc.invalidateQueries({ queryKey: ['record-keywords'] });
      qc.invalidateQueries({ queryKey: qk.folders });
      qc.invalidateQueries({ queryKey: ['folder'] });
      qc.invalidateQueries({ queryKey: qk.home });
    },
  });
}

// ---------- 기록 목록·검색 (커서 무한 스크롤) ----------
/** 조건(q·folderId·keywordIds 등)이 바뀌면 queryKey가 바뀌어 커서가 자동으로 초기화된다. */
export const useRecords = (q: RecordQuery) =>
  useInfiniteQuery({
    queryKey: qk.records(q),
    queryFn: ({ pageParam }) => archive.listRecords(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor ?? undefined : undefined),
  });

export const useRecordKeywords = (q: RecordQuery) =>
  useQuery({
    queryKey: qk.keywords(q),
    queryFn: () => archive.listRecordKeywords({ q: q.q, folderId: q.folderId, keywordIds: q.keywordIds, playlistGroupId: q.playlistGroupId }),
    placeholderData: (prev) => prev,
  });

// ---------- 폴더 ----------
export const useFolders = () => useQuery({ queryKey: qk.folders, queryFn: () => archive.listFolders() });
export const useFolder = (folderId: string) =>
  useQuery({ queryKey: qk.folder(folderId), queryFn: () => archive.getFolder(folderId), enabled: !!folderId });
export const usePlaylistGroups = () => useQuery({ queryKey: qk.playlistGroups, queryFn: () => archive.listPlaylistGroups() });
export const useHome = () => useQuery({ queryKey: qk.home, queryFn: archive.getHome });

function useInvalidateFolders() {
  const qc = useQueryClient();
  return (folderId?: string) => {
    qc.invalidateQueries({ queryKey: qk.folders });
    if (folderId) qc.invalidateQueries({ queryKey: qk.folder(folderId) });
    qc.invalidateQueries({ queryKey: ['records'] });
    qc.invalidateQueries({ queryKey: ['record-keywords'] });
    qc.invalidateQueries({ queryKey: ['record'] });
  };
}

export function useCreateFolder() {
  const inv = useInvalidateFolders();
  return useMutation({ mutationFn: (v: { name: string; idempotencyKey: string }) => archive.createFolder(v.name, v.idempotencyKey), onSuccess: () => inv() });
}
export function useRenameFolder() {
  const inv = useInvalidateFolders();
  return useMutation({ mutationFn: (v: { folderId: string; name: string }) => archive.renameFolder(v.folderId, v.name), onSuccess: (_d, v) => inv(v.folderId) });
}
export function useDeleteFolder() {
  const inv = useInvalidateFolders();
  return useMutation({ mutationFn: (folderId: string) => archive.deleteFolder(folderId), onSuccess: () => inv() });
}
export function useAddRecordsToFolder() {
  const qc = useQueryClient();
  const inv = useInvalidateFolders();
  return useMutation({
    mutationFn: (v: { folderId: string; recordIds: string[] }) => archive.addRecordsToFolder(v.folderId, v.recordIds),
    onSuccess: ({ folderId, recordCount }) => {
      qc.setQueryData<Folder>(qk.folder(folderId), (folder) => folder && { ...folder, recordCount });
      qc.setQueryData<CursorPage<Folder>>(qk.folders, (page) => page && {
        ...page,
        items: page.items.map((folder) => folder.folderId === folderId ? { ...folder, recordCount } : folder),
      });
      inv(folderId);
    },
  });
}
export function useRemoveRecordFromFolder() {
  const inv = useInvalidateFolders();
  return useMutation({ mutationFn: (v: { folderId: string; recordId: string }) => archive.removeRecordFromFolder(v.folderId, v.recordId), onSuccess: (_d, v) => inv(v.folderId) });
}

// ---------- 채팅 ----------
export const useConversations = () => useQuery({ queryKey: qk.conversations, queryFn: () => chat.listConversations() });
export const useConversation = (id: string) =>
  useQuery({ queryKey: qk.conversation(id), queryFn: () => chat.getConversation(id), enabled: !!id });
export const useMessages = (id: string) =>
  useQuery({ queryKey: qk.messages(id), queryFn: () => chat.listMessages(id), enabled: !!id });

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { scope: ChatScope; idempotencyKey: string }) => chat.createConversation(v.scope, v.idempotencyKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.conversations }),
  });
}
export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => chat.deleteConversation(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk.conversations }) });
}
