// ITip Agent (피그마 11/06 AGENT-BOTTOMSHEET / AGENT-FULLSCREEN / AGENT-FOLDER / AGENT-KEYWORD)
// - 바텀시트로 열리고 '전체 화면으로 보기'로 확장
// - 첫 질문을 보낼 때 범위를 고정한 채팅방을 만든다 (범위가 바뀌면 새 채팅방: 정책 P-47/48)
// - SSE로 답변을 받고, done 없이 끊기면 CHAT-05로 상태를 다시 조회한다 (자동 재생성 없음)
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { newIdempotencyKey } from '../api/client';
import * as chatApi from '../api/chat';
import type { ChatMessage, ChatScope, ChatSource } from '../api/types';
import { useQueryClient } from '@tanstack/react-query';
import { formatRange } from '../lib/format';
import { colors, font, radius, space } from '../theme/tokens';

export type AgentContext = {
  scope: ChatScope;
  /** '참고 중' 아래에 보이는 범위 이름 (예: 영상 제목, "AI 공부 · 12개 기록") */
  scopeTitle: string;
  scopeSub?: string;
  suggestions: string[];
  intro: string;
  placeholder: string;
};

type UiMessage = {
  key: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  status?: 'STREAMING' | 'COMPLETED' | 'INCOMPLETE' | 'FAILED';
  sources?: ChatSource[];
  finishReason?: string | null;
  messageId?: string;
  clientRequestId?: string;
  retryOfMessageId?: string | null;
};

const fromServer = (m: ChatMessage): UiMessage => ({
  key: m.messageId,
  role: m.role,
  content: m.content,
  status: (m.status as UiMessage['status']) ?? undefined,
  sources: m.sources,
  finishReason: m.finishReason,
  messageId: m.messageId,
  clientRequestId: m.clientRequestId,
});

type Props = {
  visible: boolean;
  onClose: () => void;
  context: AgentContext;
  /** 저장된 대화를 이어갈 때 */
  conversationId?: string;
  startFull?: boolean;
};

