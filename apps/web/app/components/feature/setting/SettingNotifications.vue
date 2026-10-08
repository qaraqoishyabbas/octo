<script setup lang="ts">
import type { NotificationPreferences } from '~/stores/notification';

const emit = defineEmits<{ close: [boolean] }>();
const config = useRuntimeConfig();
const appId = String(config.public.notificationAppId || '');
const notification = useNotificationStore();
const preferences = computed(() => notification.preferences);
const inAppSettings = [
  { label: 'Звук', field: 'sound' },
  { label: 'Счётчик на значке', field: 'badge' },
  { label: 'Показывать текст', field: 'show_text' },
  { label: 'Упоминания в заглушённых чатах', field: 'mentions_in_muted' },
] as const;
const busy = ref(false);
const loaded = ref(false);
const error = ref('');
const subscribed = ref(false);
const supported = computed(
  () =>
    import.meta.client &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'caches' in window,
);

function keyBytes(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register('/push-sw.js', { scope: '/push/' });
}

async function load() {
  try {
    if (supported.value && appId) {
      const worker = await registration();
      const subscription = await worker.pushManager.getSubscription();
      subscribed.value = Boolean(subscription && localStorage.getItem('octo_push_token_id'));
      if (subscribed.value) await notification.syncWorkerPreferences();
    }
  } catch {
    error.value = 'Не удалось проверить подписку на уведомления.';
  } finally {
    loaded.value = true;
  }
}

async function save(field: keyof NotificationPreferences, value: boolean) {
  error.value = '';
  try {
    await notification.savePreference(field, value);
  } catch {
    error.value = 'Не удалось сохранить настройку в этом браузере.';
  }
}

function toggle(field: keyof NotificationPreferences) {
  return save(field, !preferences.value[field]);
}

async function reset() {
  error.value = '';
  try {
    await notification.resetPreferences();
  } catch {
    error.value = 'Не удалось сбросить настройки в этом браузере.';
  }
}

async function enableBrowserPush() {
  if (!supported.value || !appId || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Разрешение на уведомления не получено.');
    const publicKey = await notification.getPublicKey(appId);
    if (!publicKey) throw new Error('Ключ Web Push не настроен на сервере.');
    await notification.savePreference('enabled', true);
    const worker = await registration();
    const subscription =
      (await worker.pushManager.getSubscription()) ||
      (await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey) as BufferSource,
      }));
    const tokenId = await notification.registerPushToken(
      appId,
      JSON.stringify(subscription.toJSON()),
    );
    localStorage.setItem('octo_push_token_id', tokenId);
    subscribed.value = true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Не удалось включить уведомления.';
  } finally {
    busy.value = false;
  }
}

async function disableBrowserPush() {
  if (!supported.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const worker = await registration();
    await (await worker.pushManager.getSubscription())?.unsubscribe();
    const id = localStorage.getItem('octo_push_token_id');
    let deleteFailed = false;
    if (id) {
      try {
        await notification.deletePushToken(id);
      } catch {
        deleteFailed = true;
      }
    }
    localStorage.removeItem('octo_push_token_id');
    subscribed.value = false;
    if (deleteFailed) {
      error.value = 'Уведомления в браузере отключены. Старый токен не удалось удалить на сервере.';
    }
  } catch {
    error.value = 'Не удалось отключить уведомления.';
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <USlideover side="left" title="Уведомления и звук">
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            @click="emit('close', false)"
          />
        </template>
        <template #center>Уведомления и звук</template>
      </AppBar>
      <p class="text-error px-4 pt-4 text-center text-sm" v-if="error" role="alert">
        {{ error }}
      </p>
      <div class="flex h-full items-center justify-center" v-if="!loaded">
        <UBadge color="neutral" variant="soft" size="lg">
          <UIcon class="animate-spin" name="i-ph-spinner-gap" />
          Проверяем уведомления
        </UBadge>
      </div>
      <div
        class="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8"
        v-else-if="!appId"
      >
        <p class="text-muted text-center">Сервис уведомлений недоступен</p>
      </div>
      <div
        class="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8"
        v-else-if="!supported"
      >
        <p class="text-muted text-center">
          Для уведомлений нужен поддерживаемый браузер и защищённое соединение.
        </p>
      </div>
      <div
        class="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8"
        v-else-if="!subscribed"
      >
        <span class="text-muted text-center">
          Будьте в курсе новых сообщений. Включите уведомления.
        </span>

        <UButton
          label="Включить уведомления"
          color="primary"
          variant="solid"
          :loading="busy"
          @click="enableBrowserPush"
        />
      </div>

      <div class="space-y-4 px-3 py-4" v-else>
        <section>
          <div class="bg-elevated rounded-md">
            <UButton
              class="justify-between"
              block
              size="xl"
              color="neutral"
              variant="soft"
              label="Уведомления"
              @click="toggle('enabled')"
            >
              <template v-slot:trailing>
                <USwitch
                  :model-value="preferences.enabled"
                  size="xl"
                  checked-icon="i-ph-check-bold"
                  unchecked-icon="i-ph-x-bold"
                  @update:model-value="save('enabled', $event)"
                />
              </template>
            </UButton>
          </div>
        </section>
        <section>
          <div class="px-3 py-1 text-base font-bold">Уведомления в приложении</div>
          <div class="bg-elevated rounded-md">
            <UButton
              class="justify-between"
              v-for="setting in inAppSettings"
              :key="setting.field"
              block
              size="xl"
              color="neutral"
              variant="soft"
              :label="setting.label"
              @click="toggle(setting.field)"
            >
              <template v-slot:trailing>
                <USwitch
                  :model-value="preferences[setting.field]"
                  size="xl"
                  checked-icon="i-ph-check-bold"
                  unchecked-icon="i-ph-x-bold"
                  @update:model-value="save(setting.field, $event)"
                />
              </template>
            </UButton>
          </div>
        </section>
        <section>
          <div class="bg-elevated rounded-md">
            <UButton
              class="justify-between"
              block
              size="xl"
              color="neutral"
              variant="soft"
              label="Имена в уведомлениях"
              @click="toggle('show_names')"
            >
              <template v-slot:trailing>
                <USwitch
                  :model-value="preferences.show_names"
                  size="xl"
                  checked-icon="i-ph-check-bold"
                  unchecked-icon="i-ph-x-bold"
                  @update:model-value="save('show_names', $event)"
                />
              </template>
            </UButton>
          </div>
        </section>
        <section class="bg-elevated rounded-md">
          <UButton
            class="justify-start"
            block
            color="neutral"
            size="xl"
            variant="soft"
            label="Сбросить настройки уведомлений"
            @click="reset"
          />
        </section>
      </div>
    </template>
  </USlideover>
</template>
