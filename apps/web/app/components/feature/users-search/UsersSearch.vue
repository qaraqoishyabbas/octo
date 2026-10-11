<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
useSeoMeta({ title: 'Контакты' });

const emit = defineEmits<{ close: [boolean] }>();

const users = useUsersStore();
let disposed = false;

const debouncedFn = useDebounceFn(async () => {
  if (!disposed) await users.fetchSearchData();
}, 500);

const onInput = async () => {
  users.invalidateSearch();
  await debouncedFn();
};
onMounted(() => {
  users.fetchData();
});
onBeforeUnmount(() => {
  disposed = true;
  void users.closeSearch();
});
</script>

<template>
  <USlideover side="left">
    <template v-slot:content>
      <AppBar>
        <template v-slot:left>
          <UButton
            color="neutral"
            icon="i-ph-caret-left-bold"
            size="xl"
            variant="soft"
            @click="emit('close', false)"
          />
        </template>
        <template v-slot:input>
          <UInput
            class="w-full"
            v-model="users.searchQuery"
            :highlight="false"
            icon="i-ph-magnifying-glass-bold"
            placeholder="Поиск"
            size="xl"
            autofocus
            variant="none"
            @input="onInput"
          />
        </template>
      </AppBar>
      <UsersSearchList />
    </template>
  </USlideover>
</template>
