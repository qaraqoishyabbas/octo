import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = async (path: string) =>
  readFile(new URL(path, import.meta.url), 'utf8').catch(() => '');

test('scroll composable owns viewport decisions interruption and cleanup', async () => {
  const source = await readSource('../app/composables/useMessageListScroll.ts');

  assert.match(source, /from ['"]\.\.\/utils\/dialog-scroll\.ts['"]/);
  assert.match(source, /export function useMessageListScroll/);
  assert.match(source, /addEventListener\(['"]wheel['"]/);
  assert.match(source, /addEventListener\(['"]touchstart['"]/);
  assert.match(source, /addEventListener\(['"]pointerdown['"]/);
  assert.match(source, /removeEventListener\(['"]wheel['"]/);
  assert.match(source, /removeEventListener\(['"]touchstart['"]/);
  assert.match(source, /removeEventListener\(['"]pointerdown['"]/);
  assert.match(source, /onScopeDispose/);
  assert.match(source, /cancelAnimationFrame/);
  assert.match(source, /clearTimeout/);
  assert.match(source, /resizeFrame !== null/);
  assert.match(source, /resizeFrame = window\.requestAnimationFrame/);
});

test('history composable owns directional loading and rendered reconciliation', async () => {
  const source = await readSource('../app/composables/useMessageListHistory.ts');

  assert.match(source, /from ['"]\.\.\/utils\/dialog-scroll\.ts['"]/);
  assert.match(source, /export function useMessageListHistory/);
  assert.match(source, /const loadOlder/);
  assert.match(source, /const loadNewer/);
  assert.match(source, /const retryOlder/);
  assert.match(source, /const retryNewer/);
  assert.match(source, /const reconcileCurrentWindow/);
  assert.match(source, /captureSnapshot\(\)/);
  assert.match(source, /await nextTick\(\)/);
  assert.match(source, /reconcileAfterRender/);
  assert.match(source, /consumeScrollIntent/);
});

test('message list composition delegates browser lifecycle to composables', async () => {
  const source = await readSource('../app/components/feature/dialog/DialogMessagesList.vue');

  assert.doesNotMatch(source, /new IntersectionObserver/);
  assert.doesNotMatch(source, /new ResizeObserver/);
  assert.doesNotMatch(source, /\.addEventListener\(/);
  assert.doesNotMatch(source, /setTimeout\(/);
});

test('message list composition uses controllers and independent edge state', async () => {
  const source = await readSource('../app/components/feature/dialog/DialogMessagesList.vue');

  assert.match(source, /useMessageListScroll\(/);
  assert.match(source, /useMessageListHistory\(/);
  assert.match(source, /useMessageListObservers\(/);
  assert.match(source, /messages\.olderLoading/);
  assert.match(source, /messages\.olderError/);
  assert.match(source, /history\.retryOlder/);
  assert.match(source, /messages\.newerLoading/);
  assert.match(source, /messages\.newerError/);
  assert.match(source, /history\.retryNewer/);
  assert.match(source, /observers\.reconnect\(\)/);
});

test('observer composable debounces both history edges independently', async () => {
  const source = await readSource('../app/composables/useMessageListObservers.ts');

  assert.match(source, /olderHistoryDebounceTimer/);
  assert.match(source, /newerHistoryDebounceTimer/);
});

test('message list has one implementation without version switches', async () => {
  const appRoot = new URL('../app/', import.meta.url);
  const files = (await readdir(appRoot, { recursive: true })).filter(
    (path) => path.endsWith('.ts') || path.endsWith('.vue'),
  );
  const source = (
    await Promise.all(files.map((path) => readFile(new URL(path, appRoot), 'utf8')))
  ).join('\n');

  assert.doesNotMatch(source, /MessageListV[12]|messageListV2|messageList=v2/);
});

test('initial loading and scrolling use only the new store contracts', async () => {
  const dialogMessages = await readSource('../app/components/feature/dialog/DialogMessages.vue');
  const store = await readSource('../app/stores/messages.ts');

  assert.match(dialogMessages, /messages\.loadInitial\(\)/);
  assert.match(dialogMessages, /@retry="messages\.retryInitial"/);
  assert.doesNotMatch(store, /const fetchData =/);
  assert.doesNotMatch(store, /targetMessage(Id|Highlight|Block|Behavior)/);
});
