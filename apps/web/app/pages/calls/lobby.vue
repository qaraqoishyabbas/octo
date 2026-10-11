<script setup lang="ts">
definePageMeta({ layout: 'empty', middleware: ['auth'], key: (route) => route.fullPath });
useSeoMeta({ title: 'Подготовка к встрече' });

const route = useRoute();
const auth = useAuthStore();
const username = computed(() =>
  String(route.query.username || auth.user.username || '')
    .replace(/^@/, '')
    .trim(),
);
const call = useCallRoom(username);

async function joinRoom() {
  if (!call.canConnect || !call.roomUsername) return;
  call.saveCallSettings();
  await navigateTo({
    path: `/calls/room/${encodeURIComponent(call.roomUsername)}`,
    query: { join: '1' },
  });
}
</script>

<template>
  <CallsLobby :call="call" @join="joinRoom" />
</template>
