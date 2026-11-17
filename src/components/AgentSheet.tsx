// ITip Agent (피그마 '디자인 확정 화면' 11/11 AGENT-BOTTOMSHEET / AGENT-FULLSCREEN, 11/06 AGENT-FOLDER / AGENT-KEYWORD)
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
import type { AssistantStatus, ChatMessage, ChatScope, ChatSource } from '../api/types';
import { useQueryClient } from '@tanstack/react-query';
import { formatMs } from '../lib/format';
import { colors, radius, space, typography } from '../theme/tokens';
import { Icon } from './ui';

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
  status?: AssistantStatus;
  sources?: ChatSource[];
  finishReason?: string | null;
  messageId?: string;
  clientRequestId?: string;
  retryable?: boolean;
};

const fromServer = (m: ChatMessage): UiMessage => ({
  key: m.messageId,
  role: m.role,
  content: m.content,
  status: m.status,
  sources: m.sources,
  finishReason: m.finishReason,
  messageId: m.messageId,
  clientRequestId: m.clientRequestId,
  retryable: m.retryable,
});

type Props = {
  visible: boolean;
  onClose: () => void;
  context: AgentContext;
  /** 저장된 대화를 이어갈 때 */
  conversationId?: string;
  startFull?: boolean;
};

type PendingAssistant = { conversationId: string; clientRequestId: string; assistantId?: string };

export function AgentSheet(props: Props) {
  return <AgentSession key={JSON.stringify([props.conversationId, props.context.scope])} {...props} />;
}

