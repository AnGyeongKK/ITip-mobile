// CHAT-01~07 채팅방·메시지·SSE 스트리밍
import EventSource from 'react-native-sse';
import { ApiError, CHAT_BASE_URL, USE_MOCK, delay, newIdempotencyKey, request } from './client';
import * as db from './mock/db';
import type {
  ChatMessage, ChatScope, Conversation, ConversationListItem, CursorPage, SseDelta, SseDone, SseError, SseMeta, SseSources,
} from './types';

const chatUrl = (path: string) => `${CHAT_BASE_URL}${path}`;

export async function createConversation(scope: ChatScope, idempotencyKey = newIdempotencyKey()): Promise<Conversation> {
  if (USE_MOCK) {
    await delay();
    const folder = scope.folderId ? db.folders.find((f) => f.folderId === scope.folderId) : null;
    const kwNames = Object.values(db.KEYWORDS).filter((k) => scope.keywordIds?.includes(k.keywordId)).map((k) => k.name);
    const rec = scope.recordId ? db.records.find((r) => r.recordId === scope.recordId) : null;
    const scopeLabel = scope.type === 'ALL' ? '전체 분석 기록' : rec ? rec.video.title : [folder?.name, kwNames.join(' + '), scope.q].filter(Boolean).join(' · ');
    const recordCount = scope.type === 'ALL' ? db.records.length : rec ? 1 : folder ? db.folderRecords[folder.folderId].size : db.records.length;
    const c: Conversation = {
      conversationId: `c-${Date.now()}`, scope, scopeLabel, recordCount, createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), scopeStatus: 'AVAILABLE', activeAssistantMessageId: null,
    };
    db.conversations.unshift(c);
    db.messages[c.conversationId] = [];
    return c;
  }
  return request({ method: 'POST', url: chatUrl('/api/v1/conversations'), data: { scope }, headers: { 'Idempotency-Key': idempotencyKey } });
}

export async function listConversations(cursor?: string): Promise<CursorPage<ConversationListItem>> {
  if (USE_MOCK) {
    await delay(200);
    return {
      items: db.conversations.map((c) => {
        const msgs = db.messages[c.conversationId] ?? [];
        const lastQ = [...msgs].reverse().find((m) => m.role === 'USER')?.content ?? '';
        return { conversationId: c.conversationId, title: msgs.find((m) => m.role === 'USER')?.content.slice(0, 20) || '새 대화', lastQuestion: lastQ, scopeLabel: c.scopeLabel, activeAssistantMessageId: c.activeAssistantMessageId, updatedAt: c.updatedAt ?? c.createdAt };
      }),
      nextCursor: null, hasNext: false,
    };
  }
  return request({ method: 'GET', url: chatUrl('/api/v1/conversations'), params: cursor ? { cursor } : undefined });
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  if (USE_MOCK) {
    await delay(150);
    const c = db.conversations.find((x) => x.conversationId === conversationId);
    if (!c) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    return { ...c };
  }
  return request({ method: 'GET', url: chatUrl(`/api/v1/conversations/${conversationId}`) });
}

/** 메시지는 오래된 순으로 돌려준다고 가정한다 (명세 예시 기준). */
export async function listMessages(conversationId: string, opts: { cursor?: string; clientRequestId?: string } = {}): Promise<CursorPage<ChatMessage>> {
  if (USE_MOCK) {
    await delay(150);
    let items = db.messages[conversationId] ?? [];
    if (opts.clientRequestId) items = items.filter((m) => m.clientRequestId === opts.clientRequestId);
    return { items: [...items], nextCursor: null, hasNext: false };
  }
  return request({ method: 'GET', url: chatUrl(`/api/v1/conversations/${conversationId}/messages`), params: opts });
}

/** 끊긴 스트림 복구용 (CHAT-05) */
export async function getMessage(conversationId: string, messageId: string): Promise<ChatMessage> {
  if (USE_MOCK) {
    await delay(150);
    const m = db.messages[conversationId]?.find((x) => x.messageId === messageId);
    if (!m) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    return { ...m };
  }
  return request({ method: 'GET', url: chatUrl(`/api/v1/conversations/${conversationId}/messages/${messageId}`) });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    const i = db.conversations.findIndex((x) => x.conversationId === conversationId);
    if (i >= 0) db.conversations.splice(i, 1);
    delete db.messages[conversationId];
    return;
  }
  await request({ method: 'DELETE', url: chatUrl(`/api/v1/conversations/${conversationId}`) });
}

// ---------------- SSE 스트리밍 (CHAT-04) ----------------
export interface StreamHandlers {
  onMeta?: (e: SseMeta) => void;
  onDelta?: (e: SseDelta) => void;
  onSources?: (e: SseSources) => void;
  onDone?: (e: SseDone) => void;
  /** 서버가 보낸 error 이벤트(생성 도중 실패) */
  onServerError?: (e: SseError) => void;
  /** done 없이 연결이 끊김 → CHAT-05로 상태 재조회해야 함 */
  onDisconnected?: (reason: string) => void;
}

export interface SendBody { clientRequestId: string; content: string; retryOfMessageId: string | null }

