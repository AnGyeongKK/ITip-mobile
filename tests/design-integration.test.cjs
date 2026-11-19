const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function confirmHarness(existing, createError) {
  const state = [];
  let index = 0;
  const effects = [];
  const routes = [];
  const resumed = [];
  let creates = 0;
  const jsx = (type, props) => ({ type, props });
  class ApiError extends Error {
    constructor(status, code, location) { super(code); Object.assign(this, { status, code, location }); }
  }
  const dependencies = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useState: (initial) => {
        const key = index++;
        if (!(key in state)) state[key] = initial;
        return [state[key], (value) => { state[key] = typeof value === 'function' ? value(state[key]) : value; }];
      },
      useEffect: (effect) => { effects.push(effect); },
    },
    'react-native': { StyleSheet: { create: (s) => s }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    'expo-router': {
      useLocalSearchParams: () => ({ url: 'https://youtu.be/abcdefghijk' }),
      router: { replace: (route) => routes.push(route), push: (route) => routes.push(route), dismissTo: (route) => routes.push(route), back() {} },
    },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/api/client': { ApiError },
    '@/api/intake': { getJob: async () => ({ batchId: 'existing-batch' }), conflictBatchId: (error) => error.location ? 'existing-batch' : null },
    '@/api/quota': { minutes: (ms) => String(ms) },
    '@/components/AppShell': { AppScreen: 'AppScreen' },
    '@/components/IntakeError': { IntakeError: 'IntakeError', toIssue: (e) => ({ code: e.code }) },
    '@/components/ui': { Button: 'Button' },
    '@/components/VideoConfirmCard': { VideoConfirmCard: 'VideoConfirmCard' },
    '@/features/analysis/collectStore': { useCollectStore: { getState: () => ({ rememberBatch() {}, requireResume: (id) => resumed.push(id) }) } },
    '@/features/analysis/lookupIssue': { lookupIssue: (e) => ({ code: e.code }) },
    '@/features/analysis/parseYoutubeUrl': { parseYoutubeUrl: () => ({ type: 'video' }) },
    '@/hooks/intakeQueries': {
      useImportResource: () => ({ mutateAsync: async () => ({ type: 'VIDEO', videoId: 'abcdefghijk', metadata: { durationMs: 60_000 }, existing, captionRequirement: { maxDurationMs: 3_600_000 } }) }),
      useCreateBatch: () => ({ isPending: false, mutateAsync: async () => { creates++; if (createError) throw new ApiError(409, 'STATE_CONFLICT', '/api/v1/analysis-batches/existing-batch'); return { batchId: 'new-batch' }; } }),
    },
    '@/hooks/useQuota': { useQuota: () => ({ data: null }) },
    '@/theme/tokens': { colors: {}, palette: { primary: {} }, radius: {}, typography: {} },
  };
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync('src/app/confirm.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInThisContext(`(function(require,module,exports,setTimeout){${js}\n})`)((name) => {
    if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name);
    return dependencies[name];
  }, module, module.exports, (callback) => setTimeout(callback, 0));
  const render = () => { index = 0; effects.length = 0; return module.exports.default(); };
  const settle = async () => { render(); effects[0](); await new Promise((resolve) => setTimeout(resolve, 20)); };
  return { routes, resumed, state, render, settle, creates: () => creates };
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [].concat(node.props?.children ?? [])) { const match = find(child, predicate); if (match) return match; }
  return null;
}

test('confirmation reopens an awaiting upload without creating a new batch', async () => {
  const h = confirmHarness({ status: 'AWAITING_UPLOAD', batchId: 'existing-batch' });
  await h.settle();
  assert.deepEqual(h.routes.at(-1), { pathname: '/analyze/[batchId]', params: { batchId: 'existing-batch' } });
  assert.deepEqual(h.resumed, ['existing-batch']);
  assert.equal(h.creates(), 0);
});

test('confirmation preserves explicit resume when reopening a processing job', async () => {
  const h = confirmHarness({ status: 'PROCESSING', jobId: 'existing-job' });
  await h.settle();
  assert.deepEqual(h.resumed, ['existing-batch']);
  assert.equal(h.routes.at(-1)?.params.batchId, 'existing-batch');
});

test('confirmation opens completed results without consuming a new analysis', async () => {
  const h = confirmHarness({ status: 'COMPLETED', analysisId: 'existing-analysis' });
  await h.settle();
  assert.equal(h.routes.at(-1)?.params.analysisId, 'existing-analysis');
  assert.equal(h.creates(), 0);
});

test('confirmation follows an existing batch after a create conflict', async () => {
  const h = confirmHarness({ status: 'NONE' }, true);
  await h.settle();
  const button = find(h.render(), (node) => node.type === 'Button' && node.props.title === '분석 하기');
  assert.ok(button);
  await button.props.onPress();
  assert.equal(h.creates(), 1);
  assert.equal(h.routes.at(-1)?.params.batchId, 'existing-batch');
  assert.deepEqual(h.resumed, ['existing-batch']);
});

test('home opens continue-reading even when no analysis is running', () => {
  const jsx = (type, props) => ({ type, props });
  const routes = [];
  const cr = { analysisId: 'analysis', sectionId: 'section', sectionTitle: '자료 수집과 출처 기반 대화', sectionSummary: '이어서 읽을 내용', startMs: 1000, endMs: 2000 };
  const dependencies = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: (value) => [value, () => {}], useEffect() {}, useCallback: (fn) => fn, useRef: (value) => ({ current: value }) },
    'react-native': { StyleSheet: { create: (s) => s }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    'expo-router': { useLocalSearchParams: () => ({}), router: { push: (route) => routes.push(route) } },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }) },
    '@/api/intake': { isBatchDone: () => false },
    '@/components/AppShell': { AppScreen: 'AppScreen' },
    '@/components/IntakeError': { IntakeError: 'IntakeError' },
    '@/components/ui': { ErrorView: 'ErrorView', LoadingView: 'LoadingView' },
    '@/features/analysis/collectStore': { useCollectStore: (select) => select({ hydrated: true, batchId: null }) },
    '@/features/analysis/parseYoutubeUrl': { parseYoutubeUrl() {} },
    '@/features/analysis/useCaptionCollection': { useCaptionCollection() {} },
    '@/features/home/HomeSections': {},
    '@/hooks/intakeQueries': { useBatch: () => ({}) },
    '@/hooks/queries': { qk: { home: ['home'] }, useHome: () => ({ data: { recentAnalyses: [], continueReading: cr } }) },
    '@/hooks/useQuota': { useQuota: () => ({ data: null }) },
    '@/lib/handoff': { openResult() {} },
    '@/lib/format': { formatRange: () => '00:01 - 00:02' },
    '@/theme/tokens': { colors: {}, typography: {} },
  };
  const js = ts.transpileModule(fs.readFileSync('src/app/index.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`)((name) => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  }, module, module.exports);
  const tree = module.exports.default();
  const card = find(tree, (n) => n.type === 'Pressable' && !!find(n, (t) => t.type === 'Text' && t.props.children === cr.sectionTitle));
  assert.ok(card, 'Continue-reading must remain visible without a running batch');
  card.props.onPress();
  assert.deepEqual(routes.at(-1), { pathname: '/section/[analysisId]/[sectionId]', params: { analysisId: 'analysis', sectionId: 'section' } });
});
