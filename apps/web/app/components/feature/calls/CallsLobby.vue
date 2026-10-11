<script setup lang="ts">
// Статические данные UI-мокапа.
const roomTitle = 'Командная встреча';

const userFullName = 'Вы';

const userAvatar = '';

const inviteLink = '/calls/room/demo';

const cameraEnabled = true;

const microphoneEnabled = true;

const hasVideo = false;

const audioLevel = 35;

const mediaState = 'ready';

const checkingLabel = 'Проверяем устройства...';

const errorMessage = '';

const canConnect = true;

const selectedCameraId = 'preview-camera';

const selectedMicrophoneId = 'preview-microphone';

const cameraOptions = [{ label: 'Встроенная камера', value: selectedCameraId }];

const microphoneOptions = [{ label: 'Встроенный микрофон', value: selectedMicrophoneId }];
</script>

<template>
  <div class="bg-default text-default flex h-dvh min-h-dvh flex-col overflow-hidden">
    <AppBar>
      <template v-slot:left>
        <UButton size="xl" color="neutral" variant="ghost" icon="i-ph-caret-left-bold" />
      </template>
      <template v-slot:center>{{ roomTitle }}</template>
    </AppBar>
    <main class="grid h-full min-h-0 w-full flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section
        class="mx-auto grid min-h-0 w-full max-w-6xl content-center gap-2 overflow-y-auto lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4"
      >
        <div class="space-y-4">
          <div
            class="relative grid aspect-video min-h-52 place-items-center overflow-hidden rounded-xs bg-neutral-950 sm:min-h-64"
          >
            <div class="flex flex-col items-center gap-3 text-white" v-if="!cameraEnabled">
              <UAvatar
                class="size-20 text-2xl"
                :src="userAvatar || undefined"
                :alt="userFullName"
                size="3xl"
                img-class="object-cover"
              />
              <div class="text-sm font-semibold">{{ userFullName }}</div>
            </div>

            <div
              class="flex flex-col items-center gap-3 text-white"
              v-else-if="mediaState === 'checking'"
            >
              <UIcon class="size-9 animate-spin" name="i-ph-circle-notch-bold" />
              <div class="text-sm">{{ checkingLabel }}</div>
            </div>

            <div class="flex flex-col items-center gap-3 text-white" v-else-if="!hasVideo">
              <div class="flex size-16 items-center justify-center rounded-lg bg-white/10">
                <UIcon class="size-9" name="i-ph-video-camera-slash-bold" />
              </div>
              <div class="text-sm">Предпросмотр камеры</div>
            </div>
          </div>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            icon="i-ph-warning-circle-bold"
            :description="errorMessage"
          />
        </div>

        <div class="space-y-4">
          <section class="px-3 py-1">
            <div class="text-xl font-bold">{{ roomTitle }}</div>
            <div class="text-muted mt-1 text-sm">
              Перед подключением проверьте камеру и микрофон.
            </div>
          </section>

          <section>
            <div class="bg-elevated rounded-md">
              <UButton
                class="justify-between"
                block
                size="xl"
                color="neutral"
                variant="ghost"
                label="Камера"
              >
                <template v-slot:trailing>
                  <span>
                    <USwitch
                      :model-value="cameraEnabled"
                      size="xl"
                      checked-icon="i-ph-check-bold"
                      unchecked-icon="i-ph-x-bold"
                    />
                  </span>
                </template>
              </UButton>
              <USelect
                class="w-full"
                v-if="cameraEnabled"
                :model-value="selectedCameraId"
                size="xl"
                color="neutral"
                variant="ghost"
                value-key="value"
                :items="cameraOptions"
                :disabled="!cameraOptions.length"
                placeholder="Камера не найдена"
              />
            </div>
          </section>

          <section>
            <div class="bg-elevated rounded-md">
              <UButton
                class="justify-between"
                block
                size="xl"
                color="neutral"
                variant="ghost"
                label="Микрофон"
              >
                <template v-slot:trailing>
                  <span>
                    <USwitch
                      :model-value="microphoneEnabled"
                      size="xl"
                      checked-icon="i-ph-check-bold"
                      unchecked-icon="i-ph-x-bold"
                    />
                  </span>
                </template>
              </UButton>
              <USelect
                class="w-full"
                v-if="microphoneEnabled"
                :model-value="selectedMicrophoneId"
                size="xl"
                color="neutral"
                variant="ghost"
                value-key="value"
                :items="microphoneOptions"
                :disabled="!microphoneOptions.length"
                placeholder="Микрофон не найден"
              />
              <div class="p-3 px-3" v-if="microphoneEnabled">
                <div class="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    class="bg-primary h-full rounded-full transition-[width]"
                    :style="{ width: `${audioLevel}%` }"
                  />
                </div>
              </div>
            </div>
          </section>

          <section>
            <div class="px-3 py-1 text-base font-bold">Ссылка-приглашение</div>
            <UButton
              class="justify-start"
              block
              size="xl"
              color="neutral"
              variant="soft"
              icon="i-ph-link-bold"
              :label="inviteLink || 'Ссылка еще не создана'"
            />
          </section>

          <UButton block size="xl" color="primary" :disabled="!canConnect"> Подключиться </UButton>
        </div>
      </section>
    </main>
  </div>
</template>
