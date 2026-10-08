<script setup lang="ts">
import type { User } from '~/types';
import { GroupCreateSetDetails } from '#components';
import { useDebounceFn } from '@vueuse/core';
useSeoMeta({ title: 'Создать группу' });

const props = withDefaults(defineProps<{ disabledUserIds?: string[] }>(), {
  disabledUserIds: () => [],
});
const emit = defineEmits<{ (e: 'close', value: boolean): void }>();

const users = useUsersStore();
let disposed = false;
const selectedUsers = ref<User[]>([]);
const disabledUserIdSet = computed(() => new Set(props.disabledUserIds.map((id) => String(id))));
const overlay = useOverlay();
const { verbForm, withCount } = useInflection();

const debouncedFn = useDebounceFn(async () => {
  if (!disposed) await users.fetchSearchData();
}, 500);

const onInput = async () => {
  users.invalidateSearch();
  await debouncedFn();
};
onBeforeUnmount(() => {
  disposed = true;
  void users.closeSearch();
});

onMounted(() => {
  users.searchMode = true;
  if (users.list.length == 0) {
    users.fetchData();
  }
});
const input = useTemplateRef('input');

const onUserSelect = (user: User, clearSearch = false) => {
  if (disabledUserIdSet.value.has(String(user.id))) {
    return;
  }

  const found = selectedUsers.value.find((item) => item.id === user.id);

  if (!found) {
    selectedUsers.value.push(user);
    if (users.searchQuery || clearSearch) {
      input.value?.inputRef?.focus();
      users.closeSearch();
    }
    return;
  }

  selectedUsers.value = selectedUsers.value.filter((item) => item.id !== found.id);
};

watch(disabledUserIdSet, (ids) => {
  selectedUsers.value = selectedUsers.value.filter((user) => !ids.has(String(user.id)));
});
</script>

<template>
  <USlideover side="left" title="Создать группу" description="Страница создание группы">
    <template #content>
      <AppBar>
        <template v-slot:left>
          <UButton
            icon="i-ph-caret-left-bold"
            size="xl"
            variant="soft"
            color="neutral"
            @click="emit('close', false)"
          />
        </template>
        <template v-slot:center>
          <div class="animate-pulse" v-if="users.pageInLoading">Загрузка...</div>
          <div v-else>
            <div>Создать группу</div>
            <div
              class="text-muted line-clamp-1 text-xs font-normal break-words wrap-anywhere whitespace-pre-line"
              v-if="selectedUsers.length > 0"
            >
              {{ verbForm(selectedUsers.length, ['Выбран', 'Выбраны']) }}
              {{ withCount(selectedUsers.length, ['участник', 'участника', 'участников']) }}
            </div>
          </div>
        </template>
        <template v-slot:right>
          <UButton
            label="Далее"
            size="xl"
            :color="selectedUsers.length > 0 ? 'primary' : 'neutral'"
            :variant="selectedUsers.length > 0 ? 'soft' : 'ghost'"
            :disabled="!(selectedUsers.length > 0)"
            @click="overlay.create(GroupCreateSetDetails).open({ userList: selectedUsers })"
          />
        </template>
        <template v-slot:bottom>
          <div class="flex justify-between gap-1.5 px-4 pb-4">
            <div class="bg-elevated flex w-full flex-col rounded-md p-0.5 shadow-lg">
              <UInput
                class="w-full"
                v-model="users.searchQuery"
                :highlight="false"
                placeholder="Кого Вы бы хотели добавить в группу?"
                size="xl"
                autofocus
                ref="input"
                variant="none"
                @input="onInput"
              />
              <div class="max-h-28 min-h-10 overflow-y-auto" v-if="selectedUsers.length > 0">
                <div class="my-2 flex flex-wrap gap-2 px-2">
                  <UBadge
                    class="cursor-pointer"
                    v-for="user in selectedUsers"
                    :key="user.id"
                    variant="soft"
                    :label="user.name"
                    icon="i-ph-x-bold"
                    @click="onUserSelect(user)"
                  />
                </div>
              </div>
            </div>
          </div>
        </template>
      </AppBar>
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
  </USlideover>
</template>
