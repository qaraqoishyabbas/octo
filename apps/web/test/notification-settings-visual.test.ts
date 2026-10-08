import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compile } from '@vue/compiler-dom';
import { parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';

const source = readFileSync(
  new URL('../app/components/feature/setting/SettingNotifications.vue', import.meta.url),
  'utf8',
);
const template = parse(source).descriptor.template!.content;
const render = new Function(
  'Vue',
  compile(template, { mode: 'function', prefixIdentifiers: true }).code,
)(Vue);

const passthrough = Vue.defineComponent({
  setup(_, { slots }) {
    return () => Vue.h('div', slots.default?.());
  },
});

async function screen(state: Record<string, unknown>) {
  const app = Vue.createSSRApp({
    data: () => ({
      loaded: true,
      appId: 'web',
      supported: true,
      subscribed: false,
      busy: false,
      error: '',
      preferences: {
        enabled: true,
        sound: true,
        badge: true,
        show_text: true,
        show_names: true,
        mentions_in_muted: true,
      },
      inAppSettings: [],
      enableBrowserPush: () => {},
      disableBrowserPush: () => {},
      toggle: () => {},
      save: () => {},
      reset: () => {},
      emit: () => {},
      ...state,
    }),
    render,
  });
  app.component(
    'USlideover',
    Vue.defineComponent({
      setup(_, { slots }) {
        return () => Vue.h('div', slots.content?.());
      },
    }),
  );
  app.component('AppBar', passthrough);
  app.component(
    'UButton',
    Vue.defineComponent({
      inheritAttrs: false,
      setup(_, { attrs }) {
        return () => Vue.h('button', String(attrs.label || ''));
      },
    }),
  );
  app.component('UBadge', passthrough);
  app.component('UIcon', passthrough);
  app.component('USwitch', passthrough);
  return renderToString(app);
}

test('notification settings show exactly one state for an unsubscribed browser', async () => {
  const html = await screen({ subscribed: false });
  assert.match(html, /Будьте в курсе новых сообщений/);
  assert.match(html, /Включить уведомления/);
  assert.doesNotMatch(html, /Сбросить настройки уведомлений/);
  assert.doesNotMatch(html, /Сервис уведомлений недоступен/);
});

test('notification settings show controls only for a subscribed browser', async () => {
  const html = await screen({ subscribed: true });
  assert.match(html, /Сбросить настройки уведомлений/);
  assert.doesNotMatch(html, /Включить уведомления/);
});

test('notification settings show unavailable state instead of an unusable enable button', async () => {
  const html = await screen({ appId: '' });
  assert.match(html, /Сервис уведомлений недоступен/);
  assert.doesNotMatch(html, /Включить уведомления/);
});

test('notification settings show unsupported browser state instead of controls', async () => {
  const html = await screen({ supported: false, subscribed: true });
  assert.match(html, /Для уведомлений нужен поддерживаемый браузер/);
  assert.doesNotMatch(html, /Сбросить настройки уведомлений/);
});

test('notification settings show loading state without an enable button', async () => {
  const html = await screen({ loaded: false });
  assert.match(html, /Проверяем уведомления/);
  assert.doesNotMatch(html, /Включить уведомления/);
});

test('notification settings display subscription errors', async () => {
  const html = await screen({ error: 'Разрешение на уведомления не получено.' });
  assert.match(html, /Разрешение на уведомления не получено/);
});
