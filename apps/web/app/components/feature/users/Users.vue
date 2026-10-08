<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import { UsersSearch } from '#components';

const users = useUsersStore();
const overlay = useOverlay();
const openSearch = () => overlay.create(UsersSearch).open();

const sortItems = computed(
  () =>
    [
      {
        label: 'по имени',
        type: 'checkbox' as const,
        checked: users.sortBy === 'name',
        onUpdateChecked() {
          void users.setSortBy('name');
        },
      },
      {
        label: 'по времени захода',
        type: 'checkbox' as const,
        checked: users.sortBy === 'lastSeen',
        onUpdateChecked() {
          void users.setSortBy('lastSeen');
        },
      },
    ] satisfies DropdownMenuItem[],
);

onMounted(() => {
  if (users.list.length == 0) {
    users.fetchData();
  }
});
</script>

<template>
  <AppBar>
    <template v-slot:left>
      <UDropdownMenu :items="sortItems" size="xl" :ui="{ content: 'w-64' }">
        <UButton color="neutral" label="Сортировка" size="xl" variant="soft" />
      </UDropdownMenu>
    </template>
    <template v-slot:center> Контакты </template>
  </AppBar>
  <div class="px-4 pb-3">
    <UButton
      size="xl"
      variant="soft"
      color="neutral"
      icon="i-ph-magnifying-glass-bold"
      label="Поиск"
      block
      @click="openSearch"
    />
  </div>
  <UsersListLoading v-if="users.pageInLoading" />
  <UsersListError v-else-if="users.error" />
  <div class="w-full flex-1 space-y-3" v-else-if="users.list.length > 0">
    <UsersList />
  </div>
  <UsersListEmpty v-else />
</template>
