<script setup lang="ts">
import type { User } from '~/types';

const users = useUsersStore();
const props = withDefaults(defineProps<{ disabledUserIds?: string[] }>(), {
  disabledUserIds: () => [],
});
const selectedUsers = defineModel<User[]>({ default: () => [] });
const disabledUserIdSet = computed(() => new Set(props.disabledUserIds.map((id) => String(id))));

onBeforeUnmount(() => {
  void users.closeSearch();
});

const onUserSelect = (user: User, clearSearch = false) => {
  if (disabledUserIdSet.value.has(String(user.id))) {
    return;
  }

  const found = selectedUsers.value.find((item) => item.id === user.id);

  if (!found) {
    selectedUsers.value.push(user);
    if (users.searchQuery || clearSearch) {
      users.closeSearch();
    }
    return;
  }

  selectedUsers.value = selectedUsers.value.filter((item) => item.id !== found.id);
};

onMounted(() => {
  users.searchMode = true;
  if (users.list.length == 0) {
    users.fetchData();
  }
});

watch(disabledUserIdSet, (ids) => {
  selectedUsers.value = selectedUsers.value.filter((user) => !ids.has(String(user.id)));
});
</script>

<template>
  <GroupUserListLoading v-if="users.pageInLoading" />
  <GroupUserListError v-else-if="users.error" />
  <template v-else-if="users.list.length > 0">
    <GroupUserListSearch
      v-if="users.searchQuery.length > 0"
      :selected-list="selectedUsers"
      :disabled-user-ids="props.disabledUserIds"
      @user-select="onUserSelect"
    />
    <GroupUserList
      v-else
      :selected-list="selectedUsers"
      :disabled-user-ids="props.disabledUserIds"
      @user-select="onUserSelect"
    />
  </template>
  <GroupUserListEmpty v-else />
</template>
