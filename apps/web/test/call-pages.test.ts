import { CALL_VIDEO_CLASS } from '../app/utils/call-media-layout.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compileScript, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import ts from 'typescript';

const load = (path: string) => readFileSync(new URL(`../app/${path}`, import.meta.url), 'utf8');
const compile = (source: string) =>
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

function page(path: string, route: object, controller: Record<string, unknown>) {
  const events: unknown[] = [];
  let meta: any;
  const globals = {
    definePageMeta: (value: object) => {
      meta = value;
    },
    useSeoMeta() {},
    useRoute: () => route,
    useAuthStore: () => ({ user: { username: 'owner' } }),
    computed: Vue.computed,
    useCallRoom: (target: Vue.MaybeRefOrGetter<string>, options?: object) => {
      events.push({ target: Vue.toValue(target), options });
      return controller;
    },
    navigateTo: (target: unknown, options?: unknown) => {
      events.push({ target, options });
    },
  };
  const { descriptor } = parse(load(path));
  const result = new Function(
    ...Object.keys(globals),
    `${compile(descriptor.scriptSetup!.content)}\nreturn typeof joinRoom === 'function' ? joinRoom : null;`,
  )(...Object.values(globals));
  return { events, meta, joinRoom: result };
}

test('lobby saves selected devices before navigating to the separate room', async () => {
  const controller = {
    canConnect: true,
    roomUsername: 'host',
    saveCallSettings() {
      ui.events.push('saved');
    },
  };
  const ui = page('pages/calls/lobby.vue', { query: { username: '@host' } }, controller);
  assert.deepEqual(ui.events, [{ target: 'host', options: undefined }]);
  await ui.joinRoom();
  assert.deepEqual(ui.events.slice(1), [
    'saved',
    { target: { path: '/calls/room/host', query: { join: '1' } }, options: undefined },
  ]);
  controller.canConnect = false;
  ui.events.length = 0;
  await ui.joinRoom();
  assert.deepEqual(ui.events, []);
});

test('invitation routes go to preparation, while a confirmed join enters the room', () => {
  const ui = page('pages/calls/room/[username].vue', { params: { username: 'host' } }, {});
  const initialize = ui.events[0] as { options: { autoJoin: boolean; onLeave: () => void } };
  assert.equal(initialize.options.autoJoin, true);
  ui.events.length = 0;
  const middleware = ui.meta.middleware[1];
  middleware({ query: {}, params: { username: 'host' } });
  assert.deepEqual(ui.events, [
    { target: { path: '/calls/lobby', query: { username: 'host' } }, options: { replace: true } },
  ]);
  ui.events.length = 0;
  middleware({ query: { join: '1' }, params: { username: 'host' } });
  assert.deepEqual(ui.events, []);
  initialize.options.onLeave();
  assert.deepEqual(ui.events, [
    { target: { path: '/calls/lobby', query: { username: 'host' } }, options: undefined },
  ]);
});

for (const name of ['CallsLobby', 'CallsRoom']) {
  test(`${name} renders reactive controller props and media elements`, async () => {
    const { descriptor } = parse(load(`components/feature/calls/${name}.vue`));
    const script = compileScript(descriptor, { id: name, inlineTemplate: true });
    const exports: any = {};
    new Function('exports', 'require', 'toRefs', compile(script.content))(
      exports,
      (path: string) => (path.includes('call-media-layout') ? { CALL_VIDEO_CLASS } : Vue),
      Vue.toRefs,
    );
    const actions = [
      'localVideoRefSetter',
      'createRemoteVideoRefSetter',
      'toggleCamera',
      'copyInviteLink',
      'returnToChat',
      'getParticipantVideoClass',
      'toggleParticipantOnMain',
      'showPreviousParticipantsPage',
      'showNextParticipantsPage',
      'toggleScreenShare',
      'leaveCall',
      'confirmLeaveCall',
      'retryCallMedia',
    ];
    const participant = {
      id: 'remote',
      name: 'Remote user',
      avatar: '',
      cameraEnabled: false,
      microphoneEnabled: true,
      screenSharing: false,
      isLocal: false,
      isSpeaking: false,
      connectionStatus: 'connected',
    };
    const call = Vue.reactive<any>({
      roomTitle: 'Test meeting',
      roomUsername: 'host',
      userFullName: 'Local user',
      userAvatar: '',
      inviteLink: '/calls/room/host',
      cameraEnabled: true,
      microphoneEnabled: true,
      screenSharing: false,
      hasVideo: false,
      audioLevel: 0,
      mediaState: 'ready',
      checkingLabel: '',
      errorMessage: '',
      canConnect: true,
      selectedCameraId: 'camera',
      selectedMicrophoneId: 'microphone',
      cameraOptions: [],
      microphoneOptions: [],
      mainParticipant: null,
      currentParticipantPage: [participant],
      remoteParticipants: [participant],
      participantsCount: 2,
      thumbnailGridClass: 'grid-cols-1',
      isSingleParticipantGrid: false,
      hasParticipantPages: false,
      participantPages: [[participant]],
      participantsCarouselPage: 0,
      participantsPanelOpen: false,
      leaveConfirmOpen: false,
      localConnectionStatus: 'connected',
      localIsSpeaking: false,
      getConnectionStatusClass: () => 'bg-emerald-500',
      getConnectionStatusLabel: () => 'Подключен',
      hasParticipantVideo: () => false,
      ...Object.fromEntries(actions.map((action) => [action, () => {}])),
    });
    const app = Vue.createSSRApp(exports.default, { call });
    for (const component of [
      'AppBar',
      'UButton',
      'UAvatar',
      'UIcon',
      'UAlert',
      'USwitch',
      'USelect',
      'UBadge',
      'Item',
      'USlideover',
      'UModal',
    ]) {
      app.component(
        component,
        Vue.defineComponent({
          setup:
            (_, { slots }) =>
            () =>
              Vue.h(
                'div',
                Object.entries(slots).map(([, slot]) => slot?.()),
              ),
        }),
      );
    }
    app.config.globalProperties.$storage = (path: string) => path;
    const html = await renderToString(app);
    assert.ok(html.includes('Test meeting'));
    assert.ok(html.includes('<video'));
    if (name === 'CallsRoom') {
      assert.ok(html.includes('Remote user'));
      assert.doesNotMatch(html.match(/<video[^>]*>/)?.[0] ?? '', /\bmuted\b/);
    }
  });
}
