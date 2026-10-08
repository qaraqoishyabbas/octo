<script setup lang="ts">
import type { User } from '~/types';

const props = defineProps<{
  user: User;
  selectedList?: User[];
  disabled?: boolean;
  disabledLabel?: string;
}>();
const emit = defineEmits<{ (e: 'select', user: User): void }>();

const usersOnline = useUsersOnlineStore();
const isSelected = computed(() =>
  (props.selectedList ?? []).some(
    (item) => String(item?.id ?? '') === String(props.user?.id ?? ''),
  ),
);
const usernameText = computed(() =>
  props.user.username ? `@${props.user.username}` : 'был(-а) давно',
);
const onlineText = computed(() => usersOnline.getOnlineText(props.user.id, usernameText.value));
const isOnline = computed(() => usersOnline.isOnline(props.user.id));

const onClick = () => {
  if (props.disabled) {
    return;
  }

  emit('select', props.user);
};

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
  <Item
    :no-hover="props.disabled"
    :no-cursor="props.disabled"
    :class="{ 'opacity-55': props.disabled }"
    @click="onClick"
  >
    <template v-slot:avatar>
      <UChip
        position="bottom-right"
        inset
        :show="isSelected"
        color="primary"
        :ui="{ base: 'ring-2 h-[16px] min-w-[16px] text-sm' }"
      >
        <template #content>
          <UIcon name="i-ph-check-bold" />
        </template>

        <UAvatar size="3xl" :alt="user.name" :src="$storage(user.avatar)" />
      </UChip>
    </template>

    <template v-slot:heading>
      {{ user.name }}
    </template>

    <template v-slot:description>
      <span :class="{ 'text-primary': isOnline }">{{ onlineText }}</span>
    </template>

    <template v-if="props.disabled" #loadingTop>
      <UBadge size="xs" color="primary" variant="soft" label="Участник группы" />
    </template>
  </Item>
</template>
