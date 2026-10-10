<script setup lang="ts">
import type { AutoDownloadKind, AutoDownloadProfile } from '~/stores/media-auto-download';
const props = defineProps<{ profile: AutoDownloadProfile }>();
const emit = defineEmits<{ close: [boolean] }>();
const settings = useMediaAutoDownloadStore();
const title = computed(() => (props.profile === 'mobile' ? 'Через мобильную сеть' : 'Через Wi-Fi'));
const profile = computed(() => settings.profiles[props.profile]);
const mediaKinds: { kind: AutoDownloadKind; label: string; icon: string }[] = [
  { kind: 'photos', label: 'Фото', icon: 'i-ph-image-bold' },
  { kind: 'videos', label: 'Видео', icon: 'i-ph-video-bold' },
  { kind: 'files', label: 'Файлы', icon: 'i-ph-file-bold' },
];
function updateLimit(kind: AutoDownloadKind, value: number) {
  settings.updateProfile(props.profile, { [kind]: { maxSizeMb: value } });
}
</script>

<template>
  <USlideover side="left" :title="title" description="Автозагрузка медиа на этом устройстве">
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-arrow-left-bold"
            size="xl"
            variant="soft"
            aria-label="Назад"
            @click="emit('close', false)"
          />
        </template>
        <template #center>{{ title }}</template>
      </AppBar>
      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 pb-4">
        <section class="bg-elevated rounded-md p-4">
          <USwitch
            :model-value="profile.enabled"
            label="Автозагрузка медиа"
            size="xl"
            @update:model-value="settings.updateProfile(props.profile, { enabled: $event })"
          />
        </section>
        <section>
          <div class="px-3 py-1 text-base font-bold">Что загружать автоматически</div>
          <div class="bg-elevated divide-default divide-y rounded-md">
            <div class="space-y-3 p-4" v-for="entry in mediaKinds" :key="entry.kind">
              <div class="flex items-center gap-3">
                <UIcon class="size-5 shrink-0" :name="entry.icon" />
                <USwitch
                  class="flex-1"
                  :model-value="profile[entry.kind].enabled"
                  :label="entry.label"
                  :disabled="!profile.enabled"
                  @update:model-value="
                    settings.updateProfile(props.profile, { [entry.kind]: { enabled: $event } })
                  "
                />
              </div>
              <div class="flex items-center justify-between gap-3">
                <label
                  class="text-muted text-sm"
                  :for="`auto-download-${props.profile}-${entry.kind}`"
                  >До, МБ</label
                >
                <UInputNumber
                  class="w-40"
                  :id="`auto-download-${props.profile}-${entry.kind}`"
                  :model-value="profile[entry.kind].maxSizeMb"
                  :min="1"
                  :max="2000"
                  :step="1"
                  :disabled="!profile.enabled || !profile[entry.kind].enabled"
                  @update:model-value="updateLimit(entry.kind, $event)"
                />
              </div>
            </div>
          </div>
        </section>
        <section class="bg-elevated space-y-3 rounded-md p-4">
          <div class="font-semibold">Текущая сеть</div>
          <p class="text-muted text-sm" v-if="!settings.detectedProfile">
            Браузер не определяет тип сети. Применяются настройки мобильной сети.
          </p>
          <p class="text-muted text-sm" v-else>
            Применяются настройки:
            {{ settings.activeProfile === 'mobile' ? 'мобильная сеть' : 'Wi-Fi' }}.
          </p>
          <p class="text-muted text-sm" v-if="!settings.isOnline">
            Нет подключения к сети: автозагрузка приостановлена.
          </p>
          <p class="text-muted text-sm" v-if="settings.dataSaver">
            В браузере включена экономия трафика: автозагрузка приостановлена.
          </p>
        </section>
        <p class="text-muted px-3 text-sm">
          Настройки сохраняются для этого аккаунта на устройстве. Файлы загружаются в кэш, без
          сохранения в папку загрузок. Медиа всегда можно открыть вручную.
        </p>
      </div>
    </template>
  </USlideover>
</template>
