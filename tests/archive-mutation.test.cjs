const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const element = (type, props) => ({ type, props });
const componentNames = new Proxy({}, { get: (_, key) => key });
const folder = { folderId: 'folder-id', name: '테스트 폴더', recordCount: 1 };

function render(file, mutation, stateOverrides = [], props) {
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const calls = { back: 0, alerts: [] };
  const readState = (initial) => [stateOverrides.length ? stateOverrides.shift() : initial, () => {}];
  const queries = {
    useAddRecordsToFolder: () => mutation, useDeleteFolder: () => mutation,
    useDeleteRecord: () => mutation, useRemoveRecordFromFolder: () => mutation,
    useDeleteConversation: () => mutation,
    useConversations: () => ({ data: { items: [] } }),
    useFolder: () => ({ data: folder }), useRecords: () => ({}), useRecordKeywords: () => ({}),
  };
  const theme = { colors: {}, font: {}, radius: {}, space: {}, typography: {} };
  const dependencies = {
    'react/jsx-runtime': { jsx: element, jsxs: element },
    react: { useState: readState },
    'react-native': { ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View'].map((name) => [name, name])),
      Alert: { alert: (...args) => calls.alerts.push(args) }, StyleSheet: { create: (styles) => styles } },
    'react-native-safe-area-context': componentNames,
    'expo-router': { router: { back: () => calls.back++ }, useLocalSearchParams: () => ({ folderId: folder.folderId }) },
    '@/api/client': { ApiError: class extends Error {} },
    '@/hooks/queries': queries,
    '../hooks/queries': queries,
    '@/hooks/useDebounced': { useDebounced: (value) => value },
    '@/theme/tokens': theme,
    '../theme/tokens': theme,
    '@/lib/handoff': { agentForFolder: () => ({}) },
    '../lib/handoff': { agentForAll: () => ({}) },
    '../lib/format': { formatDate: () => '' },
    '@/lib/format': { formatDate: () => '' },
    '../api/client': { ApiError: class extends Error {} },
  };
  const exports = {};
  const requireMock = (name) => name.includes('/components/') || name === './RecordCard' || name === './ui' ? componentNames : dependencies[name];
  vm.runInNewContext(js, { exports, require: requireMock });
  return { tree: (exports.default ?? exports.RecordList)(props), calls };
}

function find(node, predicate) {
  if (Array.isArray(node)) return node.map((child) => find(child, predicate)).find(Boolean);
  if (predicate(node)) return node;
  return node?.props ? find(node.props.children, predicate) ?? find(node.props.header, predicate) : undefined;
}

const failed = {
  isError: true,
  mutateAsync: () => Promise.reject(new Error('fixture failure')),
  mutate: (_body, callbacks) => callbacks?.onError?.(new Error('fixture failure')),
};

test('failed add keeps the selected record on screen and never rejects through the press handler', async () => {
  const { tree, calls } = render('src/app/archive/folders/[folderId]/add.tsx', failed, ['', ['record-id']]);
  const { onPress, title } = find(tree, (node) => node?.type === 'Button').props;
  assert.equal(title, '1개 추가하기');
  await assert.doesNotReject(async () => onPress());
  assert.equal(calls.back, 0);
  assert.ok(find(tree, (node) => typeof node?.props?.children === 'string' && node.props.children.startsWith('추가하지 못했어요')));
});

test('failed folder deletion keeps the folder open and gives feedback without rejecting', async () => {
  const { tree, calls } = render('src/app/archive/folders/[folderId]/index.tsx', failed);
  find(tree, (node) => node?.props?.accessibilityLabel === '폴더 메뉴').props.onPress();
  calls.alerts.at(-1)[2].find(({ text }) => text === '폴더 삭제').onPress();
  const confirm = calls.alerts.at(-1)[2].find(({ text }) => text === '삭제');
  await assert.doesNotReject(async () => confirm.onPress());
  assert.equal(calls.back, 0);
  assert.equal(calls.alerts.at(-1)[0], '폴더를 삭제하지 못했어요');
});

test('failed record unlink and deletion each provide feedback from the action menu', () => {
  const { tree, calls } = render('src/components/RecordList.tsx', failed, [], { query: { folderId: folder.folderId } });
  const card = tree.props.renderItem({ item: { recordId: 'record-id', video: { title: '테스트 영상' } } });
  card.props.onLongPress();
  calls.alerts.at(-1)[2].find(({ text }) => text === '이 폴더에서 빼기').onPress();
  assert.equal(calls.alerts.at(-1)[0], '폴더에서 기록을 빼지 못했어요');
  card.props.onLongPress();
  calls.alerts.at(-1)[2].find(({ text }) => text === '기록 삭제').onPress();
  calls.alerts.at(-1)[2].find(({ text }) => text === '삭제').onPress();
  assert.equal(calls.alerts.at(-1)[0], '기록을 삭제하지 못했어요');
});

test('failed chat deletion provides feedback instead of silently leaving the chat in the list', () => {
  const { tree, calls } = render('src/app/agent.tsx', failed);
  const list = find(tree, (node) => node?.type === 'FlatList');
  list.props.renderItem({ item: { conversationId: 'room-id', activeAssistantMessageId: null } }).props.onLongPress();
  calls.alerts.at(-1)[2].find(({ text }) => text === '삭제').onPress();
  assert.equal(calls.alerts.at(-1)[0], '대화를 삭제하지 못했어요');
});
