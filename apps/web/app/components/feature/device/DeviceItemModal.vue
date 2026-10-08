<script setup lang="ts">
import type { DeviceSession } from '~/types/device';
useSeoMeta({ title: 'Сеанс' });
const emit = defineEmits<{ close: [boolean] }>();
const props = defineProps<{
  item: DeviceSession;
}>();
const dayjs = useDayjs();
const devices = useDevicesStore();
const { confirm } = useConfirm();

const handleClick = async () => {
  confirm({
    title: 'Завершить сеансы',
    description: 'Вы точно хотите завершить сеанс?',
    confirmButtonText: 'Завершить',
    cancelButtonText: 'Отмена',
    confirmButtonColor: 'error',
    onConfirm: async () => {
      if (await devices.disconnect(props.item.key)) emit('close', false);
    },
  });
};
</script>
<template>
  <UModal>
    <template v-slot:content>
      <div class="overflow-y-auto">
        <AppBar>
          <template v-slot:left>
            <UButton
              size="xl"
              color="neutral"
              variant="soft"
              icon="i-ph-x-bold"
              @click="emit('close', false)"
            />
          </template>
          <template v-slot:center> Об устройстве </template>
        </AppBar>

        <div class="space-y-4 px-2.5 pb-4">
          <section class="py-6">
            <div class="flex flex-col items-center gap-3">
              <UAvatar class="size-24 text-6xl" icon="i-ph-devices-bold" />
              <div class="flex flex-col items-center text-center">
                <div class="text-lg font-bold">
                  {{
                    `${props.item.device.brand} ${props.item.os.name} ${props.item.os.version} - ${props.item.client.name}  ${props.item.client.version}`
                  }}
                </div>
                <UBadge v-if="props.item.is_current" variant="soft" color="primary" size="md">
                  Текущее устройство
                </UBadge>
                <div class="text-primary text-sm" v-else>
                  {{ dayjs(props.item.last_used_at).fromNow() }}
                </div>
              </div>
            </div>
          </section>
          <section>
            <div class="px-3 py-1 text-base font-bold">Информация об устройстве</div>
            <div class="bg-elevated rounded-md">
              <div class="text-default px-3 py-2 text-base font-medium">
                <div class="flex w-full justify-between gap-4">
                  <span class="">Приложение</span>
                  <div class="text-muted text-right">
                    {{
                      `${props.item.device.brand} ${props.item.os.name} ${props.item.os.version} - ${props.item.client.name}  ${props.item.client.version}`
                    }}
                  </div>
                </div>
              </div>
              <div class="text-default px-3 py-2 text-base font-medium">
                <div class="flex w-full justify-between gap-4">
                  <span class="">IP</span>
                  <div class="text-muted text-right">{{ props.item.ip }}</div>
                </div>
              </div>
              <div class="text-default px-3 py-2 text-base font-medium">
                <div class="flex w-full justify-between gap-4">
                  <span class="">Геопозиция</span>
                  <div class="text-muted text-right">Unknown</div>
                </div>
              </div>
            </div>
          </section>
          <section v-if="!props.item.is_current">
            <div class="bg-elevated rounded-md">
              <UButton
                block
                size="xl"
                color="error"
                variant="soft"
                label="Завершить сеанс"
                :loading="devices.disconnecting"
                :disabled="devices.disconnecting"
                @click="handleClick"
              />
            </div>
          </section>
        </div>
      </div>
    </template>
  </UModal>
</template>
