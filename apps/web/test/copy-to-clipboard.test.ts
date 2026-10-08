import assert from 'node:assert/strict';
import test from 'node:test';
import { copyToClipboard } from '../app/utils/copy-to-clipboard.ts';

test('uses the Clipboard API when it is available', async () => {
  let copiedText = '';
  let fallbackCalled = false;

  await copyToClipboard('modern', {
    writeText: async (text) => {
      copiedText = text;
    },
    legacyCopy: () => {
      fallbackCalled = true;
      return true;
    },
  });

  assert.equal(copiedText, 'modern');
  assert.equal(fallbackCalled, false);
});

test('uses the legacy fallback when the Clipboard API is unavailable', async () => {
  let copiedText = '';

  await copyToClipboard('fallback', {
    legacyCopy: (text) => {
      copiedText = text;
      return true;
    },
  });

  assert.equal(copiedText, 'fallback');
});

test('uses the legacy fallback when the Clipboard API rejects the write', async () => {
  let copiedText = '';

  await copyToClipboard('rejected', {
    writeText: async () => {
      throw new Error('Clipboard permission denied');
    },
    legacyCopy: (text) => {
      copiedText = text;
      return true;
    },
  });

  assert.equal(copiedText, 'rejected');
});
