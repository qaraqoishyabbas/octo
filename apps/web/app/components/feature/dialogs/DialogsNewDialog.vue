<script setup lang="ts">
import { Channel, Group, UsersSearch } from '#components';
const overlay = useOverlay();
const users = useUsersStore();
const openSearch = () => overlay.create(UsersSearch).open();

const emit = defineEmits<{ close: [boolean] }>();
onMounted(() => {
  if (users.list.length == 0) {
    users.fetchData();
  }
});
</script>

<template>
  <USlideover side="left">
    <template v-slot:content>
      <div class="overflow-y-auto">
        <AppBar>
          <template v-slot:left>
            <UButton
              color="neutral"
              icon="i-ph-x-bold"
              size="xl"
              variant="soft"
              @click="emit('close', false)"
            />
          </template>
          <template v-slot:center> Написать сообщение </template>
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
        <div class="w-full flex-1 space-y-4">
          <div class="space-y-4 px-2.5">
            <div class="bg-elevated rounded-md">
              <UButton
                class="justify-start"
                block
                color="primary"
                size="xl"
                variant="ghost"
                icon="i-ph-users-bold"
                label="Создать группу"
                @click="overlay.create(Group).open()"
              />
              <UButton
                class="justify-start"
                block
                color="primary"
                size="xl"
                variant="ghost"
                icon="i-ph-megaphone-bold"
                label="Создать канал"
                @click="overlay.create(Channel).open()"
              />
            </div>
          </div>
          <UsersList />
        </div>
      </div>
    </template>
  </USlideover>
</template>
