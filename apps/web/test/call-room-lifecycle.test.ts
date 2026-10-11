import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { computed, markRaw, nextTick, reactive, ref, toRefs, toValue } from 'vue';

const filename = new URL('../app/composables/useCallRoom.ts', import.meta.url).pathname;
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

function setup(options: Record<string, unknown> = {}, exposeInternals = true) {
  const captures: Array<ReturnType<typeof deferred<ReturnType<typeof capture>['stream']>>> = [];
  const timers = new Map<number, () => void>();
  const signals: string[] = [];
  const subscriptions: string[] = [];
  const intervalTimers = new Set<number>();
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
      on: () => () => {},
      subscribePrivate: (channel: string) => subscriptions.push(channel),
      start() {},
      triggerPrivate: (_channel: string, event: string) => {
        signals.push(event);
        return canSend;
      },
    }),
    useToast: () => ({ add() {} }),
    computed,
    reactive,
    toValue,
    ref,
    nextTick,
    watch: (
      getter: unknown,
      callback: (value: unknown) => void,
      settings?: { immediate?: boolean },
    ) => {
      if (settings?.immediate && typeof getter === 'function') callback(getter());
      return () => {};
    },
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
        getUserMedia: async () => ({
          getTracks: () => [],
          getVideoTracks: () => [],
          getAudioTracks: () => [],
        }),
        enumerateDevices: async () => [],
        removeEventListener() {},
      },
    },
    window: {
      setTimeout: (callback: () => void) => {
        timers.set(++timerId, callback);
        return timerId;
      },
      setInterval: () => {
        intervalTimers.add(++timerId);
        return timerId;
      },
      removeEventListener() {},
    },
    clearTimeout: (id: number) => timers.delete(id),
    clearInterval: (id: number) => intervalTimers.delete(id),
    MediaStream: function () {
      return { getAudioTracks: () => [] };
    },
    RTCPeerConnection: Peer,
  };
  const testSource = exposeInternals
    ? source.replace(
        'return reactive({',
        `return {
    startScreenShare, stopScreenShare, screenStream, screenSharing, isJoined,
    ensurePeerConnection, closePeerConnection, schedulePeerReconnect, peerConnections,
    remoteParticipants, leaveCallChannel, sendCallEvent, retryCallMedia, confirmLeaveCall,
    canConnect, cameraEnabled, microphoneEnabled, mediaState, roomUsername
  };
  return reactive({`,
      )
    : source;
  const code = ts.transpileModule(testSource.replaceAll('import.meta.client', 'true'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function(...Object.keys(globals), code)(...Object.values(globals));
  const state = (
    globals.exports as { useCallRoom: (target: string, options: Record<string, unknown>) => any }
  ).useCallRoom('room', options);
  if (exposeInternals) {
    state.isJoined.value = true;
    state.remoteParticipants.value = [{ id: 'remote', stream: null }];
  }
  return {
    state,
    captures,
    timers,
    signals,
    subscriptions,
    intervalTimers,
    provideMediaStream: (stream: any) => {
      globals.navigator.mediaDevices.getUserMedia = async () => stream;
    },
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

test('arrival from lobby automatically joins the room after media preparation', async () => {
  const ui = setup({ autoJoin: true });
  ui.state.isJoined.value = false;
  ui.state.cameraEnabled.value = false;
  ui.state.microphoneEnabled.value = false;
  await ui.state.retryCallMedia();
  assert.equal(ui.state.mediaState.value, 'ready');
  assert.equal(ui.state.isJoined.value, true);
  assert.deepEqual(ui.subscriptions, ['call.room']);
  assert.deepEqual(ui.signals, ['call.joined', 'call.ping']);
  ui.unmount();
  assert.equal(ui.intervalTimers.size, 0);
});

test('lobby device preparation does not subscribe or announce entry', async () => {
  const ui = setup();
  ui.state.isJoined.value = false;
  ui.state.cameraEnabled.value = false;
  ui.state.microphoneEnabled.value = false;
  await ui.state.retryCallMedia();
  assert.equal(ui.state.canConnect.value, true);
  assert.equal(ui.state.isJoined.value, false);
  assert.deepEqual(ui.subscriptions, []);
  assert.deepEqual(ui.signals, []);
});

test('confirming exit leaves signaling before returning to preparation', () => {
  let leaves = 0;
  const ui = setup({
    onLeave: () => {
      leaves++;
    },
  });
  ui.state.confirmLeaveCall();
  assert.equal(ui.state.isJoined.value, false);
  assert.deepEqual(ui.signals, ['call.left']);
  assert.equal(leaves, 1);
});

test('components receive writable reactive state while media stays owned by composable', () => {
  const ui = setup({}, false);
  const state = toRefs(ui.state);
  assert.equal(state.cameraEnabled.value, true);
  state.cameraEnabled.value = false;
  assert.equal(ui.state.cameraEnabled, false);
  state.selectedMicrophoneId.value = 'microphone-2';
  assert.equal(ui.state.selectedMicrophoneId, 'microphone-2');
  assert.equal(typeof ui.state.localVideoRefSetter, 'function');
  assert.equal(typeof ui.state.toggleScreenShare, 'function');
});

test('retry in an existing call replaces outgoing tracks and announces the new media state', async () => {
  const ui = setup({ autoJoin: true });
  const replacement = { kind: 'video', enabled: true, stop() {} };
  const stream = markRaw({
    getTracks: () => [replacement],
    getVideoTracks: () => [replacement],
    getAudioTracks: () => [],
    removeTrack() {},
  });
  ui.provideMediaStream(stream);
  ui.state.microphoneEnabled.value = false;
  const peer = ui.state.ensurePeerConnection('remote');
  const replaced: unknown[] = [];
  peer.getTransceivers = () => [
    {
      sender: {
        track: { kind: 'video' },
        replaceTrack: async (track: unknown) => {
          replaced.push(track);
        },
      },
      receiver: { track: { kind: 'video' } },
    },
  ];
  await ui.state.retryCallMedia();
  assert.deepEqual(replaced, [replacement]);
  assert.deepEqual(ui.signals, ['call.media-state']);
  assert.equal(ui.state.isJoined.value, true);
  ui.unmount();
});
