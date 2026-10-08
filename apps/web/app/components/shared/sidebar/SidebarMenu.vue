<script setup lang="ts">
import { DialogsSearch } from '#components';
const overlay = useOverlay();
const openSearch = () => overlay.create(DialogsSearch).open();

type SidebarTab = 'users' | 'services' | 'chats' | 'settings';

const activeTab = defineModel<SidebarTab>({ required: true });
</script>

<template>
  <div class="sticky right-0 bottom-0 left-0">
    <div class="via-default/80 to-default bg-gradient-to-b from-transparent">
      <div class="flex gap-1.5 px-6 py-4">
        <div class="bg-elevated flex w-full rounded-xl p-0.5 shadow-lg">
          <UButton
            class="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5"
            block
            :color="activeTab == 'users' ? 'primary' : 'neutral'"
            :variant="activeTab == 'users' ? 'solid' : 'soft'"
            icon="i-ph-users-bold"
            size="xl"
            @click="activeTab = 'users'"
          >
            <span class="text-[10px]"> Контакты </span>
          </UButton>

          <UButton
            class="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5"
            block
            :color="activeTab == 'services' ? 'primary' : 'neutral'"
            :variant="activeTab == 'services' ? 'solid' : 'soft'"
            icon="i-ph-squares-four-bold"
            size="xl"
            @click="activeTab = 'services'"
          >
            <span class="text-[10px]"> Сервисы </span>
          </UButton>
          <UButton
            class="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5"
            block
            :color="activeTab == 'chats' ? 'primary' : 'neutral'"
            :variant="activeTab == 'chats' ? 'solid' : 'soft'"
            icon="i-ph-chat-circle-bold"
            size="xl"
            @click="activeTab = 'chats'"
          >
            <span class="text-[10px]"> Чаты </span>
          </UButton>
          <UButton
            class="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5"
            block
            :color="activeTab == 'settings' ? 'primary' : 'neutral'"
            :variant="activeTab == 'settings' ? 'solid' : 'soft'"
            icon="i-ph-user-bold"
            size="xl"
            @click="activeTab = 'settings'"
          >
            <span class="text-[10px]"> Настройки </span>
          </UButton>
        </div>
        <div class="bg-elevated flex rounded-xl p-0.5 shadow-lg">
          <UButton
            class="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5"
            block
            color="neutral"
            icon="i-ph-magnifying-glass-bold"
            size="xl"
            variant="soft"
            @click="openSearch"
          >
            <span class="text-[10px]"> Поиск </span>
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
