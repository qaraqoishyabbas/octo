import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeUsersById } from '../app/utils/merge-users-by-id.ts';

test('replaces existing users by id and appends new users', () => {
  const current = [
    { id: '1', name: 'Old name' },
    { id: '2', name: 'Second user' },
  ];
  const incoming = [
    { id: '1', name: 'New name' },
    { id: '3', name: 'Third user' },
  ];

  assert.deepEqual(mergeUsersById(current, incoming), [
    { id: '1', name: 'New name' },
    { id: '2', name: 'Second user' },
    { id: '3', name: 'Third user' },
  ]);
});
