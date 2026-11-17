const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const js = ts.transpileModule(readFileSync('src/api/chat.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function openStream() {
  const calls = [];
  const listeners = new Map();
  class EventSource {
    addEventListener(event, listener) { listeners.set(event, listener); }
    removeAllEventListeners() { listeners.clear(); }
    close() {}
  }
  const dependencies = {
    'react-native-sse': { __esModule: true, default: EventSource },
    './client': { CHAT_BASE_URL: 'http://localhost', USE_MOCK: false },
    './mock/db': {},
  };
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) => dependencies[name],
    XMLHttpRequest: { LOADING: 3, DONE: 4 },
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  exports.streamMessage('room', { clientRequestId: 'key', content: '질문', retryOfMessageId: null }, {
    onRejected: (message) => calls.push(['rejected', message]),
    onDisconnected: () => calls.push(['recover']),
    onServerError: ({ code }) => calls.push(['server-error', code]),
  });
  return {
    calls,
    emitError: (event) => listeners.get('error')?.(event),
  };
}

test('a duplicate question is recovered by its original clientRequestId', () => {
  const stream = openStream();
  stream.emitError({ xhrStatus: 409, xhrState: 4, message: '{"code":"DUPLICATE_CHAT_REQUEST","message":"기존 요청"}' });
  assert.deepEqual(stream.calls, [['recover']]);
});

test('a partial 409 response waits for the complete rejection message', () => {
  const stream = openStream();
  stream.emitError({ xhrStatus: 409, xhrState: 3, message: '{"code":"CHAT_GENERATION' });
  assert.deepEqual(stream.calls, []);
  stream.emitError({ xhrStatus: 409, xhrState: 4, message: '{"code":"CHAT_GENERATION_IN_PROGRESS","message":"답변이 완료된 후 다시 요청해 주세요."}' });
  assert.deepEqual(stream.calls, [['rejected', '답변이 완료된 후 다시 요청해 주세요.']]);
});

test('a completed 409 for an active answer rejects the new key before it can be polled', () => {
  const stream = openStream();
  stream.emitError({ xhrStatus: 409, xhrState: 4, message: '{"code":"CHAT_GENERATION_IN_PROGRESS","message":"답변이 완료된 후 다시 요청해 주세요."}' });
  assert.deepEqual(stream.calls, [['rejected', '답변이 완료된 후 다시 요청해 주세요.']]);
});

test('typed admission failures keep the question draft, and ambiguous failures still recover', () => {
  for (const code of ['CHAT_CAPACITY_EXCEEDED', 'CHAT_AI_NOT_CONFIGURED']) {
    const stream = openStream();
    stream.emitError({ xhrStatus: 503, xhrState: 4, message: JSON.stringify({ code, message: '잠시 후 다시 질문해 주세요.' }) });
    assert.deepEqual(stream.calls, [['rejected', '잠시 후 다시 질문해 주세요.']]);
  }
  for (const xhrStatus of [0, 500, 502]) {
    const stream = openStream();
    stream.emitError({ xhrStatus, xhrState: 4, message: '' });
    assert.deepEqual(stream.calls, [['recover']]);
  }
});

test('an accepted answer still handles a structured stream error', () => {
  const stream = openStream();
  stream.emitError({ data: '{"code":"CHAT_STREAM_FAILED","status":"INCOMPLETE"}' });
  assert.deepEqual(stream.calls, [['server-error', 'CHAT_STREAM_FAILED']]);
});
