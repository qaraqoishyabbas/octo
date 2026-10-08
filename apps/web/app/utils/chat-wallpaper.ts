export const CHAT_WALLPAPERS = [
  { id: 'animals', label: 'Animals', filename: 'animals.svg' },
  { id: 'cats-in-space', label: 'Cats in Space', filename: 'cats-in-space.svg' },
  { id: 'christmas', label: 'Christmas', filename: 'christmas.svg' },
  { id: 'love', label: 'Love', filename: 'love.svg' },
  { id: 'magic', label: 'Magic', filename: 'magic.svg' },
  { id: 'math', label: 'Math', filename: 'math.svg' },
  { id: 'new-year', label: 'New Year', filename: 'new-year.svg' },
  { id: 'night-life', label: 'Night Life', filename: 'night-life.svg' },
  { id: 'paris', label: 'Paris', filename: 'paris.svg' },
  { id: 'pony', label: 'Pony', filename: 'pony.svg' },
  { id: 'rich', label: 'Rich', filename: 'rich.svg' },
  { id: 'sea-life', label: 'Sea Life', filename: 'sea-life.svg' },
  { id: 'snowflakes', label: 'Snowflakes', filename: 'snowflakes.svg' },
  { id: 'star-wars', label: 'Star Wars', filename: 'star-wars.svg' },
  { id: 'sweets', label: 'Sweets', filename: 'sweets.svg' },
  { id: 'toys', label: 'Toys', filename: 'toys.svg' },
  { id: 'video-games', label: 'Video Games', filename: 'video-games.svg' },
  { id: 'wedding', label: 'Wedding', filename: 'wedding.svg' },
  { id: 'witch-magic', label: 'Witch Magic', filename: 'witch-magic.svg' },
  { id: 'zoo', label: 'Zoo', filename: 'zoo.svg' },
] as const;

export const CHAT_WALLPAPER_GRADIENTS = [
  'aurora',
  'bloom',
  'breeze',
  'lagoon',
  'meadow',
  'sunrise',
] as const;

export type ChatWallpaperPatternId = (typeof CHAT_WALLPAPERS)[number]['id'];
export type ChatWallpaperGradientId = (typeof CHAT_WALLPAPER_GRADIENTS)[number];

export type ChatWallpaperSelection = {
  patternId: ChatWallpaperPatternId;
  gradientId: ChatWallpaperGradientId;
};

export const CHAT_WALLPAPER_STORAGE_KEY = 'nuxt-ui-wallpaper-pattern';

const standardPaletteSelections: Readonly<Record<string, ChatWallpaperSelection>> = {
  'red:stone': { patternId: 'love', gradientId: 'bloom' },
  'orange:stone': { patternId: 'toys', gradientId: 'sunrise' },
  'amber:taupe': { patternId: 'sweets', gradientId: 'sunrise' },
  'yellow:olive': { patternId: 'pony', gradientId: 'sunrise' },
  'lime:olive': { patternId: 'zoo', gradientId: 'meadow' },
  'green:neutral': { patternId: 'animals', gradientId: 'meadow' },
  'emerald:mist': { patternId: 'sea-life', gradientId: 'lagoon' },
  'teal:mist': { patternId: 'cats-in-space', gradientId: 'lagoon' },
  'cyan:mist': { patternId: 'math', gradientId: 'lagoon' },
  'sky:slate': { patternId: 'paris', gradientId: 'breeze' },
  'blue:slate': { patternId: 'star-wars', gradientId: 'breeze' },
  'indigo:zinc': { patternId: 'video-games', gradientId: 'aurora' },
  'violet:mauve': { patternId: 'magic', gradientId: 'aurora' },
  'purple:mauve': { patternId: 'witch-magic', gradientId: 'aurora' },
  'fuchsia:mauve': { patternId: 'night-life', gradientId: 'bloom' },
  'pink:taupe': { patternId: 'wedding', gradientId: 'bloom' },
  'rose:gray': { patternId: 'rich', gradientId: 'bloom' },
};

const patternIds = new Set<string>(CHAT_WALLPAPERS.map(({ id }) => id));

const hashPalette = (primary: string, neutral: string) => {
  let hash = 2166136261;

  for (const character of `${primary}:${neutral}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const selectChatWallpaper = (primary: string, neutral: string): ChatWallpaperSelection => {
  const standardSelection = standardPaletteSelections[`${primary}:${neutral}`];

  if (standardSelection) {
    return standardSelection;
  }

  const hash = hashPalette(primary, neutral);

  return {
    patternId: CHAT_WALLPAPERS[hash % CHAT_WALLPAPERS.length].id,
    gradientId:
      CHAT_WALLPAPER_GRADIENTS[
        Math.floor(hash / CHAT_WALLPAPERS.length) % CHAT_WALLPAPER_GRADIENTS.length
      ],
  };
};

export const resolveStoredChatWallpaperPattern = (
  value: string | null,
): ChatWallpaperPatternId | null =>
  value && patternIds.has(value) ? (value as ChatWallpaperPatternId) : null;

export const resolveChatWallpaperState = ({
  primary,
  neutral,
  storedPatternId,
  initial,
}: {
  primary: string;
  neutral: string;
  storedPatternId: string | null;
  initial: boolean;
}): ChatWallpaperSelection => {
  const automaticSelection = selectChatWallpaper(primary, neutral);
  const storedPattern = initial ? resolveStoredChatWallpaperPattern(storedPatternId) : null;

  return storedPattern ? { ...automaticSelection, patternId: storedPattern } : automaticSelection;
};
