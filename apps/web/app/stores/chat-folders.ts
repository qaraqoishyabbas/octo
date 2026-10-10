import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import type { DialogFilter } from './dialogs';

export const useChatFoldersStore = defineStore('chat-folders', () => {
  const auth = useAuthStore();
  const dialogs = useDialogsStore();
  const selectedFolders = useLocalStorage<DialogFilter[]>(
    computed(() => `nuxt-chat-folders:${auth.user.id ?? 'guest'}`),
    [],
    { writeDefaults: false },
  );
  const folderOptions = computed(() =>
    dialogs.filterOptions.filter((item) => item.value !== 'all'),
  );
  const visibleFilters = computed(() =>
    dialogs.filterOptions.filter(
      (item) =>
        item.value === 'all' ||
        (Array.isArray(selectedFolders.value) && selectedFolders.value.includes(item.value)),
    ),
  );
  const hasFolders = computed(() => visibleFilters.value.length > 1);

  const setFolder = (folder: DialogFilter, enabled: boolean) => {
    if (!folderOptions.value.some((item) => item.value === folder)) return;
    const current = Array.isArray(selectedFolders.value) ? selectedFolders.value : [];
    selectedFolders.value = enabled
      ? [...new Set([...current, folder])]
      : current.filter((item) => item !== folder);
  };

  watch(
    visibleFilters,
    (filters) => {
      if (!filters.some((item) => item.value === dialogs.activeFilter)) dialogs.setFilter('all');
    },
    { immediate: true },
  );

  return { selectedFolders, folderOptions, visibleFilters, hasFolders, setFolder };
});
