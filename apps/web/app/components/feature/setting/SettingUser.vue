<script setup lang="ts">
import { Account } from '#components';

const auth = useAuthStore();
const overlay = useOverlay();
</script>

<template>
  <div class="flex flex-col items-center gap-4 pb-6">
    <UAvatar
      class="size-28 text-4xl"
      :alt="auth.user.name"
      :src="$storage(auth.user.avatar)"
      img-class="object-cover"
    />
    <div class="flex flex-col items-center">
      <div class="line-clamp-1 truncate text-xl font-semibold">{{ auth.user.name }}</div>
      <div class="text-muted text-md line-clamp-1 font-normal">@{{ auth.user.username }}</div>
    </div>
  </div>
</template>
