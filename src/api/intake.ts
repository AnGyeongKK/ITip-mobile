// A 파트 API (명세: IMPORT-01/02, ANALYSIS-01/02/07/08/09, UPLOAD-01~03)
// 시연에서는 인증 헤더를 보내지 않는다. 로그인이 들어오면 client.ts의 setAccessTokenProvider로 붙는다.
import { ApiError, cleanParams, delay, newIdempotencyKey, request, USE_MOCK } from './client';
import { records } from './mock/db';
import type { Id, Video } from './types';

// ---------- IMPORT-01 링크 확인 ----------
export type ExistingStatus = 'NONE' | 'PROCESSING' | 'COMPLETED';
export interface Existing {
  status: ExistingStatus;
  analysisId: Id | null;
  recordId: Id | null;
  jobId: Id | null;
}
export type YoutubeResource =
  | {
      type: 'VIDEO';
      videoId: string;
      canonicalUrl: string;
      metadata: Video | null; // null이면 정보 확인 중/실패. 빈 값으로 꾸미지 않는다
      existing: Existing;
      captionRequirement: { language: string; maxDurationMs: number };
    }
  | { type: 'PLAYLIST'; playlistId: string; canonicalUrl: string };

// ---------- IMPORT-02 재생목록 ----------
export type Eligibility = 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN'; // UNKNOWN은 분석 가능/불가로 단정하지 않는다
export interface PlaylistItem {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string | null;
  durationMs: number | null;
  eligibility: Eligibility;
  reasonCode: string | null; // DURATION_EXCEEDED, VIDEO_UNAVAILABLE 등
  existing: Existing;
}
export interface PlaylistPage {
  playlistId: string;
  title: string;
  items: PlaylistItem[];
  nextCursor: string | null;
  hasNext: boolean;
  thumbnailUrl: string | null;
  channelName: string | null;
  totalItemCount: number | null;
  eligibilityCounts: { eligible: number; ineligible: number; unknown: number } | null;
}

// ---------- ANALYSIS-07/08 배치 ----------
export type ItemStatus = 'AWAITING_UPLOAD' | 'QUEUED' | 'PROCESSING' | 'RETRY_WAIT' | 'COMPLETED' | 'FAILED';
export type BatchStatusCode = 'PREPARING' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_FAILED' | 'FAILED';
export type Stage = 'VALIDATING' | 'SUMMARIZING' | 'INDEXING' | 'FINISHING';
export type ItemAction = 'COLLECT_CAPTIONS' | 'OPEN_RESULT' | 'OPEN_JOB';

export interface ItemError { code: string; message: string; retryable: boolean }

export interface CreatedBatchItem {
  itemId: Id;
  videoId: string;
  action: ItemAction;
  status: ItemStatus;
  jobId: Id | null;
  analysisId: Id | null;
  recordId: Id | null;
  uploadDeadlineAt: string | null;
}
export interface CreatedBatch {
  batchId: Id;
  status: BatchStatusCode;
  items: CreatedBatchItem[];
  selectionSummary: { uniqueVideoCount: number; newAnalysisCount: number; existingResultCount: number; existingJobCount: number };
}

export interface BatchItem {
  itemId: Id;
  videoId: string;
  status: ItemStatus;
  jobId: Id | null;
  analysisId: Id | null;
  recordId: Id | null;
  error: ItemError | null;
  video: Video | null;
  stage: Stage | null;
  uploadDeadlineAt: string | null;
}
export interface Batch {
  batchId: Id;
  status: BatchStatusCode;
  counts: { total: number; awaitingUpload: number; queued: number; processing: number; retryWait: number; completed: number; failed: number };
  items: BatchItem[];
  nextPollAfterMs: number | null; // 종료 상태는 null
  playlist: { playlistId: string; title: string; channelName: string | null; thumbnailUrl: string | null; totalItemCount: number | null } | null;
}

export const isBatchDone = (b: Pick<Batch, 'status'>) => b.status === 'COMPLETED' || b.status === 'PARTIALLY_FAILED' || b.status === 'FAILED';
export function canCollectCaption(item: BatchItem): item is BatchItem & { uploadDeadlineAt: string } {
  return item.status === 'AWAITING_UPLOAD' && !item.jobId && item.uploadDeadlineAt !== null &&
    Date.parse(item.uploadDeadlineAt) > Date.now();
}

