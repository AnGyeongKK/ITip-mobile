// 백엔드 준비 전 화면 개발용 in-memory 데이터.
// 첫 영상은 노션 'AI' 페이지의 실제 분석 예시(잡플래닛 개발자 영상)를 옮겨 왔다.
// ⚠️ videoId는 재생 확인용 임의 값이다(분석 내용과 다른 영상). 시연은 실제 서버 데이터로 할 것.
import type {
  Analysis, AnalysisSection, ChatMessage, Conversation, Folder, Keyword, RecordItem, SectionDetail, Video,
} from '../types';

const kw = (id: string, name: string): Keyword => ({ keywordId: id, name });
export const KEYWORDS = {
  career: kw('k-career', '개발자 성장'),
  interview: kw('k-interview', '개발자 면접'),
  codingTest: kw('k-codingtest', '코딩 테스트'),
  refactor: kw('k-refactor', '코드 리팩토링'),
  rag: kw('k-rag', 'RAG'),
  llm: kw('k-llm', 'LLM'),
  prompt: kw('k-prompt', '프롬프트'),
  ux: kw('k-ux', 'UX 리서치'),
  kotlin: kw('k-kotlin', '코틀린'),
};

const min = (m: number, s = 0) => (m * 60 + s) * 1000;

type Seed = {
  recordId: string;
  analysisId: string;
  video: Video;
  oneLine: string;
  keyPoints: string[];
  practical: string[];
  tools: string[];
  keywords: Keyword[];
  rootTitle: string;
  analyzedAt: string;
  sections: { title: string; start: number; end: number; summary: string; subtopics: string[]; takeaway: string; tips: { text: string; ai?: boolean }[]; examples: string[] }[];
};

