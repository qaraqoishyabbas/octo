<script setup lang="ts">
definePageMeta({
  layout: 'empty',
  key: (route) => route.path,
  middleware: [
    'auth',
    (to) => {
      if (to.query.join !== '1') {
        return navigateTo(
          {
            path: '/calls/lobby',
            query: { username: String(to.params.username || '') },
          },
          { replace: true },
        );
      }
    },
  ],
});
useSeoMeta({ title: 'Встреча' });

const route = useRoute();
const username = computed(() => String(route.params.username || ''));
const call = useCallRoom(username, {
  autoJoin: true,
  onLeave: () => navigateTo({ path: '/calls/lobby', query: { username: username.value } }),
});
</script>

<template>
  <CallsRoom :call="call" />
</template>
