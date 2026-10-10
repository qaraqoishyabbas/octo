<script lang="ts" setup>
import type { DialogFilter } from '~/stores/dialogs';

const dialogs = useDialogsStore();
const folders = useChatFoldersStore();

const quickFilters = computed(() => folders.visibleFilters);
const activeFilter = computed({
  get: () => dialogs.activeFilter,
  set: (value) => dialogs.setFilter(value as DialogFilter),
});
</script>
<template>
  <UTabs
    class="w-full"
    v-model="activeFilter"
    :content="false"
    :items="quickFilters"
    color="primary"
    size="lg"
    variant="pill"
  />
</template>