export function AgentSheet({ visible, onClose: onCloseProp, context, conversationId: initialId, startFull }: Props) {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  // 키보드가 열린 채로 닫아도 한 번에 닫히게
  const onClose = useCallback(() => { Keyboard.dismiss(); onCloseProp(); }, [onCloseProp]);
  const [full, setFull] = useState(!!startFull);
  const [convId, setConvId] = useState<string | undefined>(initialId);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false); // 답변 생성 중 → 전송 잠금 (P-50)
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const createKeyRef = useRef(newIdempotencyKey());
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [kbOpen, setKbOpen] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const resetDrag = useCallback(() => Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start(), [dragY]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
    onPanResponderGrant: () => Keyboard.dismiss(),
    onPanResponderMove: (_e, g) => dragY.setValue(g.dy),
    onPanResponderRelease: (_e, g) => {
      if (g.dy < -50 || g.vy < -0.7) { dragY.setValue(0); setFull(true); }   // 위로 당김 → 전체 화면
      else if (g.dy > 90 || g.vy > 0.7) { dragY.setValue(0); onClose(); }    // 아래로 내림 → 닫기
      else if (Math.abs(g.dy) < 5 && Math.abs(g.dx) < 5) { dragY.setValue(0); setFull(true); } // 탭 → 전체 화면
      else resetDrag();
    },
    onPanResponderTerminate: () => resetDrag(),
  }), [dragY, onClose, resetDrag]);
  // 위로는 살짝만 따라오고(저항감), 아래로는 손가락을 그대로 따라온다
  const sheetY = dragY.interpolate({ inputRange: [-300, 0, 1000], outputRange: [-40, 0, 1000], extrapolate: 'clamp' });
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // 저장된 대화 불러오기
  useEffect(() => {
    if (!visible) return;
    setFull(!!startFull);
    if (initialId) {
      setConvId(initialId);
      chatApi.listMessages(initialId).then((p) => setMessages(p.items.map(fromServer))).catch(() => setError('대화를 불러오지 못했어요.'));
    }
  }, [visible, initialId, startFull]);

  useEffect(() => () => cancelRef.current?.(), []);

  const patchAssistant = useCallback((clientRequestId: string, patch: Partial<UiMessage> | ((m: UiMessage) => Partial<UiMessage>)) => {
    setMessages((list) => list.map((m) => (m.role === 'ASSISTANT' && m.clientRequestId === clientRequestId ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)));
  }, []);

  /** 연결이 끊겼을 때: 서버에 저장된 상태를 조회해 이어 붙인다 */
  const recover = useCallback(async (cid: string, clientRequestId: string, assistantId?: string) => {
    for (let i = 0; i < 10; i++) {
      try {
        let m: ChatMessage | undefined;
        if (assistantId) m = await chatApi.getMessage(cid, assistantId);
        else m = (await chatApi.listMessages(cid, { clientRequestId })).items.find((x) => x.role === 'ASSISTANT');
        if (m && m.status !== 'STREAMING') {
          patchAssistant(clientRequestId, { content: m.content, status: (m.status as UiMessage['status']) ?? 'COMPLETED', sources: m.sources, finishReason: m.finishReason, messageId: m.messageId });
          return;
        }
        await new Promise((r) => setTimeout(r, m?.nextPollAfterMs ?? 1500));
      } catch {
        break;
      }
    }
    patchAssistant(clientRequestId, { status: 'INCOMPLETE' });
  }, [patchAssistant]);

  const send = useCallback(async (raw: string, retryOfMessageId: string | null = null) => {
    const content = raw.trim();
    if (!content || busy) return;
    setError(null);
    setBusy(true);
    const clientRequestId = newIdempotencyKey();
    setMessages((l) => [
      ...l,
      { key: `u-${clientRequestId}`, role: 'USER', content, clientRequestId },
      { key: `a-${clientRequestId}`, role: 'ASSISTANT', content: '', status: 'STREAMING', clientRequestId, retryOfMessageId },
    ]);
    setText('');
    Keyboard.dismiss();

    let cid = convId;
    try {
      if (!cid) {
        const c = await chatApi.createConversation(context.scope, createKeyRef.current);
        cid = c.conversationId;
        setConvId(cid);
        createKeyRef.current = newIdempotencyKey();
        qc.invalidateQueries({ queryKey: ['conversations'] });
      }
    } catch {
      setMessages((l) => l.filter((m) => m.clientRequestId !== clientRequestId));
      setText(content); // 입력 유지 → 같은 키로 다시 시도
      setError('대화를 시작하지 못했어요. 다시 보내 주세요.');
      setBusy(false);
      return;
    }

    let assistantId: string | undefined;
    cancelRef.current = chatApi.streamMessage(cid, { clientRequestId, content, retryOfMessageId }, {
      onMeta: (e) => { assistantId = e.assistantMessageId; patchAssistant(clientRequestId, { messageId: e.assistantMessageId }); },
      onDelta: (e) => patchAssistant(clientRequestId, (m) => ({ content: m.content + e.text })),
      onSources: (e) => patchAssistant(clientRequestId, { sources: e.sources }),
      onDone: (e) => { patchAssistant(clientRequestId, { status: 'COMPLETED', finishReason: e.finishReason }); setBusy(false); qc.invalidateQueries({ queryKey: ['conversations'] }); },
      onServerError: () => { patchAssistant(clientRequestId, { status: 'FAILED' }); setBusy(false); },
      onDisconnected: async () => { await recover(cid!, clientRequestId, assistantId); setBusy(false); },
    });
  }, [busy, convId, context.scope, patchAssistant, qc, recover]);

  const openSource = (s: ChatSource) => {
    if (s.availability !== 'AVAILABLE') return;
    onClose();
    if (s.sectionId) router.push({ pathname: '/section/[analysisId]/[sectionId]', params: { analysisId: s.analysisId, sectionId: s.sectionId } });
    else router.push({ pathname: '/result/[analysisId]', params: { analysisId: s.analysisId } });
  };

  const newChat = () => {
    cancelRef.current?.();
    setConvId(undefined);
    setMessages([]);
    setBusy(false);
    setError(null);
  };

  const body = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Pressable style={styles.head} onPress={Keyboard.dismiss} accessible={false}>
        <Text style={font.h2}>ITip Agent</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {kbOpen ? (
            <Pressable hitSlop={12} onPress={Keyboard.dismiss} style={{ marginRight: space.lg }} accessibilityLabel="키보드 내리기">
              <Text style={font.sub}>키보드 내리기</Text>
            </Pressable>
          ) : null}
          <Pressable hitSlop={16} onPress={onClose} accessibilityRole="button" accessibilityLabel="ITip Agent 닫기"><Text style={styles.close}>✕</Text></Pressable>
        </View>
      </Pressable>

      <View style={styles.scopeBox}>
        <View style={{ flex: 1 }}>
          <Text style={font.caption}>참고 중</Text>
          <Text style={[font.body, { fontWeight: '700' }]} numberOfLines={1}>{context.scopeTitle}</Text>
          {context.scopeSub ? <Text style={font.caption} numberOfLines={1}>{context.scopeSub}</Text> : null}
        </View>
        {messages.length ? <Pressable onPress={newChat}><Text style={styles.link}>새 대화</Text></Pressable> : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={{ flexGrow: 1 }}>
        {!full ? (
          <Pressable onPress={() => setFull(true)}><Text style={[font.sub, { marginBottom: space.md }]}>전체 화면으로 보기 ›</Text></Pressable>
        ) : null}

        {messages.length === 0 ? (
          <>
            {context.suggestions.map((q) => (
              <Pressable key={q} style={styles.suggest} onPress={() => send(q)} disabled={busy}>
                <Text style={font.body}>{q}</Text>
              </Pressable>
            ))}
            <Text style={[font.h3, { marginTop: space.lg }]}>ITip Agent</Text>
            <Text style={[font.body, { marginTop: space.xs, color: colors.textSub }]}>{context.intro}</Text>
          </>
        ) : null}

        {messages.map((m) => (m.role === 'USER' ? (
          <View key={m.key} style={styles.userBubble}>
            <Text style={font.caption}>나</Text>
            <Text style={font.body}>{m.content}</Text>
          </View>
        ) : (
          <AssistantBlock key={m.key} m={m} onOpenSource={openSource} onRetry={() => {
            const q = [...messages].reverse().find((x) => x.role === 'USER' && x.clientRequestId === m.clientRequestId)?.content;
            if (q) send(q, m.messageId ?? null);
          }} />
        )))}
        {error ? <Text style={[font.caption, { color: colors.danger, marginTop: space.sm }]}>{error}</Text> : null}
        </Pressable>
      </ScrollView>

      <View style={[styles.inputWrap, { paddingBottom: space.md + (kbOpen ? 0 : insets.bottom) }]}>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={context.placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
          />
          <Pressable onPress={() => send(text)} disabled={busy || !text.trim()} style={{ opacity: busy || !text.trim() ? 0.3 : 1, padding: space.sm }}>
            {busy ? <ActivityIndicator color={colors.textSub} /> : <Text style={{ fontSize: 18, color: colors.text }}>↑</Text>}
          </Pressable>
        </View>
        {/* TODO: 크레딧/일일 질문 한도 표시 — PLAN-02 chat.limitsConfigured가 true일 때만 */}
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={!full} onRequestClose={onClose} presentationStyle={full ? 'fullScreen' : 'overFullScreen'}>
      {full ? (
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>{body}</View>
      ) : (
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
            {/* 회색 바 영역: 위로 당기면 전체 화면, 아래로 내리면 닫기. 탭하면 전체 화면 */}
            <View {...pan.panHandlers} style={styles.grabberZone} accessibilityRole="adjustable" accessibilityLabel="위로 당기면 전체 화면, 아래로 내리면 닫기">
              <View style={styles.grabber} />
            </View>
            {body}
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

function AssistantBlock({ m, onOpenSource, onRetry }: { m: UiMessage; onOpenSource: (s: ChatSource) => void; onRetry: () => void }) {
  const streaming = m.status === 'STREAMING';
  const noGround = m.status === 'COMPLETED' && m.finishReason === 'INSUFFICIENT_EVIDENCE';
  const sources = m.sources ?? [];
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={[font.h3, { marginBottom: space.xs }]}>ITip Agent</Text>
      {m.content ? <Text style={font.body}>{m.content}</Text> : streaming ? <Text style={font.sub}>기록을 찾아보는 중이에요…</Text> : null}
      {noGround ? <Text style={[font.sub, { marginTop: space.xs }]}>선택한 기록에서 근거를 찾지 못했어요. 범위를 넓혀 새 대화를 시작해 보세요.</Text> : null}
      {m.status === 'INCOMPLETE' || m.status === 'FAILED' ? (
        <View style={styles.warn}>
          <Text style={font.sub}>{m.status === 'FAILED' ? '답변을 만들지 못했어요.' : '답변이 중간에 끊겼어요.'}</Text>
          <Pressable onPress={onRetry}><Text style={styles.link}>다시 요청</Text></Pressable>
        </View>
      ) : null}
      {!streaming && sources.length ? (
        <>
          <Text style={[font.caption, { marginTop: space.md, marginBottom: space.xs, fontWeight: '600' }]}>참고한 분석 기록</Text>
          {sources.map((s) => (
            <Pressable key={s.sourceId} onPress={() => onOpenSource(s)} style={[styles.source, s.availability !== 'AVAILABLE' && { opacity: 0.5 }]}>
              <View style={{ flex: 1 }}>
                <Text style={font.caption}>{s.availability === 'AVAILABLE' ? (s.sectionId ? formatRange(s.startMs, s.endMs) : '한 줄 요약') : '삭제된 기록'}</Text>
                <Text style={[font.body, { fontWeight: '600' }]} numberOfLines={1}>{s.title}</Text>
              </View>
              {s.availability === 'AVAILABLE' ? <Text style={{ fontSize: 18, color: colors.textSub }}>›</Text> : null}
            </Pressable>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { height: '78%', backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  grabberZone: { height: 28, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.md },
  close: { fontSize: 18, color: colors.textSub },
  scopeBox: { flexDirection: 'row', alignItems: 'center', margin: space.lg, marginBottom: 0, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  link: { fontSize: 13, fontWeight: '700', color: colors.text },
  suggest: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  userBubble: { backgroundColor: colors.surfaceStrong, borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
  warn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm, padding: space.sm, borderRadius: radius.sm, backgroundColor: colors.surface },
  source: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  inputWrap: { padding: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingLeft: space.md },
  input: { flex: 1, minHeight: 44, maxHeight: 120, fontSize: 15, color: colors.text, paddingVertical: space.sm },
});
