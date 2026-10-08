<script setup lang="ts">
import { Roadmap, ChannelList } from '#components';

const overlay = useOverlay();
const auth = useAuthStore();

type ServiceItem = {
  label: string;
  icon: string;
  color?: string;
  disabled: boolean;
  onSelect?: () => void;
};

const items = ref<ServiceItem[]>([
  {
    label: 'Встречи',
    icon: 'i-ph-phone-bold',
    color: 'bg-pink-500',
    disabled: false,
    onSelect() {
      const username = String(auth.user?.username || '').trim();

      if (username) {
        navigateTo(`/calls/room/${username}`);
      }
    },
  },
  {
    label: 'Магазин',
    icon: 'i-ph-shopping-cart-bold',
    color: 'bg-red-500',
    disabled: true,
  },
  {
    label: 'Опросы',
    icon: 'i-ph-chart-bar-bold',
    color: 'bg-violet-500',
    disabled: true,
  },
  {
    label: 'Каналы',
    icon: 'i-ph-megaphone-bold',
    color: 'bg-orange-500',
    disabled: false,
    onSelect() {
      overlay.create(ChannelList).open();
    },
  },
  {
    label: 'Помощь',
    icon: 'i-ph-heartbeat-bold',
    color: 'bg-sky-500',
    disabled: true,
  },
  {
    label: 'Roadmap',
    icon: 'i-ph-lightbulb-bold',
    disabled: false,
    onSelect() {
      overlay.create(Roadmap).open();
    },
  },
]);
</script>

<template>
  <AppBar>
    <template v-slot:center>Сервисы</template>
  </AppBar>

  <div class="w-full flex-1">
    <div class="grid grid-cols-4 gap-2">
      <UButton
        class="w-full p-0"
        v-for="link in items"
        variant="ghost"
        :disabled="link.disabled"
        @click="link.onSelect?.()"
      >
        <div class="w-full space-y-2 rounded-md px-2 py-2">
          <div class="bg-primary-400 relative aspect-square w-full rounded-lg">
            <div class="absolute inset-0 flex items-center justify-center p-4">
              <UIcon class="h-full w-full text-white" :name="link.icon" />
            </div>
          </div>
          <div class="text-default w-full truncate text-center text-sm font-semibold">
            {{ link.label }}
          </div>
        </div>
      </UButton>
    </div>
  </div>
</template>