const seeds: Seed[] = [
  {
    recordId: 'r-dev-growth',
    analysisId: 'a-dev-growth',
    video: {
      videoId: 'dQw4w9WgXcQ',
      title: '[잡플래닛 커리어 성장문답] 뽑고 싶은 개발자가 되는 법',
      channelName: '잡플래닛',
      thumbnailUrl: null,
      durationMs: min(16, 27),
      channelImageUrl: null,
      publishedAt: '2026-09-20T00:00:00Z',
    },
    oneLine: '좋은 개발자의 역량과 협업 방식부터 면접 준비, 커리어 경로와 개발팀 구성까지 설명합니다.',
    keyPoints: [
      '읽는 사람과 변경을 고려해 코드를 작성합니다.',
      '문제의 근본 원인을 찾아 지속적으로 배웁니다.',
      '일정과 진행 상황을 공유하고 문제에 공감합니다.',
      '코딩 테스트 문제 풀이와 리팩토링을 함께 연습합니다.',
      '관리자·개발자 트랙과 직무 이동으로 커리어를 탐색합니다.',
    ],
    practical: [
      '버그의 증상뿐 아니라 발생 원인을 확인하고, 해결 과정에서 관련 지식을 넓힙니다.',
      '예상 일정과 지연 가능성을 빠르게 공유하고, 제품이나 비즈니스가 해결하려는 문제를 함께 이해합니다.',
      '코딩 테스트 문제를 반복해서 풀고, 같은 문제와 프로젝트 코드를 리팩토링합니다.',
    ],
    tools: ['AWS'],
    keywords: [KEYWORDS.career, KEYWORDS.interview, KEYWORDS.codingTest, KEYWORDS.refactor],
    rootTitle: '개발자 성장과 커리어',
    analyzedAt: '2026-11-08T05:00:00Z',
    sections: [
      { title: '좋은 코드와 근본 원인', start: 0, end: min(3, 31), summary: '읽는 사람과 변경 가능성을 고려해 코드를 작성하고, 문제가 생기면 근본 원인까지 파고드는 태도를 설명합니다.', subtopics: ['읽기 쉬운 코드', '변경 대응', '원인 분석', '지식 확장'], takeaway: '코드를 읽고 수정할 사람을 고려하며 문제의 원인까지 이해하는 개발자가 꾸준히 성장합니다.', tips: [{ text: '원인까지 확인하기: 버그가 생겼을 때 증상을 없애는 데서 멈추지 말고 발생한 이유를 찾아 수정합니다.' }, { text: '작은 코드 리뷰: 최근 작성한 함수 하나를 골라 변수명과 구조만 따로 검토합니다.', ai: true }], examples: ['데이터베이스가 느릴 때 인덱스를 추가하는 데 그치지 않고, 인덱스의 단점도 함께 살펴봅니다.'] },
      { title: '협업과 예측 가능한 개발자', start: min(3, 31), end: min(6, 40), summary: '협업에서는 일정과 진행 상황을 공유하고, 비즈니스 문제에 공감해 함께 해결책을 찾는 태도가 중요합니다.', subtopics: ['일정 예측', '진행 공유', '문제 공감', '완료 기준'], takeaway: '함께 일하기 좋은 개발자는 일정을 예측하고 진행 상황을 공유하며 문제 해결에 동참합니다.', tips: [{ text: '일정과 변수 공유: 예상 소요 시간과 일정에 영향을 줄 변수를 살피고, 지연 가능성이 생기면 빠르게 알립니다.' }, { text: '완료 조건 정리: 작업을 시작할 때 완료 기준을 짧은 체크리스트로 정리해 팀원과 공유합니다.', ai: true }], examples: ['개발 일정은 양궁처럼 목표만 맞추는 일이 아니라 바람 등 변수를 고려하는 일에 비유됩니다.'] },
      { title: '과제로 보는 개발 역량', start: min(6, 40), end: min(8, 4), summary: '과제에서는 실제 업무와 비슷한 문제를 풀게 하고 코드 구조, 가독성, 테스트, 성능 고민 등을 살펴봅니다.', subtopics: ['실무형 과제', '코드 구조', '유닛 테스트', '성능 고려'], takeaway: '실무와 비슷한 과제를 통해 코드의 완성도와 문제를 고려하는 과정을 살펴봅니다.', tips: [{ text: '테스트와 성능 검토: 유닛 테스트를 확인하고 데이터나 트래픽이 늘어날 때 생길 문제도 고민합니다.' }], examples: ['시니어 개발자에게는 과제를 요청하는 경우가 많다고 말합니다.'] },
      { title: '코딩 테스트와 리팩토링', start: min(8, 4), end: min(10, 54), summary: '코딩 테스트 유형을 설명하고, 문제를 반복해서 풀고 코드 리팩토링도 연습할 것을 권합니다.', subtopics: ['온라인 테스트', '라이브 코딩', '반복 풀이', '코드 리팩토링'], takeaway: '문제 풀이를 반복하는 것뿐 아니라 읽기 쉽고 바꾸기 쉬운 코드로 다듬는 연습이 필요합니다.', tips: [{ text: '풀이 코드 다듬기: 이미 푼 문제나 프로젝트 코드를 다시 살펴보고 더 읽기 쉽게 리팩토링합니다.' }, { text: '말로 풀이 설명하기: 풀이 과정을 소리 내어 설명하며 코드 구조를 점검합니다.', ai: true }], examples: ['지저분한 코드를 보여주고 어떻게 개선할지 묻는 유형을 설명합니다.'] },
      { title: '개발자 커리어 경로', start: min(10, 54), end: min(13, 47), summary: '관리자와 개발 전문가 트랙이 있으며, 서버·클라우드·데이터 등 다른 직무로 이동해 경험을 넓힐 수도 있습니다.', subtopics: ['관리자 트랙', '개발자 트랙', '직무 이동', '경험 확장'], takeaway: '개발자는 관리와 기술 전문성 중 각자의 방향을 선택하고, 직무 이동으로 커리어를 탐색할 수 있습니다.', tips: [{ text: '인접 직무 경험: 서버, 클라우드, 데이터 등 관심 있는 분야를 탐색해 직무 경험을 넓힙니다.' }], examples: ['서버 개발자가 AWS 인프라와 클라우드 분야에 관심을 갖는 사례가 나옵니다.'] },
      { title: '버즈빌 개발팀 구성', start: min(13, 47), end: min(16, 27), summary: '제품 팀은 여러 직군이 함께 목표를 수행하며, 공통 기술 업무는 별도 조직이 맡을 수 있습니다.', subtopics: ['제품 팀', '공통 기술 조직', '팀 역할 구성', '전문성'], takeaway: '제품 팀은 여러 직군이 목표를 함께 맡고, 팀 안에는 다양한 역할과 전문성이 필요합니다.', tips: [{ text: '팀 미션 매핑: 현재 팀의 목표 하나를 골라 필요한 역할을 적어 봅니다.', ai: true }], examples: ['제품 팀에 PM, 클라이언트 개발자, 서버 개발자, 디자이너가 함께 참여하는 구성을 설명합니다.'] },
    ],
  },
  {
    recordId: 'r-rag',
    analysisId: 'a-rag',
    video: { videoId: '9bZkp7q19f0', title: 'RAG 검색 흐름 이해하기', channelName: '예시 AI 채널', thumbnailUrl: null, durationMs: min(20), channelImageUrl: null, publishedAt: '2026-10-11T00:00:00Z' },
    oneLine: '검색한 근거를 활용해 답변하는 RAG 파이프라인의 구성과 주의점을 설명합니다.',
    keyPoints: ['문서를 조각내고 임베딩합니다.', '질문과 가까운 조각을 검색합니다.', '검색 근거를 붙여 답변합니다.'],
    practical: ['검색 근거와 답변을 함께 확인해 보세요.'],
    tools: ['Spring AI', 'pgvector'],
    keywords: [KEYWORDS.rag, KEYWORDS.llm, KEYWORDS.prompt],
    rootTitle: 'RAG 흐름',
    analyzedAt: '2026-11-07T10:00:00Z',
    sections: [
      { title: '문서 분할과 임베딩', start: 0, end: min(7), summary: '문서를 의미 단위로 나누고 벡터로 바꾸는 과정입니다.', subtopics: ['청크 크기', '겹침', '임베딩 모델'], takeaway: '청크 크기와 겹침이 검색 품질을 좌우합니다.', tips: [{ text: '청크 크기를 바꿔 가며 검색 결과를 비교해 보세요.', ai: true }], examples: ['강의 자막을 20초 단위로 묶는 예시'] },
      { title: '검색과 답변 연결', start: min(7), end: min(20), summary: '검색한 자막을 근거로 답변하는 흐름입니다.', subtopics: ['유사도 검색', '근거 확인', '출처 표시'], takeaway: '근거를 확인한 후 답변을 활용합니다.', tips: [{ text: '답변에 출처 구간을 함께 보여주세요.' }], examples: ['저장한 강의에서 관련 구간을 찾는 예시'] },
    ],
  },
  {
    recordId: 'r-kotlin',
    analysisId: 'a-kotlin',
    video: { videoId: 'rBXWJcr_L1c', title: '안드로이드 앱 개발을 위한 코틀린 기초 001', channelName: '예시 강의 채널', thumbnailUrl: null, durationMs: min(26, 49), channelImageUrl: null, publishedAt: '2026-03-02T00:00:00Z' },
    oneLine: '코틀린 문법 기초와 안드로이드 스튜디오에서 실습하는 방법을 소개합니다.',
    keyPoints: ['코틀린의 특징을 소개합니다.', '변수와 함수 선언을 실습합니다.'],
    practical: ['자동 임포트 기능으로 실습 시간을 줄여 보세요.'],
    tools: ['Android Studio'],
    keywords: [KEYWORDS.kotlin],
    rootTitle: '코틀린 기초',
    analyzedAt: '2026-11-05T11:00:00Z',
    sections: [
      { title: '코틀린 소개', start: min(0, 34), end: min(5), summary: '코틀린이 안드로이드 공식 언어가 된 배경을 설명합니다.', subtopics: ['특징', '자바와 차이'], takeaway: '간결하고 안전한 문법이 장점입니다.', tips: [{ text: '자바 코드와 나란히 비교해 보세요.', ai: true }], examples: [] },
      { title: '실습 환경과 실행', start: min(5), end: min(26, 49), summary: '안드로이드 스튜디오에서 코드를 입력하고 앱을 실행해 테스트합니다.', subtopics: ['자동 임포트', '앱 실행'], takeaway: '자동 임포트와 실행으로 빠르게 확인합니다.', tips: [{ text: '단축키로 자동 임포트를 켜 두세요.' }], examples: [] },
    ],
  },
];

