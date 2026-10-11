<script setup lang="ts">
import { Roadmap, ChannelList } from '#components';

const overlay = useOverlay();
const auth = useAuthStore();

type ServiceItem = {
  label: string;
  icon: string;
  color?: string;
  onSelect: () => void;
};

const items = ref<ServiceItem[]>([
  {
    label: 'Встречи',
    icon: 'i-ph-phone-bold',
    color: 'bg-pink-500',
    onSelect() {
      const username = String(auth.user?.username || '').trim();

      if (username) {
        navigateTo(`/calls/room/${username}`);
      }
    },
  },
  {
    label: 'Каналы',
    icon: 'i-ph-megaphone-bold',
    color: 'bg-orange-500',
    onSelect() {
      overlay.create(ChannelList).open();
    },
  },
  {
    label: 'Roadmap',
    icon: 'i-ph-lightbulb-bold',
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
        @click="link.onSelect()"
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
