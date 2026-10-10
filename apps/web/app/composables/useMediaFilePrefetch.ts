import type { ObjectDirective } from 'vue';
import type { MessageAttachment } from '~/types';

/** Warm local media cache for visible document rows; never initiates a browser save. */
export function useMediaFilePrefetch(): ObjectDirective<HTMLElement, MessageAttachment> {
  const settings = useMediaAutoDownloadStore();
  const rows = new Map<HTMLElement, { file: MessageAttachment; visible: boolean }>();
  let observer: IntersectionObserver | null = null;
  const load = (row: { file: MessageAttachment; visible: boolean }) => {
    if (row.visible && row.file.path && settings.canAutoLoad(row.file)) {
      void settings.prefetch(row.file, $storage(row.file.path));
    }
  };
  watch(
    () => [settings.profiles, settings.activeProfile, settings.dataSaver, settings.isOnline],
    () => {
      for (const row of rows.values()) load(row);
    },
    { deep: true },
  );
  onScopeDispose(() => {
    observer?.disconnect();
    rows.clear();
  });
  return {
    mounted(element, binding) {
      if (typeof IntersectionObserver === 'undefined') return;
      if (!observer)
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            const row = rows.get(entry.target as HTMLElement);
            if (row) {
              row.visible = entry.isIntersecting;
              load(row);
            }
          }
        });
      rows.set(element, { file: binding.value, visible: false });
      observer.observe(element);
    },
    updated(element, binding) {
      const row = rows.get(element);
      if (row && row.file !== binding.value) {
        row.file = binding.value;
        load(row);
      }
    },
    unmounted(element) {
      observer?.unobserve(element);
      rows.delete(element);
    },
  };
}
