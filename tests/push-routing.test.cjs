const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/notifications/launchResponse.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: exportsObject,
  require: () => ({ DEFAULT_ACTION_IDENTIFIER: 'default' }),
});
const { notificationTarget } = exportsObject;
const id = '550e8400-e29b-41d4-a716-446655440000';
const response = (data, actionIdentifier = 'default') => ({
  actionIdentifier, notification: { request: { content: { data } } },
});

test('single success notification opens the result and a batch notification opens its progress', () => {
  const single = notificationTarget(response({ type: 'ANALYSIS_BATCH_FINISHED', analysisId: id }));
  assert.equal(single.pathname, '/result/[analysisId]');
  assert.equal(single.params.analysisId, id);
  const batch = notificationTarget(response({ type: 'ANALYSIS_BATCH_FINISHED', batchId: id }));
  assert.equal(batch.pathname, '/analyze/[batchId]');
  assert.equal(batch.params.batchId, id);
});

test('unresolved, malformed and unrelated notification responses leave normal navigation available', () => {
  for (const item of [
    undefined, null, response({}), response({ type: 'OTHER', analysisId: id }),
    response({ type: 'ANALYSIS_BATCH_FINISHED', analysisId: '../settings' }),
    response({ type: 'ANALYSIS_BATCH_FINISHED', batchId: 5 }),
    response({ type: 'ANALYSIS_BATCH_FINISHED', batchId: id }, 'dismiss'),
  ]) assert.equal(notificationTarget(item), null);
});
