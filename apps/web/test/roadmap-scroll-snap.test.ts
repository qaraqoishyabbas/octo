import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const loadRoadmapSource = () =>
  readFile(new URL('../app/components/feature/roadmap/Roadmap.vue', import.meta.url), 'utf8');

test('centers every roadmap status with mandatory horizontal scroll snapping', async () => {
  const source = await loadRoadmapSource();

  assert.match(source, /class="[^"]*snap-x[^"]*snap-mandatory[^"]*"/);
  assert.match(source, /<section[\s\S]*?class="[^"]*snap-center[^"]*snap-always[^"]*"/);
});
