<script setup lang="ts">
type SidebarTab = 'users' | 'services' | 'chats' | 'settings';

const activeTab = ref<SidebarTab>('chats');
</script>

<template>
  <SidebarTabUsers v-if="activeTab === 'users'" />
  <SidebarTabServices v-else-if="activeTab === 'services'" />
  <SidebarTabChats v-else-if="activeTab === 'chats'" />
  <SidebarTabSettings v-else-if="activeTab === 'settings'" />

  <SidebarMenu v-model="activeTab" />
</template>