/** 진행 화면의 4단계(영상 확인 → 확인 완료 → 내용 확인 → AI 정리). 서버가 주는 값이 아니라 앱이 항목 상태로 매핑한 추측. */
export function overallStep(b: Batch): 1 | 2 | 3 | 4 {
  const rank = (it: BatchItem): 1 | 2 | 3 | 4 =>
    it.status === 'AWAITING_UPLOAD' ? 1 : it.status === 'QUEUED' || it.status === 'RETRY_WAIT' ? 2 : it.stage === 'VALIDATING' ? 3 : 4;
  const active = b.items.filter((i) => i.status !== 'COMPLETED' && i.status !== 'FAILED');
  return active.length === 0 ? 4 : (Math.min(...active.map(rank)) as 1 | 2 | 3 | 4);
}

// ---------- ANALYSIS-02 영상별 작업 ----------
export interface Job {
  jobId: Id;
  batchId: Id;
  videoId: string;
  status: 'QUEUED' | 'PROCESSING' | 'RETRY_WAIT' | 'COMPLETED' | 'FAILED';
  stage: Stage | null;
  analysisId: Id | null;
  recordId: Id | null;
  error: ItemError | null;
  nextPollAfterMs: number | null;
  video: Video | null;
}

export type RetriedJob = Pick<Job, 'jobId' | 'batchId' | 'status'> & { previousJobId: Id; statusUrl: string };

// ---------- UPLOAD / ANALYSIS-01 / ANALYSIS-09 ----------
export interface CaptionSegment { startMs: number; endMs: number; text: string }
export interface CaptionFile { videoId: string; language: 'ko'; segments: CaptionSegment[] }

export type CollectionFailureCode =
  | 'KOREAN_CAPTION_NOT_FOUND' | 'VIDEO_UNAVAILABLE' | 'DURATION_EXCEEDED' | 'COLLECTION_RATE_LIMITED' | 'UPLOAD_FAILED';

interface UploadTicket {
  uploadId: Id;
  method: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}

/** GCS 업로드 실패. 403이면 서명 URL 만료라 UPLOAD-01부터 다시 한다. */
export class UploadError extends Error {
  constructor(public status: number | null) { super(`UPLOAD_${status ?? 'NETWORK'}`); }
  get expired() { return this.status === 403; }
}

// ---------- mock ----------
interface MockItem { itemId: string; videoId: string; existing: boolean; submittedAt: number | null; failure: CollectionFailureCode | null }
const mockBatches = new Map<string, { createdAt: number; items: MockItem[] }>();
const mockVideo = (videoId: string, i = 0): Video => ({
  videoId, title: `예시 영상 ${videoId}`, channelName: '예시 채널',
  thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  durationMs: (10 + i * 7) * 60_000, channelImageUrl: null, publishedAt: null,
});
const NONE: Existing = { status: 'NONE', analysisId: null, recordId: null, jobId: null };

// ---------- API ----------
export async function importResource(url: string): Promise<YoutubeResource> {
  if (USE_MOCK) {
    await delay(500);
    const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,})/)?.[1] ?? 'unknown';
    const exist = records.find((r) => r.video.videoId === videoId);
    return {
      type: 'VIDEO', videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      metadata: exist?.video ?? mockVideo(videoId),
      existing: exist ? { status: 'COMPLETED', analysisId: exist.analysisId, recordId: exist.recordId, jobId: null } : NONE,
      captionRequirement: { language: 'ko', maxDurationMs: 3_600_000 },
    };
  }
  return request<YoutubeResource>({ method: 'GET', url: '/api/v1/youtube-resources', params: { url } });
}

export async function getPlaylistItems(playlistId: string, cursor?: string): Promise<PlaylistPage> {
  if (USE_MOCK) {
    await delay(500);
    const page = cursor ? 1 : 0;
    const mk = (id: string, i: number, eligibility: Eligibility = 'UNKNOWN', reasonCode: string | null = null): PlaylistItem => ({
      videoId: id, title: `예시 영상 ${id}`, channelName: '예시 채널', thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      durationMs: (10 + i * 7) * 60_000, eligibility, reasonCode, existing: NONE,
    });
    const first = records[0];
    const items = page === 0
      ? [mk('pl-aaaaaa1', 0), mk('pl-aaaaaa2', 1), mk('pl-aaaaaa3', 8, 'INELIGIBLE', 'DURATION_EXCEEDED'),
         { ...mk(first.video.videoId, 3), title: first.video.title, existing: { status: 'COMPLETED' as const, analysisId: first.analysisId, recordId: first.recordId, jobId: null } }]
      : [mk('pl-bbbbbb1', 0), mk('pl-bbbbbb2', 1)];
    return {
      playlistId, title: '예시 재생목록', items, nextCursor: page === 0 ? 'p2' : null, hasNext: page === 0,
      thumbnailUrl: null, channelName: '예시 재생목록 채널', totalItemCount: 6, eligibilityCounts: null,
    };
  }
  return request<PlaylistPage>({
    method: 'GET', url: `/api/v1/youtube-playlists/${playlistId}/items`, params: cleanParams({ cursor, limit: 20 }),
  });
}

