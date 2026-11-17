// API 명세서-유튜브 요약 (노션) 기준 타입. B 파트에서 쓰는 응답만 정의한다.
// 서버 ID는 모두 문자열(UUID)이다. 시간은 ISO 8601 UTC, 영상 시간은 밀리초.

export type Id = string;

/** 공통 응답 래퍼. 오류일 때는 data가 없다. */
export interface ApiResponse<T> {
  code: string;
  message: string;
  data?: T;
}

/** 커서 목록 공통 형태 */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export type Origin = 'SOURCE' | 'AI_SUGGESTION';

export interface Video {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string | null;
  durationMs: number | null;
  channelImageUrl: string | null;
  publishedAt: string | null;
}

export interface Keyword {
  keywordId: Id;
  name: string;
}

export interface OriginText {
  text: string;
  origin: Origin;
}

// ---------- ANALYSIS-04 분석 결과 조회 ----------
export interface AnalysisSummary {
  oneLine: string;
  keyPoints: string[];
  practicalPoints: OriginText[];
  mentionedTools: { name: string }[];
  keywords: Keyword[];
  highlightSectionIds: Id[];
}

export interface AnalysisSection {
  sectionId: Id;
  title: string;
  startMs: number;
  endMs: number;
  summary: string;
  subtopics: string[];
  keywords: Keyword[];
}

export interface Analysis {
  analysisId: Id;
  recordId: Id;
  status: string;
  schemaVersion: string;
  video: Video;
  summary: AnalysisSummary;
  sections: AnalysisSection[];
  mindmap: { rootTitle: string; sectionIds: Id[] };
  chatReady: boolean;
  analyzedAt: string;
  /**
   * ⚠️ 명세에 없는 제안 필드. 피그마 11/06 PARTIAL-NONIT-SUMMARY:
   * IT 외 영상은 요약만 제공하고 마인드맵·상세는 막는다. 서버가 안 보내면 FULL로 본다.
   */
  coverage?: 'FULL' | 'SUMMARY_ONLY';
}

// ---------- ANALYSIS-05 구간 상세 ----------
export interface SectionDetail {
  analysisId: Id;
  recordId: Id;
  sectionId: Id;
  title: string;
  startMs: number;
  endMs: number;
  summary: string;
  subtopics: string[];
  keywords: Keyword[];
  videoId: string;
  originalUrl: string;
  detail: {
    takeaway: string;
    explanation: string;
    applicationTips: OriginText[];
    recommendedTools: { name: string; reason: string; origin: Origin }[];
    usageKeywords: string[];
    examples: OriginText[];
  };
  video: Video;
  videoOneLine: string;
}

// ---------- ANALYSIS-06 관련 영상 추천 ----------
export interface Recommendation {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string | null;
  durationMs: number | null;
  reason: string;
  eligibility: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
}

export interface Recommendations {
  analysisId: Id;
  sectionId: Id;
  status: 'READY' | 'PENDING';
  items: Recommendation[];
}

// ---------- 기록 (ARCHIVE-02/03/04, SEARCH-01) ----------
export type ResultTab = 'SUMMARY' | 'MINDMAP' | 'DETAIL';

export interface ReadingPosition {
  tab: ResultTab;
  sectionId: Id | null;
  positionMs: number | null;
  lastViewedAt: string | null;
}

export interface RecordDetail {
  recordId: Id;
  analysisId: Id;
  video: Video;
  oneLine: string;
  keywords: Keyword[];
  analyzedAt: string;
  folders: { folderId: Id; name: string }[];
  readingPosition: ReadingPosition;
}

export type MatchField = 'TITLE' | 'ONE_LINE' | 'KEYWORD' | 'DETAIL' | 'TECHNOLOGY' | 'TOOL';

export interface RecordItem {
  recordId: Id;
  analysisId: Id;
  video: Video;
  oneLine: string;
  keywords: Keyword[];
  analyzedAt: string;
  matches: { field: MatchField; text: string; sectionId: Id | null }[];
  folderMembership: { folderId: Id; included: boolean } | null;
}

export interface RecordPage extends CursorPage<RecordItem> {
  matchedCount: number;
  filters: { q: string | null; folderId: Id | null; keywordIds: Id[]; playlistGroupId: Id | null };
  selectionContext: { targetFolderId: Id | null };
}

export interface RecordQuery {
  q?: string;
  folderId?: Id;
  playlistGroupId?: Id;
  targetFolderId?: Id;
  keywordIds?: Id[];
  limit?: number;
}

