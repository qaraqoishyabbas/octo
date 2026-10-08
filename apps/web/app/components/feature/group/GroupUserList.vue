<script setup lang="ts">
import type { User } from '~/types';

const contact = useUsersStore();
const props = withDefaults(defineProps<{ selectedList?: User[]; disabledUserIds?: string[] }>(), {
  selectedList: () => [],
  disabledUserIds: () => [],
});
const emit = defineEmits<{ (e: 'user-select', user: User): void }>();

const disabledUserIdSet = computed(() => new Set(props.disabledUserIds.map((id) => String(id))));
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
  if (!container || contact.loading || !contact.hasMore) return;

  const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  if (distanceToBottom <= 288) contact.fetchData();
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
    <GroupUserListItem
      v-for="user in contact.list"
      :key="user.id"
      :user="user"
      :selected-list="props.selectedList"
      :disabled="disabledUserIdSet.has(String(user.id))"
      @select="emit('user-select', $event)"
    />

    <div class="text-center" v-if="contact.loading">
      <UBadge color="neutral" variant="soft" size="lg">
        <UIcon class="animate-spin" name="i-ph-spinner-gap" />
        Загрузка
      </UBadge>
    </div>
    <div class="text-center" v-if="!contact.hasMore">
      <UBadge color="neutral" variant="soft" size="lg" :label="contact.total + ' контактов'" />
    </div>
  </div>
</template>
