<script setup lang="ts">
import { formatStorageBytes } from '~/utils/storage-usage';

const emit = defineEmits<{ close: [boolean] }>();
const usage = useNetworkUsageStore();
const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();

const requestReset = () => {
  const userId = String(auth.user.id ?? '');
  confirm({
    title: 'Сбросить статистику трафика?',
    description: 'Счётчики текущего аккаунта на этом устройстве начнут отсчёт заново.',
    confirmButtonText: 'Сбросить',
    confirmButtonColor: 'error',
    onConfirm: () => {
      if (String(auth.user.id ?? '') !== userId) return;
      usage.reset();
      toast.add({ title: 'Статистика сброшена', color: 'success' });
    },
  });
};
</script>

<template>
  <USlideover
    side="left"
    title="Использование трафика"
    description="Статистика текущего аккаунта на этом устройстве"
  >
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            aria-label="Закрыть использование трафика"
            @click="emit('close', false)"
          />
        </template>
        <template #center>Использование трафика</template>
      </AppBar>
      <div class="space-y-4 px-2.5 pb-4">
        <section>
          <div class="px-3 py-1 text-base font-bold">Общий расход трафика</div>
          <div class="bg-elevated rounded-md">
            <div
              class="text-default inline-flex w-full justify-start gap-2 rounded-md px-3 py-2 text-base font-medium"
            >
              <UIcon class="size-6 shrink-0" name="i-ph-arrow-line-down-bold" />
              <div class="flex w-full justify-between">
                <span class="truncate">Получено</span>
                <div class="text-muted shrink-0" aria-live="polite">
                  {{ formatStorageBytes(usage.state.receivedBytes + usage.state.mediaBytes) }}
                </div>
              </div>
            </div>
            <div
              class="text-default inline-flex w-full justify-start gap-2 rounded-md px-3 py-2 text-base font-medium"
            >
              <UIcon class="size-6 shrink-0" name="i-ph-arrow-line-up-bold" />
              <div class="flex w-full justify-between">
                <span class="truncate">Отправлено</span>
                <div class="text-muted shrink-0" aria-live="polite">
                  {{ formatStorageBytes(usage.state.sentBytes) }}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section>
          <div class="text-muted px-3 text-xs font-normal text-pretty">
            <div>
              Приблизительная статистика этого аккаунта в браузере. API: размер тел запросов и
              ответов без заголовков, сжатия и служебных данных. Повторные попытки учитываются
              отдельно; отправленный размер может включать запросы, прерванные до передачи.
            </div>
            <br />
            <div>
              Медиа: сетевые загрузки фото, видео и аудио, для которых браузер сообщает размер.
              Некоторые внешние ресурсы скрывают его. Звонки, WebSocket и трафик других приложений
              не учитываются.
            </div>
          </div>
        </section>

        <div class="bg-elevated rounded-md">
          <UButton
            block
            color="error"
            size="xl"
            variant="soft"
            label="Сбросить статистику"
            @click="requestReset"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
