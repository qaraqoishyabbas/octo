<script setup lang="ts">
definePageMeta({ layout: 'empty', middleware: ['auth'] });
useSeoMeta({ title: 'Встреча' });

// Для просмотра экрана встречи измените isJoined.
const isJoined = false;
</script>

<template>
  <CallsLobby v-if="!isJoined" />
  <CallsRoom v-else />
</template>
