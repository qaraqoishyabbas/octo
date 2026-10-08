import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalId } from '../app/utils/create-local-id.ts';

test('uses crypto.randomUUID when it is available', () => {
  const id = createLocalId({ randomUUID: () => 'generated-uuid' });

  assert.equal(id, 'generated-uuid');
});

test('creates an id when crypto.randomUUID is unavailable', () => {
  const id = createLocalId({});

  assert.equal(typeof id, 'string');
  assert.ok(id.length > 0);
});
