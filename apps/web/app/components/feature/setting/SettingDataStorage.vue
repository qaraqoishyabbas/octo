<script setup lang="ts">
import {
  SettingDataMemory,
  SettingDataNetwork,
  SettingDataMobile,
  SettingDataWifi,
} from '#components';
import { formatStorageBytes } from '~/utils/storage-usage';

const emit = defineEmits<{ close: [boolean] }>();
const overlay = useOverlay();
const memory = useStorageUsageStore();
const network = useNetworkUsageStore();
const autoDownload = useMediaAutoDownloadStore();

onMounted(() => memory.refresh());
</script>

<template>
  <USlideover
    side="left"
    title="Данные и память"
    description="Использование памяти на этом устройстве"
  >
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            aria-label="Закрыть данные и память"
            @click="emit('close', false)"
          />
        </template>
        <template #center>Данные и память</template>
        <template #right>
          <UButton
            color="neutral"
            icon="i-ph-arrow-clockwise-bold"
            size="xl"
            variant="soft"
            aria-label="Обновить использование памяти"
            :loading="memory.loading"
            :disabled="memory.clearing"
            @click="memory.refresh()"
          />
        </template>
      </AppBar>
      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 pb-4">
        <div class="bg-elevated rounded-md">
          <UButton
            class="justify-start"
            block
            size="xl"
            color="neutral"
            variant="soft"
            icon="i-ph-chart-pie-slice-bold"
            @click="overlay.create(SettingDataMemory).open()"
          >
            <div class="flex w-full justify-between gap-3">
              <span class="truncate">Использование памяти</span
              ><span class="text-muted shrink-0">{{
                memory.loading
                  ? 'Считаем…'
                  : memory.error
                    ? 'Недоступно'
                    : formatStorageBytes(memory.totalBytes)
              }}</span>
            </div>
          </UButton>
          <UButton
            class="justify-start"
            block
            size="xl"
            color="neutral"
            variant="soft"
            icon="i-ph-chart-donut-bold"
            @click="overlay.create(SettingDataNetwork).open()"
          >
            <div class="flex w-full justify-between gap-3">
              <span class="truncate">Использование трафика</span
              ><span class="text-muted shrink-0">{{ formatStorageBytes(network.totalBytes) }}</span>
            </div>
          </UButton>
        </div>
        <section>
          <div class="px-3 py-1 text-base font-bold">Автозагрузка медиа</div>
          <div class="bg-elevated rounded-md">
            <UButton
              class="justify-start"
              block
              size="xl"
              color="neutral"
              variant="soft"
              icon="i-ph-cell-signal-full-bold"
              @click="overlay.create(SettingDataMobile).open()"
            >
              <div class="flex w-full flex-col items-start">
                <span>Через мобильную сеть</span
                ><span class="text-muted text-xs">{{ autoDownload.summary('mobile') }}</span>
              </div>
            </UButton>
            <UButton
              class="justify-start"
              block
              size="xl"
              color="neutral"
              variant="soft"
              icon="i-ph-wifi-high-bold"
              @click="overlay.create(SettingDataWifi).open()"
            >
              <div class="flex w-full flex-col items-start">
                <span>Через Wi-Fi</span
                ><span class="text-muted text-xs">{{ autoDownload.summary('wifi') }}</span>
              </div>
            </UButton>
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>