/** ANALYSIS-07. 새 사용자 동작마다 새 키를 쓴다. */
export async function createBatch(videoIds: string[], playlistId: string | null = null): Promise<CreatedBatch> {
  const idempotencyKey = newIdempotencyKey();
  if (USE_MOCK) {
    await delay(400);
    const unique = [...new Set(videoIds)];
    const created = Date.now();
    const items: MockItem[] = unique.map((videoId, i) => ({
      itemId: `i-${i + 1}`, videoId, existing: records.some((r) => r.video.videoId === videoId), submittedAt: null, failure: null,
    }));
    const newItems = items.filter((i) => !i.existing);
    const batchId = `b-${idempotencyKey.slice(0, 8)}`;
    mockBatches.set(batchId, { createdAt: created, items });
    return {
      batchId, status: 'PREPARING',
      items: items.map((m) => {
        const rec = records.find((r) => r.video.videoId === m.videoId);
        return {
          itemId: m.itemId, videoId: m.videoId, action: m.existing ? 'OPEN_RESULT' : 'COLLECT_CAPTIONS',
          status: m.existing ? 'COMPLETED' : 'AWAITING_UPLOAD', jobId: null,
          analysisId: rec?.analysisId ?? null, recordId: rec?.recordId ?? null,
          uploadDeadlineAt: m.existing ? null : new Date(created + 30 * 60_000).toISOString(),
        } as CreatedBatchItem;
      }),
      selectionSummary: { uniqueVideoCount: unique.length, newAnalysisCount: newItems.length, existingResultCount: unique.length - newItems.length, existingJobCount: 0 },
    };
  }
  return request<CreatedBatch>({
    method: 'POST', url: '/api/v1/analysis-batches', data: { videoIds, playlistId },
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export async function getBatch(batchId: Id): Promise<Batch> {
  if (USE_MOCK) {
    await delay(250);
    const b = mockBatches.get(batchId);
    if (!b) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    const now = Date.now();
    const items: BatchItem[] = b.items.map((m) => {
      const rec = records.find((r) => r.video.videoId === m.videoId);
      const base: BatchItem = {
        itemId: m.itemId, videoId: m.videoId, status: 'AWAITING_UPLOAD', jobId: null, analysisId: null, recordId: null,
        error: null, video: rec?.video ?? mockVideo(m.videoId), stage: null, uploadDeadlineAt: null,
      };
      if (m.existing) return { ...base, status: 'COMPLETED', analysisId: rec?.analysisId ?? null, recordId: rec?.recordId ?? null };
      if (m.failure) return { ...base, status: 'FAILED', error: { code: m.failure, message: '분석할 수 없는 영상이에요.', retryable: false } };
      if (m.submittedAt === null) return { ...base, uploadDeadlineAt: new Date(b.createdAt + 30 * 60_000).toISOString() };
      const t = now - m.submittedAt;
      const job = { ...base, jobId: `j-${m.itemId}` };
      if (t < 2000) return { ...job, status: 'QUEUED' };
      if (t < 5000) return { ...job, status: 'PROCESSING', stage: 'VALIDATING' };
      if (t < 9000) return { ...job, status: 'PROCESSING', stage: 'SUMMARIZING' };
      if (t < 12000) return { ...job, status: 'PROCESSING', stage: 'INDEXING' };
      if (t < 14000) return { ...job, status: 'PROCESSING', stage: 'FINISHING' };
      return { ...job, status: 'COMPLETED', analysisId: 'a-dev-growth', recordId: 'r-dev-growth' };
    });
    const c = (s: ItemStatus) => items.filter((i) => i.status === s).length;
    const counts = {
      total: items.length, awaitingUpload: c('AWAITING_UPLOAD'), queued: c('QUEUED'), processing: c('PROCESSING'),
      retryWait: c('RETRY_WAIT'), completed: c('COMPLETED'), failed: c('FAILED'),
    };
    const finished = counts.completed + counts.failed === counts.total;
    const status: BatchStatusCode = finished
      ? (counts.failed === 0 ? 'COMPLETED' : counts.completed === 0 ? 'FAILED' : 'PARTIALLY_FAILED')
      : counts.processing + counts.queued + counts.retryWait === 0 ? 'PREPARING' : 'PROCESSING';
    return { batchId, status, counts, items, nextPollAfterMs: finished ? null : 3000, playlist: null };
  }
  return request<Batch>({ method: 'GET', url: `/api/v1/analysis-batches/${batchId}` });
}

/** ANALYSIS-02. 기존 분석이 PROCESSING이면 jobId만 오므로, 여기서 batchId를 얻어 진행 화면으로 보낸다. */
export async function getJob(jobId: Id): Promise<Job> {
  if (USE_MOCK) {
    await delay(250);
    return { jobId, batchId: 'b-mock', videoId: 'unknown', status: 'PROCESSING', stage: 'SUMMARIZING', analysisId: null, recordId: null, error: null, nextPollAfterMs: 3000, video: null };
  }
  return request<Job>({ method: 'GET', url: `/api/v1/analysis-jobs/${jobId}` });
}

export async function retryJob(jobId: Id, idempotencyKey: string): Promise<RetriedJob> {
  if (USE_MOCK) throw new ApiError(409, 'JOB_NOT_RETRYABLE', '현재 재시도할 수 없는 분석이에요.');
  return request({
    method: 'POST', url: `/api/v1/analysis-jobs/${jobId}/retries`, data: {},
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

/** UPLOAD-01 서명 URL 발급 */
async function issueUpload(batchId: Id, itemId: Id, videoId: string, sizeBytes: number): Promise<UploadTicket> {
  return request<UploadTicket>({
    method: 'POST', url: '/api/v1/caption-uploads',
    data: { batchId, batchItemId: itemId, videoId, contentType: 'application/json', sizeBytes },
  });
}

/** UPLOAD-02 GCS PUT. YouSum 토큰은 보내지 않으므로 axios 인스턴스가 아니라 fetch를 쓴다. 응답 본문은 파싱하지 않는다. */
async function putToGcs(t: UploadTicket, body: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(t.uploadUrl, { method: t.method, headers: t.headers, body });
  } catch {
    throw new UploadError(null);
  }
  if (!res.ok) throw new UploadError(res.status);
}

/** ANALYSIS-01 분석 접수 (uploadId만 전달) */
async function submitJob(batchId: Id, itemId: Id, uploadId: Id, idempotencyKey: string): Promise<{ jobId: Id }> {
  return request<{ jobId: Id }>({
    method: 'POST', url: '/api/v1/analysis-jobs',
    data: { batchId, batchItemId: itemId, uploadId },
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

/** 자막 한 건을 접수까지 진행: 발급 → PUT → 접수. 서명 URL이 만료(403)되면 한 번만 다시 발급받는다. */
export async function submitCaptions(batchId: Id, itemId: Id, caption: CaptionFile): Promise<{ jobId: Id }> {
  if (USE_MOCK) {
    await delay(600);
    const m = mockBatches.get(batchId)?.items.find((i) => i.itemId === itemId);
    if (m) m.submittedAt = Date.now();
    return { jobId: `j-${itemId}` };
  }
  const body = JSON.stringify(caption);
  const sizeBytes = new TextEncoder().encode(body).length; // UTF-8 바이트 길이
  let ticket = await issueUpload(batchId, itemId, caption.videoId, sizeBytes);
  try {
    await putToGcs(ticket, body);
  } catch (e) {
    if (!(e instanceof UploadError && e.expired)) throw e;
    ticket = await issueUpload(batchId, itemId, caption.videoId, sizeBytes);
    await putToGcs(ticket, body);
  }
  const key = newIdempotencyKey();
  try {
    return await submitJob(batchId, itemId, ticket.uploadId, key);
  } catch (e) {
    if (!(e instanceof ApiError && (e.isNetwork || (e.status ?? 0) >= 500))) throw e;
    return submitJob(batchId, itemId, ticket.uploadId, key);
  }
}

/** ANALYSIS-09 수집·업로드 실패 보고 (AWAITING_UPLOAD 항목만. 취소 기능이 아니다) */
export async function reportCollectFail(batchId: Id, itemId: Id, code: CollectionFailureCode): Promise<void> {
  if (USE_MOCK) {
    const m = mockBatches.get(batchId)?.items.find((i) => i.itemId === itemId);
    if (m) m.failure = code;
    return;
  }
  await request({
    method: 'PATCH', url: `/api/v1/analysis-batches/${batchId}/items/${itemId}`,
    data: { collectionFailure: { code } },
  });
}

export function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60_000);
  return m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${Math.floor(m / 60)}시간`) : `${m}분`;
}
