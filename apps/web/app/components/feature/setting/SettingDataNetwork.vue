<script setup lang="ts">
import { formatStorageBytes } from '~/utils/storage-usage';

const emit = defineEmits<{ close: [boolean] }>();
const usage = useNetworkUsageStore();
const auth = useAuthStore();
const { confirm } = useConfirm();
const toast = useToast();
const since = computed(() => new Date(usage.state.since).toLocaleString('ru-RU'));
const rows = computed(() => [
  { label: 'Отправлено через API', bytes: usage.state.sentBytes, icon: 'i-ph-arrow-up-bold' },
  { label: 'Получено через API', bytes: usage.state.receivedBytes, icon: 'i-ph-arrow-down-bold' },
  { label: 'Загрузка медиа в браузере', bytes: usage.state.mediaBytes, icon: 'i-ph-image-bold' },
]);

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
      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 pb-4">
        <section class="bg-elevated space-y-2 rounded-md p-4">
          <h2 class="text-muted text-sm">Всего учтено</h2>
          <p class="text-2xl font-semibold" aria-live="polite">
            {{ formatStorageBytes(usage.totalBytes) }}
          </p>
          <p class="text-muted text-xs">С {{ since }}</p>
        </section>
        <dl class="bg-elevated divide-default divide-y rounded-md">
          <div
            class="flex items-center justify-between gap-3 p-4"
            v-for="row in rows"
            :key="row.label"
          >
            <dt class="flex items-center gap-3">
              <UIcon class="text-muted shrink-0" :name="row.icon" />
              <span>{{ row.label }}</span>
            </dt>
            <dd class="shrink-0">{{ formatStorageBytes(row.bytes) }}</dd>
          </div>
        </dl>
        <dl class="bg-elevated space-y-3 rounded-md p-4 text-sm">
          <div class="flex justify-between gap-3">
            <dt>Успешные запросы API</dt>
            <dd>{{ usage.state.successfulRequests }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt>Ошибки запросов API</dt>
            <dd>{{ usage.state.failedRequests }}</dd>
          </div>
        </dl>
        <p class="text-muted px-3 text-sm">
          Приблизительная статистика этого аккаунта в браузере. API: размер тел запросов и ответов
          без заголовков, сжатия и служебных данных. Повторные попытки учитываются отдельно;
          отправленный размер может включать запросы, прерванные до передачи.
        </p>
        <p class="text-muted px-3 text-sm">
          Медиа: сетевые загрузки фото, видео и аудио, для которых браузер сообщает размер.
          Некоторые внешние ресурсы скрывают его. Звонки, WebSocket и трафик других приложений не
          учитываются.
        </p>
        <UButton
          block
          color="error"
          variant="soft"
          label="Сбросить статистику"
          @click="requestReset"
        />
      </div>
    </template>
  </USlideover>
</template>