// 비IT 영상 예시 (PARTIAL-NONIT-SUMMARY 확인용): 아래 루프 뒤에 coverage를 SUMMARY_ONLY로 바꾼다
seeds.push({
  recordId: 'r-pasta', analysisId: 'a-pasta',
  video: { videoId: 'M7lc1UVf-VE', title: '처음 만드는 토마토 파스타 | 재료 손질부터 소스 완성까지', channelName: '오늘의 집밥 · 예시 채널', thumbnailUrl: null, durationMs: min(12), channelImageUrl: null, publishedAt: '2026-10-01T00:00:00Z' },
  oneLine: '마늘과 토마토로 소스를 만들고 삶은 면을 함께 볶아 완성하는 기본 토마토 파스타예요.',
  keyPoints: ['마늘과 양파를 썰고 토마토와 면을 준비해요.', '마늘과 양파를 볶은 뒤 토마토를 넣어 소스를 끓여요.', '삶은 면과 면수를 더해 농도를 맞추고 간을 마무리해요.'],
  practical: [], tools: [], keywords: [], rootTitle: '토마토 파스타', analyzedAt: '2026-11-03T09:00:00Z',
  sections: [
    { title: '재료 손질과 준비', start: min(0, 40), end: min(3, 10), summary: '재료를 손질합니다.', subtopics: [], takeaway: '', tips: [], examples: [] },
    { title: '토마토 소스 만들기', start: min(3, 10), end: min(8, 20), summary: '소스를 끓입니다.', subtopics: [], takeaway: '', tips: [], examples: [] },
    { title: '면과 소스를 섞어 완성', start: min(8, 20), end: min(12), summary: '면과 소스를 섞습니다.', subtopics: [], takeaway: '', tips: [], examples: [] },
  ],
});

