const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => {
    if (name in dependencies) return dependencies[name];
    if (name.endsWith('.svg')) return name;
    throw new Error(`Unexpected dependency: ${name}`);
  };
  vm.runInThisContext(`(function(require, module, exports, process) { ${js}\n})`, { filename: file })(localRequire, module, module.exports, process);
  return module.exports;
}

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const location = `/api/v1/analysis-batches/${uuid}`;
let responseError;
const http = { interceptors: { request: { use() {} } }, request: async () => { throw responseError; } };
const client = load('src/api/client.ts', { axios: { create: () => http }, 'expo-crypto': {} });
const intake = load('src/api/intake.ts', { './client': client, './mock/db': { records: [] } });

test('409 Location is propagated and only a matching relative batch URL is accepted', async () => {
  responseError = { response: { status: 409, data: { code: 'STATE_CONFLICT' }, headers: { location } } };
  await assert.rejects(client.request({}), (error) => intake.conflictBatchId(error) === uuid);
  for (const bad of [undefined, 'https://evil.example' + location, location + '?x=1', '/api/v1/analysis-batches/nope']) {
    assert.equal(intake.conflictBatchId(new client.ApiError(409, 'STATE_CONFLICT', '', undefined, bad)), null);
  }
  assert.equal(intake.conflictBatchId(new client.ApiError(400, 'STATE_CONFLICT', '', undefined, location)), null);
  assert.equal(intake.conflictBatchId(new client.ApiError(409, 'OTHER', '', undefined, location)), null);
});

test('restored batches require resume while already authorized collection keeps running', () => {
  const create = () => (initializer) => {
    let state;
    const set = (update) => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
    state = initializer(set);
    return { getState: () => state };
  };
  const store = load('src/features/analysis/collectStore.ts', {
    '@react-native-async-storage/async-storage': { default: {} },
    zustand: { create },
    'zustand/middleware': { persist: (init) => init, createJSONStorage: () => ({}) },
  }).useCollectStore;
  store.getState().requireResume(uuid);
  assert.equal(store.getState().batchId, uuid);
  assert.equal(store.getState().allowedBatches.includes(uuid), false);
  store.getState().allowBatch(uuid);
  store.getState().requireResume(uuid);
  assert.equal(store.getState().allowedBatches.includes(uuid), true);
});

test('saved conversation scope describes its actual video, section, filtered or all context', () => {
  const { savedScopePresentation } = load('src/features/chat/savedScopePresentation.ts');
  assert.match(savedScopePresentation({ type: 'RECORD', recordId: '1' }).placeholder, /영상/);
  assert.match(savedScopePresentation({ type: 'RECORD', recordId: '1', focusSectionId: '2' }).placeholder, /구간/);
  assert.match(savedScopePresentation({ type: 'FILTERED' }).intro, /선택한 범위/);
  assert.match(savedScopePresentation({ type: 'ALL' }).intro, /모든 기록/);
});

test('conflicting playlist retains only selected videos still eligible for a new batch', () => {
  const { availableSelection } = load('src/features/analysis/playlistSelection.ts');
  const items = [
    { videoId: 'a', eligibility: 'ELIGIBLE', existing: { status: 'AWAITING_UPLOAD' } },
    { videoId: 'b', eligibility: 'ELIGIBLE', existing: { status: 'NONE' } },
    { videoId: 'c', eligibility: 'INELIGIBLE', existing: { status: 'NONE' } },
  ];
  assert.deepEqual([...availableSelection(new Set(['a', 'b', 'c']), items)], ['b']);
});

test('saved conversation cannot send while loading or when its scope is unavailable', () => {
  const { isConversationSendLocked } = load('src/features/chat/savedScopePresentation.ts');
  const scope = { type: 'RECORD', recordId: '1' };
  assert.equal(isConversationSendLocked(false, false, true, undefined, undefined), true);
  assert.equal(isConversationSendLocked(false, false, true, scope, 'UNAVAILABLE'), true);
  assert.equal(isConversationSendLocked(false, false, true, scope, 'EMPTY'), true);
  assert.equal(isConversationSendLocked(false, false, true, scope, 'AVAILABLE'), false);
  assert.equal(isConversationSendLocked(false, false, false, undefined, undefined), false);
});

function renderSavedConversation(status) {
  const scope = { type: 'ALL' };
  const history = [{ key: 'old-user', role: 'USER', content: '이전 질문' }];
  const state = [true, 'room', history, '', false, scope, '전체 분석 기록', status];
  let stateIndex = 0;
  const jsx = (type, props) => ({ type, props });
  const native = {
    Animated: { Value: class { interpolate() { return 0; } } },
    PanResponder: { create: () => ({}) },
    Keyboard: { dismiss: () => {} },
    StyleSheet: { create: (s) => s },
    Platform: { OS: 'android' },
  };
  const { AgentSheet } = load('src/components/AgentSheet.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useState: (initial) => [stateIndex < state.length ? state[stateIndex++] : typeof initial === 'function' ? initial() : initial, () => {}],
      useCallback: (callback) => callback,
      useMemo: (factory) => factory(),
      useRef: (value) => ({ current: value }),
      useEffect: () => {},
    },
    'react-native': new Proxy(native, { get: (target, key) => target[key] ?? key }),
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@tanstack/react-query': { useQueryClient: () => ({}) },
    'expo-router': {},
    '../api/client': { newIdempotencyKey: () => uuid },
    '../api/chat': {},
    '../lib/format': {},
    '../theme/tokens': { colors: {}, radius: {}, space: {}, typography: {} },
    './ui': { Icon: 'Icon' },
    '../features/chat/savedScopePresentation': load('src/features/chat/savedScopePresentation.ts'),
  });
  const session = AgentSheet({ visible: true, startFull: true, conversationId: 'room', context: { scope, suggestions: [] } });
  return JSON.stringify(session.type(session.props));
}

test('an empty or unavailable saved scope explains the lock and keeps existing chat visible', () => {
  for (const status of ['EMPTY', 'UNAVAILABLE']) {
    const tree = renderSavedConversation(status);
    assert.match(tree, /새 질문을 보낼 수 없어요/);
    assert.match(tree, /이전 질문/);
    assert.match(tree, /"editable":false/);
    assert.doesNotMatch(tree, /새 대화/);
  }
  const available = renderSavedConversation('AVAILABLE');
  assert.match(available, /새 대화/);
  assert.match(available, /"editable":true/);
});