// ---------- SEARCH-02 키워드 ----------
export interface KeywordFacet extends Keyword {
  recordCount: number;
  selected: boolean;
}

export interface KeywordFacets {
  keywords: KeywordFacet[];
  matchedCount: number;
}

// ---------- 폴더 (ARCHIVE-05~11) ----------
export interface Folder {
  folderId: Id;
  name: string;
  recordCount: number;
  createdAt: string;
}

export interface AddRecordsResult {
  folderId: Id;
  addedRecordIds: Id[];
  alreadyIncludedRecordIds: Id[];
  recordCount: number;
}

// ---------- 재생목록 그룹 (ARCHIVE-12/13, 연동 협의) ----------
export interface PlaylistGroup {
  groupId: Id;
  playlistId: string;
  name: string;
  recordCount: number;
  updatedAt: string;
  originalUrl?: string;
}

// ---------- 홈 (ARCHIVE-14) : A 파트 홈 화면에서 B 카드로 사용 ----------
export interface HomeData {
  recentAnalyses: (Omit<RecordItem, 'matches' | 'folderMembership'> & { lastViewedAt: string | null })[];
  continueReading: {
    recordId: Id;
    analysisId: Id;
    videoTitle: string;
    tab: ResultTab;
    sectionId: Id;
    sectionTitle: string;
    startMs: number;
    endMs: number;
    positionMs: number | null;
    lastViewedAt: string;
    sectionSummary: string;
    practicalTipCount: number;
  } | null;
}

// ---------- 채팅 (CHAT-01~07) ----------
export type ChatScope =
  | { type: 'ALL' | 'FILTERED'; folderId?: Id | null; keywordIds?: Id[]; q?: string | null }
  | { type: 'RECORD'; recordId: Id; focusSectionId?: Id | null };

export interface Conversation {
  conversationId: Id;
  scope: ChatScope;
  scopeLabel: string;
  recordCount: number;
  createdAt: string;
  updatedAt?: string;
  scopeStatus?: 'AVAILABLE' | 'UNAVAILABLE';
  activeAssistantMessageId: Id | null;
}

export interface ConversationListItem {
  conversationId: Id;
  title: string;
  lastQuestion: string;
  scopeLabel: string;
  activeAssistantMessageId: Id | null;
  updatedAt: string;
}

export interface ChatSource {
  sourceId: string;
  recordId: Id;
  analysisId: Id;
  sectionId: Id | null;
  title: string;
  videoId: string;
  startMs: number;
  endMs: number;
  availability: 'AVAILABLE' | 'DELETED';
  analyzedAt: string;
}

export type AssistantStatus = 'QUEUED' | 'GENERATING' | 'COMPLETED' | 'INCOMPLETE' | 'FAILED';

export interface ChatMessage {
  messageId: Id;
  role: 'USER' | 'ASSISTANT';
  clientRequestId: string;
  content: string;
  createdAt: string;
  // ASSISTANT 전용
  replyToMessageId?: Id;
  status?: AssistantStatus;
  sources?: ChatSource[];
  finishReason?: 'STOP' | 'INSUFFICIENT_EVIDENCE' | 'LENGTH' | string | null;
  completedAt?: string | null;
  error?: { code: string; message: string } | null;
  retryable?: boolean;
  nextPollAfterMs?: number | null;
  scopeRecordCount?: number;
  usedRecordCount?: number;
}

// SSE 이벤트 (CHAT-04)
export interface SseMeta { conversationId: Id; userMessageId: Id; assistantMessageId: Id; clientRequestId: string; scopeRecordCount: number }
export interface SseDelta { assistantMessageId: Id; sequence: number; text: string }
export interface SseSources { assistantMessageId: Id; sources: ChatSource[]; usedRecordCount: number }
export interface SseDone { assistantMessageId: Id; status: string; finishReason: string; usedRecordCount: number }
export interface SseError { assistantMessageId?: Id; status?: 'INCOMPLETE' | 'FAILED'; code: string; message: string; retryable: boolean }

// ---------- PLAN-02 이용 한도 ----------
export interface Entitlements {
  planCode: string;
  analysis: { period: string; limit: number; used: number; reserved: number; remaining: number; resetsAt: string };
  chat: {
    limitsConfigured: boolean;
    dailyLimit: number | null;
    used: number;
    reserved: number;
    remaining: number | null;
    maxAnswerTokens: number | null;
    resetsAt: string | null;
  };
  timeZone: string;
}