/**
 * 질문을 보내고 답변을 스트리밍으로 받는다. 반환값은 연결을 끊는 함수.
 * 자동 재연결은 끄고(pollingInterval: 0), 끊기면 화면이 상태 조회로 복구한다 (자동 재생성 금지 정책).
 */
export function streamMessage(conversationId: string, body: SendBody, h: StreamHandlers): () => void {
  if (USE_MOCK) return mockStream(conversationId, body, h);

  let finished = false;
  const es = new EventSource<'meta' | 'delta' | 'sources' | 'done'>(
    chatUrl(`/api/v1/conversations/${conversationId}/messages`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'Idempotency-Key': body.clientRequestId },
      body: JSON.stringify(body),
      pollingInterval: 0,
    },
  );
  const parse = <T,>(raw: string | null): T | null => { try { return raw ? (JSON.parse(raw) as T) : null; } catch { return null; } };

  es.addEventListener('meta', (e) => { const d = parse<SseMeta>(e.data); if (d) h.onMeta?.(d); });
  es.addEventListener('delta', (e) => { const d = parse<SseDelta>(e.data); if (d) h.onDelta?.(d); });
  es.addEventListener('sources', (e) => { const d = parse<SseSources>(e.data); if (d) h.onSources?.(d); });
  es.addEventListener('done', (e) => { const d = parse<SseDone>(e.data); finished = true; if (d) h.onDone?.(d); es.close(); });
  // 'error'는 서버의 error 이벤트와 연결 오류가 같은 이름으로 들어온다. data에 code가 있으면 서버 이벤트로 본다.
  es.addEventListener('error', (e: any) => {
    const d = parse<SseError>(e?.data ?? null);
    if (d?.code) { finished = true; h.onServerError?.(d); }
    else if (!finished) { finished = true; h.onDisconnected?.(e?.message ?? 'connection error'); }
    es.close();
  });
  es.addEventListener('close', () => { if (!finished) { finished = true; h.onDisconnected?.('closed'); } });

  return () => { finished = true; es.removeAllEventListeners(); es.close(); };
}

function mockStream(conversationId: string, body: SendBody, h: StreamHandlers): () => void {
  const conv = db.conversations.find((c) => c.conversationId === conversationId);
  const list = (db.messages[conversationId] ??= []);
  const now = () => new Date().toISOString();
  const user: ChatMessage = { messageId: `m-${Date.now()}`, role: 'USER', clientRequestId: body.clientRequestId, content: body.content, createdAt: now() };
  const asst: ChatMessage = { messageId: `m-${Date.now() + 1}`, role: 'ASSISTANT', replyToMessageId: user.messageId, clientRequestId: body.clientRequestId, status: 'STREAMING', content: '', sources: [], createdAt: now(), scopeRecordCount: conv?.recordCount ?? 0, usedRecordCount: 0 };
  list.push(user, asst);
  if (conv) { conv.activeAssistantMessageId = asst.messageId; conv.updatedAt = now(); }

  const noEvidence = /날씨|주식|맛집/.test(body.content);
  const rec = db.records[0];
  const answer = noEvidence
    ? '선택한 기록에서 근거를 찾지 못했어요. 범위를 넓혀 새 채팅을 시작해 보세요.'
    : `저장한 기록 중 「${rec?.video.title ?? '영상'}」에서 관련 내용을 찾았어요. 버그가 생기면 증상만 없애지 말고 근본 원인을 확인하고, 일정과 진행 상황을 빠르게 공유하는 것이 중요하다고 설명합니다.`;
  const chunks = answer.match(/.{1,12}/g) ?? [answer];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  at(200, () => h.onMeta?.({ conversationId, userMessageId: user.messageId, assistantMessageId: asst.messageId, clientRequestId: body.clientRequestId, scopeRecordCount: asst.scopeRecordCount ?? 0 }));
  chunks.forEach((text, i) => at(400 + i * 90, () => { asst.content += text; h.onDelta?.({ assistantMessageId: asst.messageId, sequence: i + 1, text }); }));
  const end = 400 + chunks.length * 90 + 150;
  at(end, () => {
    const sources = noEvidence || !rec ? [] : [{
      sourceId: 'src-1', recordId: rec.recordId, analysisId: rec.analysisId, sectionId: db.analyses[rec.analysisId]?.sections[0]?.sectionId ?? null,
      title: rec.video.title, videoId: rec.video.videoId, startMs: 0, endMs: 211000, availability: 'AVAILABLE' as const, analyzedAt: rec.analyzedAt,
    }];
    asst.sources = sources; asst.usedRecordCount = sources.length;
    h.onSources?.({ assistantMessageId: asst.messageId, sources, usedRecordCount: sources.length });
  });
  at(end + 100, () => {
    asst.status = 'COMPLETED'; asst.finishReason = noEvidence ? 'INSUFFICIENT_EVIDENCE' : 'STOP'; asst.completedAt = now();
    if (conv) conv.activeAssistantMessageId = null;
    h.onDone?.({ assistantMessageId: asst.messageId, status: 'COMPLETED', finishReason: asst.finishReason, usedRecordCount: asst.usedRecordCount ?? 0 });
  });
  return () => timers.forEach(clearTimeout);
}
