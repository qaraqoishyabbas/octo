<script setup lang="ts">
const users = useUsersStore();

onUnmounted(() => users.closeSearch());
</script>

<template>
  <div class="w-full flex-1 pb-4">
    <template v-if="users.searchQuery.length > 0">
      <UsersSearchListLoading v-if="users.searchLoading" />
      <UsersSearchListError v-else-if="users.searchError" @retry="users.fetchSearchData" />
      <UsersSearchListEmpty v-else-if="users.searchList.length === 0" />
      <UsersListItem
        v-if="!users.searchLoading && !users.searchError"
        v-for="user in users.searchList"
        :key="user.id"
        :user="user"
      />
    </template>
    <UsersList v-else />
  </div>
</template>
