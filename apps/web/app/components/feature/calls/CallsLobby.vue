<script setup lang="ts">
import { CALL_VIDEO_CLASS } from '~/utils/call-media-layout';
import type { CallRoomController } from '~/composables/useCallRoom';

const props = defineProps<{ call: CallRoomController }>();
const emit = defineEmits<{ join: [] }>();
const {
  roomTitle,
  userFullName,
  userAvatar,
  inviteLink,
  cameraEnabled,
  microphoneEnabled,
  hasVideo,
  audioLevel,
  mediaState,
  checkingLabel,
  errorMessage,
  canConnect,
  selectedCameraId,
  selectedMicrophoneId,
  cameraOptions,
  microphoneOptions,
} = toRefs(props.call);
const { localVideoRefSetter, returnToChat, toggleCamera, copyInviteLink } = props.call;
</script>

<template>
  <div class="h-dvh w-full max-w-full min-w-0 overflow-hidden">
    <div class="bg-default flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <AppBar>
        <template v-slot:left>
          <UButton
            size="xl"
            color="neutral"
            variant="soft"
            icon="i-ph-caret-left-bold"
            @click="returnToChat"
          />
        </template>
        <template v-slot:center>{{ roomTitle }}</template>
      </AppBar>
      <div class="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-2.5 pb-2.5">
        <div
          class="mx-auto grid min-h-0 w-full max-w-6xl min-w-0 grid-cols-1 content-center gap-2 lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4"
        >
          <div class="min-w-0 space-y-4">
            <div
              class="relative grid aspect-video w-full min-w-0 place-items-center overflow-hidden rounded-xs bg-neutral-950"
            >
              <video
                v-show="cameraEnabled && hasVideo"
                :class="CALL_VIDEO_CLASS"
                :ref="localVideoRefSetter"
                autoplay
                muted
                playsinline
              />
              <div class="flex flex-col items-center gap-3 text-white" v-if="!cameraEnabled">
                <UAvatar
                  class="size-20 text-2xl"
                  :src="userAvatar ? $storage(userAvatar) : undefined"
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
                <div class="text-sm">Камера недоступна</div>
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
          <div class="min-w-0 space-y-4">
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
                  @click="toggleCamera"
                >
                  <template v-slot:trailing>
                    <span @click.stop>
                      <USwitch
                        v-model="cameraEnabled"
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
                  v-model="selectedCameraId"
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
                  @click="microphoneEnabled = !microphoneEnabled"
                >
                  <template v-slot:trailing>
                    <span @click.stop>
                      <USwitch
                        v-model="microphoneEnabled"
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
                  v-model="selectedMicrophoneId"
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
                @click="copyInviteLink"
              />
            </section>

            <UButton block size="xl" color="primary" :disabled="!canConnect" @click="emit('join')">
              Подключиться
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
