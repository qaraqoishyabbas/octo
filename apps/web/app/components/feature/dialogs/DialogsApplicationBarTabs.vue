<script lang="ts" setup>
import type { DialogFilter } from '~/stores/dialogs';

const dialogs = useDialogsStore();

const quickFilters = computed(() => dialogs.filterOptions);
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
