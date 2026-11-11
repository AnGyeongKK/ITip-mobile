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
    const folder = scope.type === 'FILTERED' && scope.folderId ? db.folders.find((f) => f.folderId === scope.folderId) : null;
    const kwNames = scope.type === 'FILTERED'
      ? Object.values(db.KEYWORDS).filter((k) => scope.keywordIds?.includes(k.keywordId)).map((k) => k.name)
      : [];
    const rec = scope.type === 'RECORD' ? db.records.find((r) => r.recordId === scope.recordId) : null;
    const section = rec && scope.type === 'RECORD' && scope.focusSectionId
      ? db.analyses[rec.analysisId]?.sections.find((s) => s.sectionId === scope.focusSectionId)
      : null;
    if (scope.type === 'RECORD' && (!rec || (scope.focusSectionId && !section))) {
      throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    }
    const scopeLabel = scope.type === 'ALL' ? '전체 분석 기록' : rec
      ? [rec.video.title, section?.title].filter(Boolean).join(' · ')
      : [folder?.name, kwNames.join(' + '), scope.type === 'FILTERED' ? scope.q : null].filter(Boolean).join(' · ');
    const recordCount = rec ? 1 : folder ? db.folderRecords[folder.folderId].size : db.records.length;
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

export async function getConversation(conversationId: string, signal?: AbortSignal): Promise<Conversation> {
  if (USE_MOCK) {
    await delay(150);
    const c = db.conversations.find((x) => x.conversationId === conversationId);
    if (!c) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    return { ...c };
  }
  return request({ method: 'GET', url: chatUrl(`/api/v1/conversations/${conversationId}`), signal });
}

/** 메시지는 오래된 순으로 돌려준다고 가정한다 (명세 예시 기준). */
export async function listMessages(conversationId: string, opts: { cursor?: string; clientRequestId?: string } = {}, signal?: AbortSignal): Promise<CursorPage<ChatMessage>> {
  if (USE_MOCK) {
    await delay(150);
    let items = db.messages[conversationId] ?? [];
    if (opts.clientRequestId) items = items.filter((m) => m.clientRequestId === opts.clientRequestId);
    return { items: [...items], nextCursor: null, hasNext: false };
  }
  return request({ method: 'GET', url: chatUrl(`/api/v1/conversations/${conversationId}/messages`), params: opts, signal });
}

/** 끊긴 스트림 복구용 (CHAT-05) */
export async function getMessage(conversationId: string, messageId: string, signal?: AbortSignal): Promise<ChatMessage> {
  if (USE_MOCK) {
    await delay(150);
    const m = db.messages[conversationId]?.find((x) => x.messageId === messageId);
    if (!m) throw new ApiError(404, 'RESOURCE_NOT_FOUND', '요청한 항목을 찾을 수 없어요.');
    return { ...m };
  }
  return request({ method: 'GET', url: chatUrl(`/api/v1/conversations/${conversationId}/messages/${messageId}`), signal });
}

export const isAssistantPending = (status: ChatMessage['status']) => status === 'QUEUED' || status === 'GENERATING';

export async function pollAssistant(
  conversationId: string,
  clientRequestId: string,
  assistantId: string | undefined,
  signal: AbortSignal,
  onMessage: (message: ChatMessage) => void,
): Promise<boolean> {
  let misses = 0;
  while (!signal.aborted) {
    let message: ChatMessage | undefined;
    try {
      message = assistantId
        ? await getMessage(conversationId, assistantId, signal)
        : (await listMessages(conversationId, { clientRequestId }, signal)).items.find((m) => m.role === 'ASSISTANT');
    } catch {
      // 연결이 돌아오는 동안 같은 요청의 저장된 메시지만 확인한다.
    }
    if (signal.aborted) break;
    if (message?.status) {
      onMessage(message);
      if (!isAssistantPending(message.status)) return true;
      assistantId = message.messageId;
      misses = 0;
    } else if (++misses >= 3) {
      break;
    }
    await delay(Math.max(250, message?.nextPollAfterMs ?? 1500));
  }
  return false;
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
  onRejected?: (message: string) => void;
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
  let idleTimer: ReturnType<typeof setTimeout>;
  const close = () => {
    finished = true;
    clearTimeout(idleTimer);
    es.removeAllEventListeners();
    es.close();
  };
  const disconnect = (reason: string) => {
    if (finished) return;
    close();
    h.onDisconnected?.(reason);
  };
  const watchIdle = () => {
    clearTimeout(idleTimer);
    // react-native-sse 1.2.1은 정상 HTTP EOF에 close를 보내지 않는다.
    idleTimer = setTimeout(() => disconnect('idle'), 15000);
  };

  es.addEventListener('open', watchIdle);
  es.addEventListener('meta', (e) => { watchIdle(); const d = parse<SseMeta>(e.data); if (d) h.onMeta?.(d); });
  es.addEventListener('delta', (e) => { watchIdle(); const d = parse<SseDelta>(e.data); if (d) h.onDelta?.(d); });
  es.addEventListener('sources', (e) => { watchIdle(); const d = parse<SseSources>(e.data); if (d) h.onSources?.(d); });
  es.addEventListener('done', (e) => {
    const d = parse<SseDone>(e.data);
    if (!d) return disconnect('invalid done');
    close();
    h.onDone?.(d);
  });
  es.addEventListener('error', (e) => {
    if ('data' in e && typeof e.data === 'string') {
      const d = parse<SseError>(e.data);
      if (d?.code) { close(); h.onServerError?.(d); return; }
    }
    if ('xhrStatus' in e && e.xhrStatus >= 400 && e.xhrStatus < 500) {
      const rejection = parse<{ code: string; message: string }>(e.message);
      if (rejection?.code !== 'CHAT_GENERATION_IN_PROGRESS') {
        close();
        h.onRejected?.(rejection?.message ?? '질문을 보내지 못했어요.');
        return;
      }
    }
    disconnect('connection error');
  });
  es.addEventListener('close', () => disconnect('closed'));
  watchIdle();
  return close;
}

