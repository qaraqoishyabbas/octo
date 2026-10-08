<script setup lang="ts">
const users = useUsersStore();

const containerRef = ref<HTMLElement | null>(null);
let scrollParent: HTMLElement | null = null;

const findScrollParent = (element: HTMLElement | null) => {
  let parent = element?.parentElement ?? null;

  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (['auto', 'scroll', 'overlay'].includes(overflowY)) return parent;

    parent = parent.parentElement;
  }

  return null;
};

const onScroll = () => {
  const container = scrollParent;
  if (!container || users.loading || !users.hasMore) return;

  const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  if (distanceToBottom <= 288) users.fetchData();
};

onMounted(() => {
  scrollParent = findScrollParent(containerRef.value);
  scrollParent?.addEventListener('scroll', onScroll, { passive: true });
});

onUnmounted(() => {
  scrollParent?.removeEventListener('scroll', onScroll);
});
</script>

<template>
  <div class="contents" ref="containerRef">
    <UsersListItem v-for="user in users.list" :key="user.id" :user="user" />

    <div class="text-center" v-if="users.loading">
      <UBadge color="neutral" variant="soft" size="lg">
        <UIcon class="animate-spin" name="i-ph-spinner-gap" />
        Загрузка
      </UBadge>
    </div>
    <div class="text-center" v-if="!users.hasMore">
      <UBadge color="neutral" variant="soft" size="lg" :label="users.total + ' контактов'" />
    </div>
  </div>
</template>
