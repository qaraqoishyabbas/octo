<script setup lang="ts">
import type { InviteDialog } from '~/stores/invitations';
const props = defineProps<{ item: InviteDialog; joining?: boolean }>();
defineEmits<{ join: [] }>();
const { withCount } = useInflection();
const audienceText = computed(() =>
  withCount(
    props.item.users_count,
    props.item.type === 'C'
      ? ['подписчик', 'подписчика', 'подписчиков']
      : ['участник', 'участника', 'участников'],
  ),
);
</script>

<template>
  <div class="bg-elevated rounded-md p-2">
    <div class="flex flex-col items-center space-y-4">
      <UAvatar
        class="size-20 rounded-[0.75rem] text-4xl uppercase"
        :src="$storage(item.avatar)"
        :alt="item.title ?? undefined"
        img-class="object-cover"
      />
      <div>
        <div
          class="px-4 text-center text-lg/5 font-semibold break-words wrap-anywhere whitespace-pre-line"
        >
          {{ item.title }}
        </div>
        <div class="text-muted px-4 text-center text-sm">{{ audienceText }}</div>
      </div>
    </div>
    <UButton
      class="mt-6 w-full justify-center"
      size="lg"
      :loading="joining"
      :disabled="joining"
      @click="$emit('join')"
    >
      {{ item.is_member ? 'Открыть' : 'Присоединиться' }}
    </UButton>
  </div>
</template>
