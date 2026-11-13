// ANALYSIS-04/05/06 + ARCHIVE-02/03/04 (결과·구간·추천·기록 상세)
import { ApiError, USE_MOCK, delay, request } from './client';
import * as db from './mock/db';
import type { Analysis, ReadingPosition, RecordDetail, Recommendations, ResultTab, SectionDetail } from './types';

const notFound = () => new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');

export async function getAnalysis(analysisId: string): Promise<Analysis> {
  if (USE_MOCK) {
    await delay();
    const a = db.analyses[analysisId];
    if (!a || !db.records.find((r) => r.analysisId === analysisId)) throw notFound();
    return a;
  }
  return request({ method: 'GET', url: `/api/v1/analyses/${analysisId}` });
}

export async function getSection(analysisId: string, sectionId: string): Promise<SectionDetail> {
  if (USE_MOCK) {
    await delay();
    const s = db.sectionDetails[`${analysisId}/${sectionId}`];
    if (!s) throw notFound();
    return s;
  }
  return request({ method: 'GET', url: `/api/v1/analyses/${analysisId}/sections/${sectionId}` });
}

export async function getRecommendations(analysisId: string, sectionId: string): Promise<Recommendations> {
  if (USE_MOCK) {
    await delay(600);
    return {
      analysisId,
      sectionId,
      status: 'READY',
      items: [
        { videoId: 'rBXWJcr_L1c', title: '안드로이드 앱 개발을 위한 코틀린 기초 001', channelName: '예시 강의 채널', thumbnailUrl: null, durationMs: 1609000, reason: '같은 주제를 실습 위주로 다루는 영상', eligibility: 'UNKNOWN' },
        { videoId: 'M7lc1UVf-VE', title: '코드 리뷰 잘 받는 법', channelName: '예시 개발 채널', thumbnailUrl: null, durationMs: 840000, reason: '구간에서 말한 리뷰 습관을 더 자세히 설명', eligibility: 'ELIGIBLE' },
      ],
    };
  }
  return request({ method: 'GET', url: `/api/v1/analyses/${analysisId}/sections/${sectionId}/recommendations` });
}

export async function getRecord(recordId: string): Promise<RecordDetail> {
  if (USE_MOCK) {
    await delay();
    const r = db.records.find((x) => x.recordId === recordId);
    if (!r) throw notFound();
    const pos = db.readingPositions[recordId];
    return {
      recordId: r.recordId,
      analysisId: r.analysisId,
      video: r.video,
      oneLine: r.oneLine,
      keywords: r.keywords,
      analyzedAt: r.analyzedAt,
      folders: db.folders.filter((f) => db.folderRecords[f.folderId]?.has(recordId)).map((f) => ({ folderId: f.folderId, name: f.name })),
      readingPosition: pos ? { tab: pos.tab, sectionId: pos.sectionId, positionMs: null, lastViewedAt: pos.lastViewedAt } : null,
    };
  }
  return request({ method: 'GET', url: `/api/v1/records/${recordId}` });
}

/** 기록 삭제: 복구 없음. 모든 폴더 연결도 사라지고 기존 대화 텍스트는 유지된다. */
export async function deleteRecord(recordId: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    const i = db.records.findIndex((x) => x.recordId === recordId);
    if (i < 0) throw notFound();
    db.records.splice(i, 1);
    Object.values(db.folderRecords).forEach((set) => set.delete(recordId));
    db.syncFolderCounts();
    return;
  }
  await request({ method: 'DELETE', url: `/api/v1/records/${recordId}` });
}

/** 마지막 열람 탭·구간 저장. positionMs는 재생 위치 복원이 확정되기 전까지 항상 null. */
export async function saveReadingPosition(recordId: string, tab: ResultTab, sectionId: string | null): Promise<ReadingPosition> {
  if (USE_MOCK) {
    const lastViewedAt = new Date().toISOString();
    db.readingPositions[recordId] = { tab, sectionId, lastViewedAt };
    return { tab, sectionId, positionMs: null, lastViewedAt };
  }
  return request({ method: 'PUT', url: `/api/v1/records/${recordId}/reading-position`, data: { tab, sectionId, positionMs: null } });
}
