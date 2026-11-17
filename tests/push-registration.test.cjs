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

function openRegistration(status) {
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
      getDevicePushTokenAsync: async () => { tokenReads++; return { data: 'synthetic-token' }; },
    },
    'react-native': { Platform: { OS: 'android' } },
    '@/api/devices': devices,
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
