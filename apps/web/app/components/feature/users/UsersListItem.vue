<script setup lang="ts">
import type { User } from '~/types';

const props = defineProps<{
  user: User;
}>();

const usersOnline = useUsersOnlineStore();
const link = computed(() => `@${props.user.username}`);
const onlineText = computed(() => usersOnline.getOnlineText(props.user.id, link.value));
const isOnline = computed(() => usersOnline.isOnline(props.user.id));

watch(
  () => props.user.last_seen_at,
  (lastSeenAt) => {
    if (lastSeenAt !== undefined) {
      usersOnline.setBackendLastSeen(props.user.id, lastSeenAt);
    }
  },
  { immediate: true },
);
</script>

<template>
  <NuxtLink :to="link">
    <Item>
      <template v-slot:avatar>
        <UAvatar size="3xl" :alt="user.name" :src="$storage(user.avatar)" />
      </template>

      <template v-slot:heading>
        {{ user.name }}
      </template>

      <template v-slot:description>
        <span :class="{ 'text-primary': isOnline }">{{ onlineText }}</span>
      </template>
    </Item>
  </NuxtLink>
</template>
