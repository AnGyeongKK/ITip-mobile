// A 파트 API (명세: IMPORT-01/02, ANALYSIS-01/02/07/08/09, UPLOAD-01~03, 수동 재시도)
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

/** 이 오류가 붙은 영상은 같은 입력을 자동으로 다시 분석하지 않고, 새로 자막을 수집해야 한다. */
const RECOLLECT_CODES = ['CAPTION_REUPLOAD_REQUIRED', 'CAPTION_UPLOAD_EXPIRED', 'COLLECTION_RATE_LIMITED'];
/** '자막 다시 수집하기'를 보여줄 항목: 업로드 기한이 지났거나, 원본 자막 유실·수집 제한으로 실패한 영상. retryable이 false여도 표시한다. */
export const needsRecollect = (item: BatchItem) =>
  (item.status === 'AWAITING_UPLOAD' && !canCollectCaption(item)) ||
  (item.status === 'FAILED' && RECOLLECT_CODES.includes(item.error?.code ?? ''));

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

/** 수동 재시도 응답을 화면 이동 경로로 바꾼다. 202는 새 배치로, 200(완료 결과 재사용)은 결과로 간다. */
export type RetryOutcome = { kind: 'RESULT'; analysisId: Id } | { kind: 'BATCH'; batchId: Id };
export async function resolveRetry(r: RetriedJob): Promise<RetryOutcome> {
  if (r.status !== 'COMPLETED') return { kind: 'BATCH', batchId: r.batchId };
  const job = await getJob(r.jobId); // 결과 ID는 작업 조회로 확인한다
  return job.analysisId ? { kind: 'RESULT', analysisId: job.analysisId } : { kind: 'BATCH', batchId: job.batchId || r.batchId };
}

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
// 영상 ID의 앞부분으로 시나리오를 고른다 (mock 모드에서만 동작). 링크 예: https://youtu.be/retryfail001
//   reupload…   분석 실패, 원본 자막 유실(CAPTION_REUPLOAD_REQUIRED, retryable:false). 자막을 다시 수집한 새 배치에서는 성공
//   retryfail…  분석 실패(retryable:true) → 수동 재시도 202(새 배치)
//   retry200…   분석 실패(retryable:true) → 수동 재시도 200(완료 결과 재사용)
//   retry410…   분석 실패(retryable:true) → 수동 재시도 410(자막 재수집 필요). 재수집한 새 배치에서는 성공
//   failx…      분석 실패(retryable:false)
//   missing…    링크 조회 404(접근 불가)   lookupfail…  링크 조회 500(일시 장애)
//   inprogress… 링크 조회 시 이미 분석 중(PROCESSING)
interface MockItem {
  itemId: string;
  videoId: string;
  existing: boolean;
  submittedAt: number | null;
  failure: CollectionFailureCode | null;
  forceSuccess?: boolean;
}
interface MockBatch { createdAt: number; items: MockItem[]; playlist?: Batch['playlist'] }
const mockBatches = new Map<string, MockBatch>();

const SEED_PROCESSING = 'b-processing-1'; // 재생목록·링크에서 '이미 분석 중'으로 보이는 배치
const mockJobId = (batchId: string, itemId: string) => `j-${batchId}~${itemId}`;
const parseMockJob = (jobId: string) => {
  const m = /^j-(.+)~(.+)$/.exec(jobId);
  return m ? { batchId: m[1], itemId: m[2] } : null;
};
function mockBatch(batchId: string): MockBatch | undefined {
  if (batchId === SEED_PROCESSING && !mockBatches.has(batchId)) {
    const now = Date.now();
    mockBatches.set(batchId, {
      createdAt: now,
      items: [{ itemId: 'i-1', videoId: 'pl-processing1', existing: false, submittedAt: now, failure: null }],
    });
  }
  return mockBatches.get(batchId);
}

type Scenario = 'ok' | 'reupload' | 'retryfail' | 'retry200' | 'retry410' | 'failx';
const scenarioOf = (videoId: string): Scenario =>
  (['reupload', 'retryfail', 'retry200', 'retry410', 'failx'] as const).find((p) => videoId.startsWith(p)) ?? 'ok';
