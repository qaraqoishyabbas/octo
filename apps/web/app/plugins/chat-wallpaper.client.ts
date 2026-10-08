import {
  CHAT_WALLPAPERS,
  CHAT_WALLPAPER_STORAGE_KEY,
  resolveChatWallpaperState,
} from '~/utils/chat-wallpaper';

const wallpaperAssets = import.meta.glob<string>('../assets/bg/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
});

export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig();
  let initial = true;

  watch(
    [() => appConfig.ui.colors.primary, () => appConfig.ui.colors.neutral],
    ([primary, neutral]) => {
      const selection = resolveChatWallpaperState({
        primary,
        neutral,
        storedPatternId: localStorage.getItem(CHAT_WALLPAPER_STORAGE_KEY),
        initial,
      });
      const pattern = CHAT_WALLPAPERS.find(({ id }) => id === selection.patternId);
      const assetUrl = pattern ? wallpaperAssets[`../assets/bg/${pattern.filename}`] : undefined;
      const root = document.documentElement;

      initial = false;
      root.dataset.chatWallpaperGradient = selection.gradientId;

      if (!assetUrl) {
        root.style.removeProperty('--chat-wallpaper-image');
        return;
      }

      root.style.setProperty('--chat-wallpaper-image', `url(${JSON.stringify(assetUrl)})`);
      localStorage.setItem(CHAT_WALLPAPER_STORAGE_KEY, selection.patternId);
    },
    { immediate: true },
  );
});