function mockStream(conversationId: string, body: SendBody, h: StreamHandlers): () => void {
  const conv = db.conversations.find((c) => c.conversationId === conversationId);
  const list = (db.messages[conversationId] ??= []);
  const now = () => new Date().toISOString();
  const user: ChatMessage = { messageId: `m-${Date.now()}`, role: 'USER', clientRequestId: body.clientRequestId, content: body.content, createdAt: now() };
  const asst: ChatMessage = { messageId: `m-${Date.now() + 1}`, role: 'ASSISTANT', replyToMessageId: user.messageId, clientRequestId: body.clientRequestId, status: 'GENERATING', content: '', sources: [], createdAt: now(), scopeRecordCount: conv?.recordCount ?? 0, usedRecordCount: 0 };
  list.push(user, asst);
  if (conv) { conv.activeAssistantMessageId = asst.messageId; conv.updatedAt = now(); }

  const noEvidence = /날씨|주식|맛집/.test(body.content);
  const scope = conv?.scope;
  const rec = scope?.type === 'RECORD' ? db.records.find((r) => r.recordId === scope.recordId) : db.records[0];
  const section = rec ? db.analyses[rec.analysisId]?.sections.find((s) =>
    scope?.type !== 'RECORD' || !scope.focusSectionId || s.sectionId === scope.focusSectionId) : undefined;
  const answer = noEvidence
    ? '선택한 기록에서 근거를 찾지 못했어요. 범위를 넓혀 새 채팅을 시작해 보세요.'
    : `저장한 기록 중 「${rec?.video.title ?? '영상'}」에서 관련 내용을 찾았어요. 버그가 생기면 증상만 없애지 말고 근본 원인을 확인하고, 일정과 진행 상황을 빠르게 공유하는 것이 중요하다고 설명합니다.`;
  const chunks = answer.match(/.{1,12}/g) ?? [answer];
  let connected = true;
  const at = (ms: number, fn: () => void) => setTimeout(fn, ms);

  at(200, () => { if (connected) h.onMeta?.({ conversationId, userMessageId: user.messageId, assistantMessageId: asst.messageId, clientRequestId: body.clientRequestId, scopeRecordCount: asst.scopeRecordCount ?? 0 }); });
  chunks.forEach((text, i) => at(400 + i * 90, () => {
    asst.content += text;
    if (connected) h.onDelta?.({ assistantMessageId: asst.messageId, sequence: i + 1, text });
  }));
  const end = 400 + chunks.length * 90 + 150;
  at(end, () => {
    const sources = noEvidence || !rec ? [] : [{
      sourceId: 'src-1', recordId: rec.recordId, analysisId: rec.analysisId, sectionId: section?.sectionId ?? null,
      title: rec.video.title, videoId: rec.video.videoId, startMs: section?.startMs ?? 0, endMs: section?.endMs ?? 211000, availability: 'AVAILABLE' as const, analyzedAt: rec.analyzedAt,
    }];
    asst.sources = sources; asst.usedRecordCount = sources.length;
    if (connected) h.onSources?.({ assistantMessageId: asst.messageId, sources, usedRecordCount: sources.length });
  });
  at(end + 100, () => {
    asst.status = 'COMPLETED'; asst.finishReason = noEvidence ? 'INSUFFICIENT_EVIDENCE' : 'STOP'; asst.completedAt = now();
    if (conv) conv.activeAssistantMessageId = null;
    if (connected) h.onDone?.({ assistantMessageId: asst.messageId, status: 'COMPLETED', finishReason: asst.finishReason, usedRecordCount: asst.usedRecordCount ?? 0 });
  });
  return () => { connected = false; };
}
