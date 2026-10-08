<script setup lang="ts">
import type { User } from '~/types';

const contact = useUsersStore();
const props = withDefaults(defineProps<{ selectedList?: User[]; disabledUserIds?: string[] }>(), {
  selectedList: () => [],
  disabledUserIds: () => [],
});
const emit = defineEmits<{ (e: 'user-select', user: User): void }>();

const disabledUserIdSet = computed(() => new Set(props.disabledUserIds.map((id) => String(id))));

onUnmounted(() => contact.closeSearch());
</script>

<template>
  <div class="h-full overflow-y-auto">
    <UsersSearchListLoading v-if="contact.searchLoading" />
    <UsersSearchListError v-else-if="contact.searchError" @retry="contact.fetchSearchData" />
    <UsersSearchListEmpty v-else-if="contact.searchList.length === 0" />
    <GroupUserListItem
      v-for="user in contact.searchLoading || contact.searchError ? [] : contact.searchList"
      :key="user.id"
      :user="user"
      :selected-list="props.selectedList"
      :disabled="disabledUserIdSet.has(String(user.id))"
      @select="emit('user-select', $event)"
    />
  </div>
</template>