/** 자막을 다시 수집한 새 배치에서는 성공하는 시나리오 */
const RECOLLECT_SCENARIOS: Scenario[] = ['reupload', 'retry410'];
const RETRYABLE_ERROR: ItemError = { code: 'ANALYSIS_FAILED', message: '분석 중 문제가 생겼어요.', retryable: true };
const FAILURES: Record<Exclude<Scenario, 'ok'>, ItemError> = {
  reupload: { code: 'CAPTION_REUPLOAD_REQUIRED', message: '자막 파일을 읽을 수 없어요.', retryable: false },
  retryfail: RETRYABLE_ERROR,
  retry200: RETRYABLE_ERROR,
  retry410: RETRYABLE_ERROR,
  failx: { code: 'ANALYSIS_FAILED', message: '분석에 실패했어요.', retryable: false },
};

// 재생목록 mock의 영상 길이(분). 목록·분석 진행 화면이 같은 길이를 보여주도록 영상 ID로 정한다.
const MOCK_MINUTES: Record<string, number> = {
  'pl-aaaaaa1': 10, 'pl-aaaaaa2': 17, 'pl-aaaaaa3': 66, 'pl-processing1': 24,
  'pl-bbbbbb1': 10, 'pl-bbbbbb2': 17, 'failx000001': 24,
};
const mockVideo = (videoId: string, i = 0): Video => ({
  videoId, title: `예시 영상 ${videoId}`, channelName: '예시 채널',
  thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    durationMs: (MOCK_MINUTES[videoId] ?? 10 + i * 7) * 60_000, channelImageUrl: null, publishedAt: null,
});
const NONE: Existing = { status: 'NONE', analysisId: null, recordId: null, jobId: null };

/** mock 항목의 현재 상태를 시간 경과로 계산한다. */
function deriveItem(batchId: string, b: MockBatch, m: MockItem, now: number): BatchItem {
  const rec = records.find((r) => r.video.videoId === m.videoId);
  const base: BatchItem = {
    itemId: m.itemId, videoId: m.videoId, status: 'AWAITING_UPLOAD', jobId: null, analysisId: null, recordId: null,
    error: null, video: rec?.video ?? mockVideo(m.videoId), stage: null, uploadDeadlineAt: null,
  };
  if (m.existing) return { ...base, status: 'COMPLETED', analysisId: rec?.analysisId ?? null, recordId: rec?.recordId ?? null };
  if (m.failure) return { ...base, status: 'FAILED', error: { code: m.failure, message: '분석할 수 없는 영상이에요.', retryable: false } };
  if (m.submittedAt === null) return { ...base, uploadDeadlineAt: new Date(b.createdAt + 30 * 60_000).toISOString() };
  const t = now - m.submittedAt;
  const job: BatchItem = { ...base, jobId: mockJobId(batchId, m.itemId) };
  const scenario = m.forceSuccess ? 'ok' : scenarioOf(m.videoId);
  if (scenario !== 'ok' && t >= 6000) return { ...job, status: 'FAILED', error: FAILURES[scenario] };
  if (t < 2000) return { ...job, status: 'QUEUED' };
  if (t < 5000) return { ...job, status: 'PROCESSING', stage: 'VALIDATING' };
  if (t < 9000) return { ...job, status: 'PROCESSING', stage: 'SUMMARIZING' };
  if (t < 12000) return { ...job, status: 'PROCESSING', stage: 'INDEXING' };
  if (t < 14000) return { ...job, status: 'PROCESSING', stage: 'FINISHING' };
  return { ...job, status: 'COMPLETED', analysisId: 'a-dev-growth', recordId: 'r-dev-growth' };
}

