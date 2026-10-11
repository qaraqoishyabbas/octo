<script setup lang="ts">
import type { AutoDownloadProfile } from '~/stores/media-auto-download';
const props = defineProps<{ profile: AutoDownloadProfile }>();
const emit = defineEmits<{ close: [boolean] }>();
const settings = useMediaAutoDownloadStore();
const title = computed(() => (props.profile === 'mobile' ? 'Через мобильную сеть' : 'Через Wi-Fi'));
const profile = computed(() => settings.profiles[props.profile]);
const trafficLevel = computed({
  get() {
    if (!profile.value.videos.enabled) return 1;
    return profile.value.photos.maxSizeMb <= 10 && profile.value.videos.maxSizeMb <= 15 ? 2 : 3;
  },
  set(value: number) {
    if (![1, 2, 3].includes(value) || !profile.value.enabled) return;
    settings.updateProfile(props.profile, {
      photos: { enabled: true, maxSizeMb: value === 3 ? 15 : 10 },
      videos: { enabled: value !== 1, maxSizeMb: value === 3 ? 20 : 15 },
      files: { enabled: false },
    });
  },
});
const selectedTrafficLabel = computed(
  () =>
    [
      'Низкий (фото (10 МБ))',
      'Средний (фото (10 МБ), видео (15 МБ))',
      'Высокий (фото (15 МБ), видео (20 МБ))',
    ][trafficLevel.value - 1],
);
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
      <div class="flex-1 space-y-4 px-2.5">
        <section>
          <div class="bg-elevated rounded-md">
            <UButton
              class="justify-between"
              as="div"
              block
              size="xl"
              color="neutral"
              variant="soft"
              label="Автозагрузка медиа"
              @click="settings.updateProfile(props.profile, { enabled: !profile.enabled })"
            >
              <template v-slot:trailing>
                <USwitch
                  :model-value="profile.enabled"
                  aria-label="Автозагрузка медиа"
                  size="xl"
                  checked-icon="i-ph-check-bold"
                  unchecked-icon="i-ph-x-bold"
                  @click.stop
                  @update:model-value="settings.updateProfile(props.profile, { enabled: $event })"
                />
              </template>
            </UButton>
          </div>
        </section>
        <section>
          <div class="px-3 py-1 text-base font-bold">Расход трафика</div>
          <div class="bg-elevated rounded-md">
            <div class="flex flex-col space-y-4 px-3 py-2">
              <div class="flex w-full justify-between">
                <span class="text-muted text-xs">Низкий</span>
                <span class="text-muted text-xs">Средний</span>
                <span class="text-muted text-xs">Высокий</span>
              </div>
              <USlider
                v-model="trafficLevel"
                :disabled="!profile.enabled"
                :step="1"
                :max="3"
                :min="1"
                aria-label="Расход трафика"
              />
            </div>
            <p class="text-muted px-3 py-2 text-sm">
              Выбран: <span class="text-primary">{{ selectedTrafficLabel }}</span>
            </p>
          </div>
        </section>
        <p class="text-muted px-3 text-sm">
          Настройки сохраняются для этого аккаунта на устройстве. Файлы загружаются в кэш, без
          сохранения в папку загрузок. Медиа всегда можно открыть вручную.
        </p>
      </div>
    </template>
  </USlideover>
</template>