// ---------- 파생 데이터 ----------
export const analyses: Record<string, Analysis> = {};
export const sectionDetails: Record<string, SectionDetail> = {}; // key: `${analysisId}/${sectionId}`
export const records: RecordItem[] = [];

seeds.forEach((s) => {
  const sections: AnalysisSection[] = s.sections.map((sec, i) => ({
    sectionId: `${s.analysisId}-s${i + 1}`,
    title: sec.title,
    startMs: sec.start,
    endMs: sec.end,
    summary: sec.summary,
    subtopics: sec.subtopics,
    keywords: s.keywords.slice(0, 2),
  }));
  analyses[s.analysisId] = {
    analysisId: s.analysisId,
    recordId: s.recordId,
    status: 'COMPLETED',
    schemaVersion: '1.0',
    video: s.video,
    summary: {
      oneLine: s.oneLine,
      keyPoints: s.keyPoints,
      practicalPoints: s.practical.map((text) => ({ text, origin: 'SOURCE' as const })),
      mentionedTools: s.tools.map((name) => ({ name })),
      keywords: s.keywords,
      highlightSectionIds: sections.slice(0, 2).map((x) => x.sectionId),
    },
    sections,
    mindmap: { rootTitle: s.rootTitle, sectionIds: sections.map((x) => x.sectionId) },
    chatReady: true,
    analyzedAt: s.analyzedAt,
  };
  s.sections.forEach((sec, i) => {
    const base = sections[i];
    sectionDetails[`${s.analysisId}/${base.sectionId}`] = {
      ...base,
      analysisId: s.analysisId,
      recordId: s.recordId,
      videoId: s.video.videoId,
      originalUrl: `https://www.youtube.com/watch?v=${s.video.videoId}&t=${Math.floor(sec.start / 1000)}`,
      detail: {
        takeaway: sec.takeaway,
        explanation: sec.summary,
        applicationTips: sec.tips.map((t) => ({ text: t.text, origin: t.ai ? 'AI_SUGGESTION' : 'SOURCE' })),
        recommendedTools: [],
        usageKeywords: sec.subtopics.slice(0, 3),
        examples: sec.examples.map((text) => ({ text, origin: 'SOURCE' as const })),
      },
      video: s.video,
      videoOneLine: s.oneLine,
    };
  });
  records.push({
    recordId: s.recordId,
    analysisId: s.analysisId,
    video: s.video,
    oneLine: s.oneLine,
    keywords: s.keywords,
    analyzedAt: s.analyzedAt,
    matches: [],
    folderMembership: null,
  });
});

analyses['a-pasta'].coverage = 'SUMMARY_ONLY';
analyses['a-pasta'].summary.highlightSectionIds = analyses['a-pasta'].sections.map((x) => x.sectionId);

// 폴더: 같은 기록이 여러 폴더에 들어갈 수 있다 (정책 P-38)
export const folders: Folder[] = [
  { folderId: 'f-ai', name: 'AI 공부', recordCount: 0, createdAt: '2026-11-01T00:00:00Z' },
  { folderId: 'f-job', name: '취업 준비', recordCount: 0, createdAt: '2026-11-02T00:00:00Z' },
];
export const folderRecords: Record<string, Set<string>> = {
  'f-ai': new Set(['r-rag', 'r-dev-growth']),
  'f-job': new Set(['r-dev-growth']),
};
export const syncFolderCounts = () => folders.forEach((f) => { f.recordCount = folderRecords[f.folderId]?.size ?? 0; });
syncFolderCounts();

export const readingPositions: Record<string, { tab: 'SUMMARY' | 'MINDMAP' | 'DETAIL'; sectionId: string | null; lastViewedAt: string }> = {};

export const conversations: Conversation[] = [];
export const messages: Record<string, ChatMessage[]> = {};