// ---------- API ----------
export async function importResource(url: string): Promise<YoutubeResource> {
  if (USE_MOCK) {
    await delay(500);
    const videoId = url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,})/)?.[1] ?? 'unknown';
    if (videoId.startsWith('missing')) throw new ApiError(404, 'VIDEO_UNAVAILABLE', '접근할 수 없는 영상이에요.');
    if (videoId.startsWith('lookupfail')) throw new ApiError(500, 'INTERNAL_ERROR', '요청을 처리하지 못했어요.');
    const exist = records.find((r) => r.video.videoId === videoId);
    const existing: Existing = exist
      ? { status: 'COMPLETED', analysisId: exist.analysisId, recordId: exist.recordId, jobId: null }
      : videoId.startsWith('inprogress')
        ? { status: 'PROCESSING', analysisId: null, recordId: null, jobId: mockJobId(SEED_PROCESSING, 'i-1') }
        : NONE;
    return {
      type: 'VIDEO', videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      metadata: exist?.video ?? mockVideo(videoId),
      existing,
      captionRequirement: { language: 'ko', maxDurationMs: 3_600_000 },
    };
  }
  try {
    return await request<YoutubeResource>({ method: 'GET', url: '/api/v1/youtube-resources', params: { url } });
  } catch (e) {
    // 이 조회의 404는 영상 접근 불가다. 다른 API의 404에는 이 문구를 쓰지 않는다.
    if (e instanceof ApiError && e.isNotFound) throw new ApiError(404, 'VIDEO_UNAVAILABLE', '접근할 수 없는 영상이에요.', e.requestId);
    throw e;
  }
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
    const items: PlaylistItem[] = page === 0
      ? [
        mk('pl-aaaaaa1', 0), mk('pl-aaaaaa2', 1), mk('pl-aaaaaa3', 8, 'INELIGIBLE', 'DURATION_EXCEEDED'),
        { ...mk(first.video.videoId, 3), title: first.video.title, existing: { status: 'COMPLETED' as const, analysisId: first.analysisId, recordId: first.recordId, jobId: null } },
        { ...mk('pl-processing1', 2), title: '분석 중인 예시 영상', existing: { status: 'PROCESSING' as const, analysisId: null, recordId: null, jobId: mockJobId(SEED_PROCESSING, 'i-1') } },
      ]
      : [mk('pl-bbbbbb1', 0), mk('pl-bbbbbb2', 1), mk('failx000001', 2)]; // failx…는 분석이 실패해 부분 실패 배치를 만든다
    return {
      playlistId, title: '예시 재생목록', items, nextCursor: page === 0 ? 'p2' : null, hasNext: page === 0,
      thumbnailUrl: null, channelName: '예시 재생목록 채널', totalItemCount: 8, eligibilityCounts: null,
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
    const previous = Array.from(mockBatches.values());
    const items: MockItem[] = unique.map((videoId, i) => ({
      itemId: `i-${i + 1}`, videoId, existing: records.some((r) => r.video.videoId === videoId), submittedAt: null, failure: null,
      // 같은 영상을 다시 수집해 만든 배치(재수집)에서는 성공하는 시나리오가 있다
      forceSuccess: RECOLLECT_SCENARIOS.includes(scenarioOf(videoId)) &&
        previous.some((mb) => mb.items.some((x) => x.videoId === videoId)),
    }));
    const newItems = items.filter((i) => !i.existing);
    const batchId = `b-${idempotencyKey.slice(0, 8)}`;
    mockBatches.set(batchId, {
      createdAt: created, items,
      playlist: playlistId
        ? { playlistId, title: '예시 재생목록', channelName: '예시 재생목록 채널', thumbnailUrl: null, totalItemCount: items.length }
        : undefined,
    });
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
    const b = mockBatch(batchId);
    if (!b) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    const now = Date.now();
    const items = b.items.map((m) => deriveItem(batchId, b, m, now));
    const c = (s: ItemStatus) => items.filter((i) => i.status === s).length;
    const counts = {
      total: items.length, awaitingUpload: c('AWAITING_UPLOAD'), queued: c('QUEUED'), processing: c('PROCESSING'),
      retryWait: c('RETRY_WAIT'), completed: c('COMPLETED'), failed: c('FAILED'),
    };
    const finished = counts.completed + counts.failed === counts.total;
    const status: BatchStatusCode = finished
      ? (counts.failed === 0 ? 'COMPLETED' : counts.completed === 0 ? 'FAILED' : 'PARTIALLY_FAILED')
      : counts.processing + counts.queued + counts.retryWait === 0 ? 'PREPARING' : 'PROCESSING';
    return { batchId, status, counts, items, nextPollAfterMs: finished ? null : 3000, playlist: b.playlist ?? null };
  }
  return request<Batch>({ method: 'GET', url: `/api/v1/analysis-batches/${batchId}` });
}

