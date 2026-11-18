const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies) {
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: (name) => dependencies[name] });
  return exports;
}

const installationId = '550e8400-e29b-41d4-a716-446655440000';

function openRegistration(status, options = {}) {
  const calls = [];
  let tokenReads = 0;
  const values = new Map();
  const storage = {
    getItem: async (name) => values.get(name),
    setItem: async (name, value) => values.set(name, value),
  };
  const devices = load('src/api/devices.ts', {
    './client': { USE_MOCK: false, request: async (req) => calls.push(JSON.parse(JSON.stringify(req))) },
  });
  const { syncPushDevice } = load('src/features/notifications/pushDevice.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    'expo-crypto': { randomUUID: () => installationId },
    'expo-notifications': {
      AndroidImportance: { HIGH: 4 }, setNotificationChannelAsync: async () => {},
      getPermissionsAsync: async () => ({ status }),
      getDevicePushTokenAsync: async () => {
        tokenReads++;
        if (options.tokenError) throw new Error('Firebase unavailable');
        return { data: 'synthetic-token' };
      },
    },
    'react-native': { Platform: { OS: 'android' } },
    '@/api/devices': devices,
    '@/api/client': { USE_MOCK: false, API_BASE_URL: 'https://fixture.invalid' },
    './mode': { LOCAL_ANALYSIS_NOTIFICATIONS: options.local ?? false },
  });
  return { syncPushDevice, calls, tokenReads: () => tokenReads };
}

test('Android registration sends the server permission enum and only reads a token when granted', async () => {
  for (const [status, notificationPermission, fcmToken] of [
    ['undetermined', 'NOT_DETERMINED', null],
    ['denied', 'DENIED', null],
    ['granted', 'GRANTED', 'synthetic-token'],
  ]) {
    const device = openRegistration(status);
    await device.syncPushDevice();
    await device.syncPushDevice();
    assert.deepEqual(device.calls, [{
      method: 'PUT', url: `/api/v1/users/me/devices/${installationId}`,
      data: { platform: 'ANDROID', fcmToken, notificationPermission },
    }]);
    assert.equal(device.tokenReads() > 0, status === 'granted');
  }
});

test('missing Firebase token returns a retryable status without claiming registration succeeded', async () => {
  const device = openRegistration('granted', { tokenError: true });
  assert.equal(await device.syncPushDevice(), 'token_unavailable');
  assert.equal(await device.syncPushDevice({ knownToken: 'refreshed-token' }), 'registered');
  assert.equal(device.calls.at(-1).data.fcmToken, 'refreshed-token');
});

test('permission states are reported to the UI independently from the server registration', async () => {
  assert.equal(await openRegistration('undetermined').syncPushDevice(), 'permission_required');
  assert.equal(await openRegistration('denied').syncPushDevice(), 'permission_denied');
  assert.equal(await openRegistration('granted').syncPushDevice(), 'registered');
});

test('local notifications require no Firebase token or remote device registration', async () => {
  const device = openRegistration('granted', { local: true, tokenError: true });
  assert.equal(await device.syncPushDevice(), 'local_ready');
  assert.equal(device.tokenReads(), 0);
  assert.deepEqual(device.calls, []);
});
