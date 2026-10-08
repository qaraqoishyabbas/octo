import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../app/components/feature/setting/SettingNotifications.vue', import.meta.url),
  'utf8',
);

test('every notification setting row toggles its saved value', () => {
  for (const [label, field] of [
    ['Звук', 'sound'],
    ['Счётчик на значке', 'badge'],
    ['Показывать текст', 'show_text'],
    ['Упоминания в заглушённых чатах', 'mentions_in_muted'],
  ]) {
    assert.ok(source.includes(`{ label: '${label}', field: '${field}' }`), label);
  }
  assert.match(source, /:model-value="preferences\[setting\.field\]"/);
  assert.match(source, /@click="toggle\(setting\.field\)"/);
  assert.match(source, /@update:model-value="save\(setting\.field, \$event\)"/);
  for (const field of ['enabled', 'show_names']) {
    assert.match(source, new RegExp(`:model-value="preferences\\.${field}"`));
    assert.match(source, new RegExp(`@click="toggle\\('${field}'\\)"`));
    assert.match(source, new RegExp(`@update:model-value="save\\('${field}', \\$event\\)"`));
  }
});

test('reset button saves default settings', () => {
  const row = source.match(/<UButton[^>]*label="Сбросить настройки уведомлений"[^>]*\/>/)?.[0];
  assert.ok(row);
  assert.match(row, /@click="reset/);
});

test('switch controls are not nested inside buttons', () => {
  for (const button of source.matchAll(/<UButton\b[\s\S]*?<\/UButton>/g)) {
    assert.doesNotMatch(button[0], /<USwitch\b/);
  }
});

test('settings stay hidden until browser push is enabled', () => {
  assert.match(source, /v-else-if="!subscribed"/);
  assert.match(source, /Включить уведомления/);
  assert.match(source, /v-else/);
});

test('notification preferences are stored locally without preference API requests', () => {
  const store = readFileSync(new URL('../app/stores/notification.ts', import.meta.url), 'utf8');
  assert.match(store, /useLocalStorage/);
  assert.doesNotMatch(store, /\$http[^\n]*notification-preferences/);
});