/** ANALYSIS-02. 기존 분석이 PROCESSING이면 jobId만 오므로, 여기서 batchId를 얻어 진행 화면으로 보낸다. */
export async function getJob(jobId: Id): Promise<Job> {
  if (USE_MOCK) {
    await delay(250);
    const ref = parseMockJob(jobId);
    const b = ref ? mockBatch(ref.batchId) : undefined;
    const m = ref ? b?.items.find((i) => i.itemId === ref.itemId) : undefined;
    if (!ref || !b || !m) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    const it = deriveItem(ref.batchId, b, m, Date.now());
    const done = it.status === 'COMPLETED' || it.status === 'FAILED';
    return {
      jobId, batchId: ref.batchId, videoId: m.videoId,
      status: (it.status === 'AWAITING_UPLOAD' ? 'QUEUED' : it.status) as Job['status'],
      stage: it.stage, analysisId: it.analysisId, recordId: it.recordId, error: it.error,
      nextPollAfterMs: done ? null : 3000, video: it.video,
    };
  }
  return request<Job>({ method: 'GET', url: `/api/v1/analysis-jobs/${jobId}` });
}

/** 서버 작업 수동 재시도. 202는 새 배치, 200은 완료 결과 재사용, 410(CAPTION_REUPLOAD_REQUIRED)은 자막 재수집이 필요하다. */
export async function retryJob(jobId: Id, idempotencyKey: string): Promise<RetriedJob> {
  if (USE_MOCK) {
    await delay(400);
    const ref = parseMockJob(jobId);
    const b = ref ? mockBatch(ref.batchId) : undefined;
    const m = ref ? b?.items.find((i) => i.itemId === ref.itemId) : undefined;
    if (!ref || !b || !m) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    const scenario = scenarioOf(m.videoId);
    if (m.forceSuccess || scenario === 'ok' || scenario === 'reupload' || scenario === 'failx') {
      throw new ApiError(409, 'JOB_NOT_RETRYABLE', '현재 재시도할 수 없는 분석이에요.');
    }
    if (scenario === 'retry410') throw new ApiError(410, 'CAPTION_REUPLOAD_REQUIRED', '자막 파일을 읽을 수 없어요.');
    if (scenario === 'retry200') {
      m.forceSuccess = true; // 이미 완료된 결과를 재사용한다
      m.submittedAt = Date.now() - 20_000;
      return { jobId, batchId: ref.batchId, status: 'COMPLETED', previousJobId: jobId, statusUrl: `/api/v1/analysis-jobs/${jobId}` };
    }
    const batchId = `b-${idempotencyKey.slice(0, 8)}`; // retryfail: 202, 새 배치에서 성공한다
    mockBatches.set(batchId, {
      createdAt: Date.now(),
      items: [{ itemId: 'i-1', videoId: m.videoId, existing: false, submittedAt: Date.now(), failure: null, forceSuccess: true }],
    });
    const newJobId = mockJobId(batchId, 'i-1');
    return { jobId: newJobId, batchId, status: 'QUEUED', previousJobId: jobId, statusUrl: `/api/v1/analysis-jobs/${newJobId}` };
  }
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
    const m = mockBatch(batchId)?.items.find((i) => i.itemId === itemId);
    if (m) m.submittedAt = Date.now();
    return { jobId: mockJobId(batchId, itemId) };
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
    const m = mockBatch(batchId)?.items.find((i) => i.itemId === itemId);
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