function AgentSession({ visible, onClose: onCloseProp, context, conversationId: initialId, startFull }: Props) {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  // 키보드가 열린 채로 닫아도 한 번에 닫히게
  const onClose = useCallback(() => { Keyboard.dismiss(); onCloseProp(); }, [onCloseProp]);
  const [full, setFull] = useState(!!startFull);
  const [convId, setConvId] = useState<string | undefined>(initialId);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(!!initialId);
  const [savedScope, setSavedScope] = useState<ChatScope>();
  const [pending, setPending] = useState<PendingAssistant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const operation = useRef<AbortController | null>(null);
  const createKeyRef = useRef(newIdempotencyKey());
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [kbOpen, setKbOpen] = useState(false);
  const [dragY] = useState(() => new Animated.Value(0));
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

  useEffect(() => () => {
    operation.current?.abort();
    cancelRef.current?.();
  }, []);

  const patchAssistant = useCallback((clientRequestId: string, patch: Partial<UiMessage> | ((m: UiMessage) => Partial<UiMessage>)) => {
    setMessages((list) => list.map((m) => (m.role === 'ASSISTANT' && m.clientRequestId === clientRequestId ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)));
  }, []);

  const recover = useCallback(async (target: PendingAssistant, controller: AbortController) => {
    const { conversationId, clientRequestId, assistantId } = target;
    const resolved = await chatApi.pollAssistant(conversationId, clientRequestId, assistantId, controller.signal, (m) => {
      patchAssistant(clientRequestId, (current) => ({
        ...fromServer(m), key: current.key,
        content: chatApi.isAssistantPending(m.status) && !m.content ? current.content : m.content,
      }));
    });
    if (controller.signal.aborted) return;
    operation.current = null;
    setPending(resolved ? null : target);
    setBusy(false);
    setError(resolved ? null : '답변 상태를 확인하지 못했어요.');
    if (resolved) void qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [patchAssistant, qc]);

  // 저장된 대화를 열 때도 서버가 생성 중이면 입력을 잠근다.
  useEffect(() => {
    if (!initialId) return;
    const controller = new AbortController();
    operation.current = controller;
    const { signal } = controller;
    void Promise.all([chatApi.getConversation(initialId, signal), chatApi.listMessages(initialId, {}, signal)])
      .then(async ([conversation, page]) => {
        const assistantId = conversation.activeAssistantMessageId;
        const active = assistantId
          ? page.items.find((m) => m.messageId === assistantId) ?? await chatApi.getMessage(initialId, assistantId, signal)
          : undefined;
        if (signal.aborted) return;
        setSavedScope(conversation.scope);
        setMessages([...page.items, ...(active && !page.items.some((m) => m.messageId === active.messageId) ? [active] : [])].map(fromServer));
        if (active && chatApi.isAssistantPending(active.status)) {
          await recover({ conversationId: initialId, clientRequestId: active.clientRequestId, assistantId: active.messageId }, controller);
        } else {
          operation.current = null;
          setBusy(false);
        }
      })
      .catch(() => {
        if (signal.aborted) return;
        operation.current = null;
        setBusy(false);
        setError('대화를 불러오지 못했어요. 닫았다가 다시 열어 주세요.');
      });
    return () => controller.abort();
  }, [initialId, recover]);

  const locked = busy || !!pending || (!!initialId && !savedScope);
  const refreshStatus = () => {
    if (!pending || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError(null);
    void recover(pending, controller);
  };

  const send = useCallback(async (raw: string, retryOfMessageId: string | null = null) => {
    const content = raw.trim();
    if (!content || locked || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setError(null);
    setBusy(true);
    const clientRequestId = newIdempotencyKey();
    setMessages((l) => [
      ...l,
      { key: `u-${clientRequestId}`, role: 'USER', content, clientRequestId },
      { key: `a-${clientRequestId}`, role: 'ASSISTANT', content: '', status: 'GENERATING', clientRequestId },
    ]);
    setText('');
    Keyboard.dismiss();

    let cid = convId;
    try {
      if (!cid) {
        const c = await chatApi.createConversation(savedScope ?? context.scope, createKeyRef.current);
        if (controller.signal.aborted) return;
        cid = c.conversationId;
        setConvId(cid);
        createKeyRef.current = newIdempotencyKey();
        qc.invalidateQueries({ queryKey: ['conversations'] });
      }
    } catch {
      if (controller.signal.aborted) return;
      operation.current = null;
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
      onDone: (e) => {
        patchAssistant(clientRequestId, { status: 'COMPLETED', finishReason: e.finishReason });
        operation.current = null;
        setBusy(false);
        void qc.invalidateQueries({ queryKey: ['conversations'] });
      },
      onServerError: (e) => {
        patchAssistant(clientRequestId, { status: e.status ?? 'FAILED', messageId: e.assistantMessageId ?? assistantId, retryable: e.retryable });
        operation.current = null;
        setBusy(false);
        void qc.invalidateQueries({ queryKey: ['conversations'] });
      },
      onRejected: (message) => {
        operation.current = null;
        setMessages((list) => list.filter((m) => m.clientRequestId !== clientRequestId));
        setText(content);
        setBusy(false);
        setError(message);
      },
      onDisconnected: () => { void recover({ conversationId: cid!, clientRequestId, assistantId }, controller); },
    });
  }, [locked, convId, savedScope, context.scope, patchAssistant, qc, recover]);

  const openSource = (s: ChatSource) => {
    if (s.availability !== 'AVAILABLE') return;
    onClose();
    if (s.sectionId) router.push({ pathname: '/section/[analysisId]/[sectionId]', params: { analysisId: s.analysisId, sectionId: s.sectionId } });
    else router.push({ pathname: '/result/[analysisId]', params: { analysisId: s.analysisId } });
  };

  const newChat = () => {
    operation.current?.abort();
    operation.current = null;
    cancelRef.current?.();
    setPending(null);
    setConvId(undefined);
    setMessages([]);
    setBusy(false);
    setError(null);
  };

  const body = (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Pressable style={styles.head} onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.brand}>
          <Icon source={require('../../assets/icons/app-icon.svg')} width={24} height={24} />
          <Text style={typography.heading20}>ITip Agent</Text>
        </View>
        <View style={styles.headActions}>
          {kbOpen ? (
            <Pressable hitSlop={12} onPress={Keyboard.dismiss} accessibilityLabel="키보드 내리기">
              <Text style={[typography.button12, { color: colors.textSub }]}>키보드 내리기</Text>
            </Pressable>
          ) : null}
          {!full ? (
            <Pressable hitSlop={12} onPress={() => setFull(true)} accessibilityRole="button" accessibilityLabel="전체 화면으로 보기">
              <Icon source={require('../../assets/icons/expand.svg')} width={20} height={20} />
            </Pressable>
          ) : null}
          <Pressable hitSlop={16} onPress={onClose} accessibilityRole="button" accessibilityLabel="ITip Agent 닫기">
            <Icon source={require('../../assets/icons/close.svg')} width={20} height={20} />
          </Pressable>
        </View>
      </Pressable>

      <View style={styles.scopeBox}>
        <Text style={[typography.body14Semibold, { color: colors.textSub }]}>참고중</Text>
        <Text style={typography.subtitle16Bold} numberOfLines={1}>{context.scopeTitle}</Text>
        <View style={styles.scopeFoot}>
          <Text style={[typography.body14Medium, { color: colors.textMuted, flexShrink: 1 }]} numberOfLines={1}>{context.scopeSub ?? ''}</Text>
          {/* '범위 변경'은 범위를 바꾸는 API가 없어 두지 않는다. 대화가 있으면 같은 자리에 '새 대화' */}
          {messages.length ? (
            <Pressable onPress={newChat} style={styles.smallBtn} accessibilityRole="button">
              <Text style={[typography.button12, { color: colors.textSub }]}>새 대화</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: space.xl, paddingBottom: space.lg, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={{ flexGrow: 1, gap: 20 }}>
          <Text style={styles.answer}>{context.intro}</Text>

          {messages.length === 0 ? (
            <View style={{ gap: 18, alignItems: 'flex-start' }}>
              {context.suggestions.map((q) => (
                <Pressable key={q} style={({ pressed }) => [styles.suggest, pressed && { opacity: 0.7 }]} onPress={() => send(q)} disabled={locked}>
                  <Text style={[typography.body14Medium, { color: colors.primaryDeep }]}>{q}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {messages.map((m) => (m.role === 'USER' ? (
            <View key={m.key} style={styles.userBubble} accessibilityLabel={`내 질문: ${m.content}`}>
              <Text style={[typography.body14Medium, { color: colors.primaryDeep }]}>{m.content}</Text>
            </View>
          ) : (
            <AssistantBlock key={m.key} m={m} onOpenSource={openSource} onRetry={() => {
              const q = [...messages].reverse().find((x) => x.role === 'USER' && x.clientRequestId === m.clientRequestId)?.content;
              if (q && m.messageId) send(q, m.messageId);
            }} />
          )))}
          {error ? <Text style={[typography.caption12, { color: colors.danger }]}>{error}</Text> : null}
          {pending && !busy ? <Pressable onPress={refreshStatus}><Text style={styles.link}>답변 상태 다시 확인</Text></Pressable> : null}
        </Pressable>
      </ScrollView>

      <View style={[styles.inputWrap, { paddingBottom: space.sm + (kbOpen ? 0 : insets.bottom) }]}>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={context.placeholder}
            placeholderTextColor={colors.textDisabled}
            style={styles.input}
            multiline
          />
          <Pressable accessibilityLabel="질문 보내기" onPress={() => send(text)} disabled={locked || !text.trim()} hitSlop={8} style={{ opacity: locked || !text.trim() ? 0.4 : 1 }}>
            {busy ? <ActivityIndicator color={colors.primary} /> : <Icon source={require('../../assets/icons/send.svg')} width={20} height={20} />}
          </Pressable>
        </View>
        {/* 'N Credits 남음'은 이용 한도 API(PLAN-02) 연동 전이라 두지 않는다 */}
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={!full} onRequestClose={onClose} presentationStyle={full ? 'fullScreen' : 'overFullScreen'}>
      {full ? (
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.xxl, paddingHorizontal: space.lg }}>{body}</View>
      ) : (
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
            {/* 핸들 영역: 위로 당기면 전체 화면, 아래로 내리면 닫기. 탭하면 전체 화면 */}
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
  const streaming = chatApi.isAssistantPending(m.status);
  const noGround = m.status === 'COMPLETED' && m.finishReason === 'INSUFFICIENT_EVIDENCE';
  const sources = m.sources ?? [];
  return (
    <View style={{ gap: 20 }}>
      {m.content ? <Text style={styles.answer}>{m.content}</Text> : streaming ? <Text style={[typography.body14Medium, { color: colors.textSub }]}>기록을 찾아보는 중이에요…</Text> : null}
      {noGround ? <Text style={[typography.body13Medium, { color: colors.textSub }]}>선택한 기록에서 근거를 찾지 못했어요. 범위를 넓혀 새 대화를 시작해 보세요.</Text> : null}
      {m.status === 'INCOMPLETE' || m.status === 'FAILED' ? (
        <View style={styles.warn}>
          <Text style={[typography.body13Medium, { color: colors.textSub }]}>{m.status === 'FAILED' ? '답변을 만들지 못했어요.' : '답변이 중간에 끊겼어요.'}</Text>
          {m.retryable && m.messageId ? <Pressable onPress={onRetry}><Text style={styles.link}>다시 요청</Text></Pressable> : null}
        </View>
      ) : null}
      {!streaming && sources.length ? (
        <View style={{ gap: space.sm }}>
          <Text style={[typography.body14Semibold, { color: colors.textMuted }]}>참고한 분석기록</Text>
          {sources.map((s) => {
            const available = s.availability === 'AVAILABLE';
            return (
              <Pressable key={s.sourceId} onPress={() => onOpenSource(s)} disabled={!available} style={({ pressed }) => [styles.source, !available && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body14Semibold, { color: colors.textBody }]} numberOfLines={1}>
                    {available ? (s.sectionId ? formatMs(s.startMs) : '한 줄 요약') : '삭제된 기록'}
                  </Text>
                  <Text style={[typography.body13Medium, { lineHeight: 18, color: colors.textDisabled }]} numberOfLines={1}>{s.title}</Text>
                </View>
                {available ? <Icon source={require('../../assets/icons/chevron-source.svg')} width={19} height={18} style={{ transform: [{ scaleX: -1 }] }} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {/* 복사·평가·공유 아이콘은 연동 전이라 두지 않는다 */}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(13,29,40,0.5)' },
  sheet: { height: '78%', backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', paddingLeft: 14, paddingRight: space.lg, paddingBottom: space.md },
  grabberZone: { height: 34, alignItems: 'center', paddingTop: 10 },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scopeBox: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingTop: space.md, paddingBottom: 20, paddingHorizontal: space.lg },
  scopeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs, minHeight: 28 },
  smallBtn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  link: { ...typography.button12, fontSize: 13, color: colors.primaryStrong },
  answer: { ...typography.body14Medium, color: colors.textStrong },
  suggest: { backgroundColor: colors.primarySoft, borderRadius: 100, paddingHorizontal: space.lg, paddingVertical: space.sm },
  userBubble: { alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: colors.primarySoft, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 12, borderBottomRightRadius: 2, paddingHorizontal: space.lg, paddingVertical: space.sm },
  warn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  source: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingLeft: 15, paddingRight: space.sm, paddingVertical: space.md },
  inputWrap: { paddingTop: space.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 300, paddingHorizontal: space.lg, minHeight: 44 },
  input: { flex: 1, maxHeight: 120, ...typography.body14Semibold, color: colors.text, paddingVertical: 10 },
});
