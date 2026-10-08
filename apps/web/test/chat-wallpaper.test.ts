import assert from 'node:assert/strict';
import test from 'node:test';

type WallpaperSelection = {
  patternId: string;
  gradientId: string;
};

type WallpaperModule = {
  CHAT_WALLPAPERS?: ReadonlyArray<{ id: string }>;
  CHAT_WALLPAPER_GRADIENTS?: readonly string[];
  resolveChatWallpaperState?: (options: {
    primary: string;
    neutral: string;
    storedPatternId: string | null;
    initial: boolean;
  }) => WallpaperSelection;
  resolveStoredChatWallpaperPattern?: (value: string | null) => string | null;
  selectChatWallpaper?: (primary: string, neutral: string) => WallpaperSelection;
};

const loadWallpaperModule = async (): Promise<WallpaperModule> =>
  import('../app/utils/chat-wallpaper.ts').catch(() => ({}));

test('maps representative ThemePicker palettes to their designed wallpapers', async () => {
  const wallpaper = await loadWallpaperModule();

  assert.equal(typeof wallpaper.selectChatWallpaper, 'function');
  assert.deepEqual(wallpaper.selectChatWallpaper('violet', 'mauve'), {
    patternId: 'magic',
    gradientId: 'aurora',
  });
  assert.deepEqual(wallpaper.selectChatWallpaper('blue', 'slate'), {
    patternId: 'star-wars',
    gradientId: 'breeze',
  });
  assert.deepEqual(wallpaper.selectChatWallpaper('green', 'neutral'), {
    patternId: 'animals',
    gradientId: 'meadow',
  });
});

test('uses a distinct pattern for every standard ThemePicker palette', async () => {
  const wallpaper = await loadWallpaperModule();
  const palettes = [
    ['red', 'stone'],
    ['orange', 'stone'],
    ['amber', 'taupe'],
    ['yellow', 'olive'],
    ['lime', 'olive'],
    ['green', 'neutral'],
    ['emerald', 'mist'],
    ['teal', 'mist'],
    ['cyan', 'mist'],
    ['sky', 'slate'],
    ['blue', 'slate'],
    ['indigo', 'zinc'],
    ['violet', 'mauve'],
    ['purple', 'mauve'],
    ['fuchsia', 'mauve'],
    ['pink', 'taupe'],
    ['rose', 'gray'],
  ] as const;

  assert.equal(typeof wallpaper.selectChatWallpaper, 'function');

  const patternIds = palettes.map(
    ([primary, neutral]) => wallpaper.selectChatWallpaper!(primary, neutral).patternId,
  );

  assert.equal(new Set(patternIds).size, palettes.length);
});

test('returns a stable valid selection for a custom palette', async () => {
  const wallpaper = await loadWallpaperModule();

  assert.equal(typeof wallpaper.selectChatWallpaper, 'function');
  assert.ok(wallpaper.CHAT_WALLPAPERS);
  assert.ok(wallpaper.CHAT_WALLPAPER_GRADIENTS);

  const first = wallpaper.selectChatWallpaper('slate', 'rose');
  const second = wallpaper.selectChatWallpaper('slate', 'rose');
  const patternIds = wallpaper.CHAT_WALLPAPERS.map(({ id }) => id);

  assert.deepEqual(first, second);
  assert.ok(patternIds.includes(first.patternId));
  assert.ok(wallpaper.CHAT_WALLPAPER_GRADIENTS.includes(first.gradientId));
});

test('accepts only pattern ids present in the catalog', async () => {
  const wallpaper = await loadWallpaperModule();

  assert.equal(typeof wallpaper.resolveStoredChatWallpaperPattern, 'function');
  assert.equal(wallpaper.resolveStoredChatWallpaperPattern('cats-in-space'), 'cats-in-space');
  assert.equal(wallpaper.resolveStoredChatWallpaperPattern('removed-pattern'), null);
  assert.equal(wallpaper.resolveStoredChatWallpaperPattern(null), null);
});

test('restores a valid saved pattern during initial synchronization', async () => {
  const wallpaper = await loadWallpaperModule();

  assert.equal(typeof wallpaper.resolveChatWallpaperState, 'function');
  assert.deepEqual(
    wallpaper.resolveChatWallpaperState({
      primary: 'violet',
      neutral: 'mauve',
      storedPatternId: 'cats-in-space',
      initial: true,
    }),
    { patternId: 'cats-in-space', gradientId: 'aurora' },
  );
});

test('ignores an invalid saved pattern during initial synchronization', async () => {
  const wallpaper = await loadWallpaperModule();

  assert.equal(typeof wallpaper.resolveChatWallpaperState, 'function');
  assert.deepEqual(
    wallpaper.resolveChatWallpaperState({
      primary: 'violet',
      neutral: 'mauve',
      storedPatternId: 'removed-pattern',
      initial: true,
    }),
    { patternId: 'magic', gradientId: 'aurora' },
  );
});

test('uses automatic selection after the palette changes', async () => {
  const wallpaper = await loadWallpaperModule();

  assert.equal(typeof wallpaper.resolveChatWallpaperState, 'function');
  assert.deepEqual(
    wallpaper.resolveChatWallpaperState({
      primary: 'blue',
      neutral: 'slate',
      storedPatternId: 'cats-in-space',
      initial: false,
    }),
    { patternId: 'star-wars', gradientId: 'breeze' },
  );
});
