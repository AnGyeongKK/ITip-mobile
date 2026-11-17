const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => {
    if (name in dependencies) return dependencies[name];
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
  assert.equal(isConversationSendLocked(false, false, true, scope, 'AVAILABLE'), false);
  assert.equal(isConversationSendLocked(false, false, false, undefined, undefined), false);
});
