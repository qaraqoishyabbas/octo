<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { MIN_MESSAGE_SEARCH_QUERY_LENGTH } from '~/stores/messages-search';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();
const dialog = useDialogStore();
const messages = useMessagesStore();
const search = useMessagesSearchStore();
const { query: searchQuery, loading: pending, hasPrev, hasNext, activeIndex } = storeToRefs(search);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const toggleSearch = () => emit('update:modelValue', !props.modelValue);
const clearDebounce = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
};
const resetSearch = () => {
  clearDebounce();
  search.$reset();
  messages.setSearchHighlightQuery('');
};
const syncSearchHighlight = (query: string) => {
  const normalizedQuery = query.trim();
  messages.setSearchHighlightQuery(
    props.modelValue && normalizedQuery.length >= MIN_MESSAGE_SEARCH_QUERY_LENGTH
      ? normalizedQuery
      : '',
  );
};
const scheduleSearch = () => {
  clearDebounce();
  search.invalidate();
  debounceTimer = setTimeout(() => {
    if (props.modelValue) void search.fetchData();
  }, 300);
};
const goPrev = () => {
  if (hasPrev.value) void search.selectIndex(activeIndex.value - 1);
};
const goNext = () => {
  if (hasNext.value) void search.selectIndex(activeIndex.value + 1);
};
watch(searchQuery, (query) => {
  syncSearchHighlight(query);
  if (props.modelValue) scheduleSearch();
});
watch(
  () => props.modelValue,
  (opened) => {
    if (!opened) {
      resetSearch();
      return;
    }
    syncSearchHighlight(searchQuery.value);
    if (searchQuery.value.trim().length >= MIN_MESSAGE_SEARCH_QUERY_LENGTH) void search.fetchData();
  },
);
watch(() => dialog.current?.dialog_id, resetSearch);
onBeforeUnmount(resetSearch);
</script>

<template>
  <div class="flex justify-between gap-1.5 px-4" v-if="modelValue">
    <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
      <UButton
        :disabled="!hasPrev || pending"
        icon="i-ph-caret-up-bold"
        size="xl"
        variant="soft"
        color="neutral"
        @click="goPrev"
      />
      <UButton
        :disabled="!hasNext || pending"
        icon="i-ph-caret-down-bold"
        size="xl"
        variant="soft"
        color="neutral"
        @click="goNext"
      />
    </div>

    <div class="bg-elevated flex w-full rounded-md p-0.5 shadow-lg">
      <UInput
        class="w-full"
        v-model="searchQuery"
        icon="i-ph-magnifying-glass-bold"
        color="neutral"
        variant="soft"
        autofocus
        size="xl"
        placeholder="Поиск"
        :loading="pending"
        @keydown.enter.prevent="goPrev"
      />
    </div>

    <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
      <UButton icon="i-ph-x-bold" size="xl" variant="soft" color="neutral" @click="toggleSearch" />
    </div>
  </div>
</template>
