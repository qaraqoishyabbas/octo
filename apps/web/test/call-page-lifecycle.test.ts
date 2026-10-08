import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import { computed, markRaw, nextTick, ref } from 'vue';

const filename = new URL('../app/pages/calls/room/[username].vue', import.meta.url).pathname;
const source = readFileSync(filename, 'utf8');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function capture() {
  const track = {
    stops: 0,
    stop() {
      this.stops += 1;
    },
    addEventListener() {},
  };
  const stream = markRaw({ getTracks: () => [track], getVideoTracks: () => [track] });
  return { track, stream };
}

function setup() {
  const captures: Array<ReturnType<typeof deferred<ReturnType<typeof capture>['stream']>>> = [];
  const timers = new Map<number, () => void>();
  const signals: string[] = [];
  const unmounted: Array<() => void> = [];
  let timerId = 0;
  let canSend = true;
  class Peer {
    connectionState = 'disconnected';
    closes = 0;
    onconnectionstatechange: (() => void) | null = null;
    close() {
      this.closes += 1;
      this.connectionState = 'closed';
      this.onconnectionstatechange?.();
    }
    addTransceiver() {}
    getTransceivers() {
      return [];
    }
    async createOffer() {
      return { type: 'offer', sdp: 'offer' };
    }
    async setLocalDescription() {}
  }
  const storage = { getItem: () => null, setItem() {} };
  const globals = {
    exports: {},
    require: () => ({ createLocalId: () => 'local', copyToClipboard: async () => {} }),
    definePageMeta() {},
    useSeoMeta() {},
    useRoute: () => ({ params: { username: 'room' } }),
    useAuthStore: () => ({ user: { id: 'user', name: 'Local' } }),
    useWebSocketStore: () => ({
      status: 'connected',
      unsubscribe() {},
      triggerPrivate: (_channel: string, event: string) => {
        signals.push(event);
        return canSend;
      },
    }),
    useToast: () => ({ add() {} }),
    computed,
    ref,
    nextTick,
    watch: () => () => {},
    onMounted() {},
    onBeforeUnmount: (callback: () => void) => unmounted.push(callback),
    localStorage: storage,
    sessionStorage: storage,
    navigator: {
      mediaDevices: {
        getDisplayMedia: () => {
          const pending = deferred<ReturnType<typeof capture>['stream']>();
          captures.push(pending);
          return pending.promise;
        },
        removeEventListener() {},
      },
    },
    window: {
      setTimeout: (callback: () => void) => {
        timers.set(++timerId, callback);
        return timerId;
      },
      removeEventListener() {},
    },
    clearTimeout: (id: number) => timers.delete(id),
    clearInterval() {},
    RTCPeerConnection: Peer,
  };
  const { descriptor } = parse(source);
  const code = ts.transpileModule(
    descriptor.scriptSetup!.content.replaceAll('import.meta.client', 'true'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  const state = new Function(
    ...Object.keys(globals),
    `${code}\nreturn {
    startScreenShare, stopScreenShare, screenStream, screenSharing, isJoined,
    ensurePeerConnection, closePeerConnection, schedulePeerReconnect, peerConnections,
    remoteParticipants, leaveCallChannel, sendCallEvent
  };`,
  )(...Object.values(globals));
  state.isJoined.value = true;
  state.remoteParticipants.value = [{ id: 'remote', stream: null }];
  return {
    state,
    captures,
    timers,
    signals,
    unmount: () => unmounted.forEach((fn) => fn()),
    disconnectTransport: () => {
      canSend = false;
    },
    runTimers: () => {
      const pending = [...timers.entries()];
      pending.forEach(([id, callback]) => {
        timers.delete(id);
        callback();
      });
    },
  };
}

for (const exit of ['leave', 'unmount'] as const) {
  test(`screen capture accepted after ${exit} stops tracks without installing the stream`, async () => {
    const ui = setup();
    const pending = ui.state.startScreenShare();
    if (exit === 'leave') ui.state.leaveCallChannel();
    else ui.unmount();
    const media = capture();
    ui.captures[0]!.resolve(media.stream);
    await pending;
    assert.equal(media.track.stops, 1);
    assert.equal(ui.state.screenStream.value, null);
    assert.equal(ui.state.screenSharing.value, false);
    assert.deepEqual(ui.signals, ['call.left']);
  });
}

test('a superseded screen picker cannot replace the current capture', async () => {
  const ui = setup();
  const first = ui.state.startScreenShare();
  const second = ui.state.startScreenShare();
  const current = capture();
  ui.captures[1]!.resolve(current.stream);
  await second;
  const stale = capture();
  ui.captures[0]!.resolve(stale.stream);
  await first;
  assert.equal(stale.track.stops, 1);
  assert.equal(current.track.stops, 0);
  assert.equal(ui.state.screenStream.value, current.stream);
});

test('recovered peers cancel their reconnect timer', () => {
  const ui = setup();
  const peer = ui.state.ensurePeerConnection('remote');
  peer.onconnectionstatechange();
  peer.connectionState = 'connected';
  peer.onconnectionstatechange();
  assert.equal(ui.timers.size, 0);
  ui.runTimers();
  assert.equal(peer.closes, 0);
  assert.equal(ui.state.peerConnections.get('remote'), peer);
});

test('reconnect callbacks recheck recovery even before the state-change event arrives', () => {
  const ui = setup();
  const peer = ui.state.ensurePeerConnection('remote');
  peer.onconnectionstatechange();
  peer.connectionState = 'connected';
  ui.runTimers();
  assert.equal(peer.closes, 0);
  assert.equal(ui.state.peerConnections.get('remote'), peer);
  assert.equal(ui.timers.size, 0);
});

test('reconnect scheduling owns one timer and replaces a failed peer once', async () => {
  const ui = setup();
  const peer = ui.state.ensurePeerConnection('remote');
  peer.onconnectionstatechange();
  peer.connectionState = 'failed';
  peer.onconnectionstatechange();
  assert.equal(ui.timers.size, 1);
  ui.runTimers();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(peer.closes, 1);
  assert.notEqual(ui.state.peerConnections.get('remote'), peer);
  assert.deepEqual(ui.signals, ['call.offer']);
});

test('obsolete reconnect callbacks cannot close a replacement peer', () => {
  const ui = setup();
  const peer = ui.state.ensurePeerConnection('remote');
  peer.onconnectionstatechange();
  const callback = [...ui.timers.values()][0]!;
  ui.state.closePeerConnection('remote');
  const replacement = ui.state.ensurePeerConnection('remote');
  callback();
  peer.onconnectionstatechange();
  assert.equal(replacement.closes, 0);
  assert.equal(ui.state.peerConnections.get('remote'), replacement);
  assert.equal(ui.timers.size, 0);
});

for (const exit of ['leave', 'unmount'] as const) {
  test(`${exit} cancels reconnect and signaling retries before rejoining`, () => {
    const ui = setup();
    const peer = ui.state.ensurePeerConnection('remote');
    peer.onconnectionstatechange();
    ui.disconnectTransport();
    ui.state.sendCallEvent('call.joined');
    const callbacks = [...ui.timers.values()];
    if (exit === 'leave') ui.state.leaveCallChannel();
    else ui.unmount();
    assert.equal(ui.timers.size, 0);
    ui.state.isJoined.value = true;
    ui.state.remoteParticipants.value = [{ id: 'remote', stream: null }];
    const replacement = ui.state.ensurePeerConnection('remote');
    callbacks.forEach((callback) => callback());
    assert.equal(replacement.closes, 0);
    assert.deepEqual(ui.signals, ['call.joined', 'call.left']);
    assert.equal(ui.timers.size, 0);
  });
}

test('signaling continues retrying while the call remains joined', () => {
  const ui = setup();
  ui.disconnectTransport();
  ui.state.sendCallEvent('call.joined');
  assert.equal(ui.timers.size, 1);
  ui.runTimers();
  assert.deepEqual(ui.signals, ['call.joined', 'call.joined']);
  assert.equal(ui.timers.size, 1);
  ui.state.leaveCallChannel();
  assert.equal(ui.timers.size, 0);
});

test('call page script and template compile', () => {
  const { descriptor, errors } = parse(source, { filename });
  assert.deepEqual(errors, []);
  const script = compileScript(descriptor, { id: 'call-lifecycle-test' });
  const template = compileTemplate({
    source: descriptor.template!.content,
    filename,
    id: 'call-lifecycle-test',
    compilerOptions: { bindingMetadata: script.bindings },
  });
  assert.deepEqual(template.errors, []);
});
