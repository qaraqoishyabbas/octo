<script setup lang="ts">
import { useInfiniteScroll } from '@vueuse/core';
import type { DialogMemberRole, DialogPermission, DialogType } from '~/types';

const emit = defineEmits<{ close: [boolean] }>();
const props = defineProps<{
  target?: string | null;
  title?: string | null;
  currentMemberRole?: DialogMemberRole | null;
  currentMemberPermissions?: DialogPermission[];
  dialogType?: DialogType | null;
}>();

const contentRef = ref<HTMLElement | null>(null);
const bottomTrigger = ref(0);
const refreshTrigger = ref(0);
const normalizedTarget = computed(() => String(props.target ?? '').trim());

useInfiniteScroll(
  contentRef,
  () => {
    bottomTrigger.value += 1;
  },
  { distance: 160 },
);
</script>

<template>
  <USlideover side="right" title="Администраторы" description="Список администраторов">
    <template #content>
      <div class="overflow-y-auto">
        <AppBar>
          <template v-slot:left>
            <UButton
              icon="i-ph-caret-left-bold"
              size="xl"
              variant="ghost"
              color="neutral"
              @click="emit('close', false)"
            />
          </template>
          <template v-slot:center>Администраторы</template>
        </AppBar>
        <div class="flex-1 overflow-y-auto" ref="contentRef">
          <ProfileUsers
            :target="normalizedTarget"
            :enabled="Boolean(normalizedTarget)"
            active-tab="admins"
            tab-value="admins"
            :roles="['owner', 'admin']"
            :current-member-role="props.currentMemberRole"
            :current-member-permissions="props.currentMemberPermissions"
            :dialog-type="props.dialogType"
            empty-label="Администраторов пока нет"
            :bottom-trigger="bottomTrigger"
            :refresh-trigger="refreshTrigger"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
