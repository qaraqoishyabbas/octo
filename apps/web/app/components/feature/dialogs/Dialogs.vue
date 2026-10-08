<script lang="ts" setup>
const listRef = ref<{ scrollToTop: () => void } | null>(null);
const dialogs = useDialogsStore();

const RESUME_REFRESH_DELAY = 30_000;
const lastRefreshAt = ref(0);
const isResumeRefreshing = ref(false);

const refreshDialogs = async () => {
  if (isResumeRefreshing.value) {
    return;
  }

  isResumeRefreshing.value = true;

  try {
    await dialogs.fetchData();
    lastRefreshAt.value = Date.now();
  } finally {
    isResumeRefreshing.value = false;
  }
};

const refreshDialogsOnResume = async () => {
  if (
    document.visibilityState !== 'visible' ||
    Date.now() - lastRefreshAt.value < RESUME_REFRESH_DELAY
  ) {
    return;
  }

  await refreshDialogs();
};

onMounted(async () => {
  await refreshDialogs();

  document.addEventListener('visibilitychange', refreshDialogsOnResume);
  window.addEventListener('focus', refreshDialogsOnResume);
  window.addEventListener('pageshow', refreshDialogsOnResume);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', refreshDialogsOnResume);
  window.removeEventListener('focus', refreshDialogsOnResume);
  window.removeEventListener('pageshow', refreshDialogsOnResume);
});
</script>
<template>
  <DialogsApplicationBar @title-click="listRef?.scrollToTop()" />
  <DialogsListLoading v-if="dialogs.loading && dialogs.list.length === 0" />
  <DialogsListError v-else-if="dialogs.error" />
  <DialogsListEmpty v-else-if="dialogs.filteredList.length === 0" />
  <DialogsList v-else ref="listRef" />
</template>
