const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const exported = {};
const dependencies = {
  'expo-modules-core': { requireOptionalNativeModule: () => null },
  '@/api/client': { USE_MOCK: false },
};
vm.runInNewContext(ts.transpileModule(readFileSync('src/features/analysis/captions.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exported, require: (name) => dependencies[name] });

test('a subtitle cue extending past the video end keeps its text and clips the end time', () => {
  const result = exported.parseJson3(JSON.stringify({ events: [
    { tStartMs: 500, dDurationMs: 800, segs: [{ utf8: '마지막 문장' }] },
  ] }), 'fixture1234', 1000);
  assert.equal(result.segments[0].startMs, 500);
  assert.equal(result.segments[0].endMs, 1000);
  assert.equal(result.segments[0].text, '마지막 문장');
});

test('negative, reversed and zero-length cues remain invalid', () => {
  for (const events of [
    [{ tStartMs: -1, dDurationMs: 100, segs: [{ utf8: 'x' }] }],
    [{ tStartMs: 0, dDurationMs: 0, segs: [{ utf8: 'x' }] }],
    [{ tStartMs: 200, dDurationMs: 50, segs: [{ utf8: 'x' }] },
      { tStartMs: 100, dDurationMs: 50, segs: [{ utf8: 'y' }] }],
  ]) assert.throws(() => exported.parseJson3(JSON.stringify({ events }), 'fixture1234', 1000));
});
