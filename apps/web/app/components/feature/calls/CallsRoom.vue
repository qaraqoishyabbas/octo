<script setup lang="ts">
import type { CallRoomController } from '~/composables/useCallRoom';

const props = defineProps<{ call: CallRoomController }>();
const {
  roomUsername,
  roomTitle,
  userFullName,
  userAvatar,
  cameraEnabled,
  microphoneEnabled,
  screenSharing,
  hasVideo,
  mediaState,
  checkingLabel,
  errorMessage,
  participantsPanelOpen,
  leaveConfirmOpen,
  localIsSpeaking,
  localConnectionStatus,
  remoteParticipants,
  mainParticipant,
  currentParticipantPage,
  participantPages,
  participantsCount,
  participantsCarouselPage,
  hasParticipantPages,
  isSingleParticipantGrid,
  thumbnailGridClass,
} = toRefs(props.call);
const {
  localVideoRefSetter,
  createRemoteVideoRefSetter,
  hasParticipantVideo,
  getParticipantVideoClass,
  getConnectionStatusClass,
  getConnectionStatusLabel,
  toggleParticipantOnMain,
  showPreviousParticipantsPage,
  showNextParticipantsPage,
  toggleCamera,
  toggleScreenShare,
  leaveCall,
  confirmLeaveCall,
  retryCallMedia,
} = props.call;
</script>

<template>
  <div class="bg-default text-default flex h-dvh min-h-dvh flex-col overflow-hidden">
    <main class="grid h-full min-h-0 w-full flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section class="flex min-h-0 flex-col gap-2 overflow-hidden">
        <div
          class="relative grid min-h-0 flex-1 rounded-xs ring-0 transition-shadow"
          v-if="mainParticipant"
          :key="`main-${mainParticipant.id}`"
          role="button"
          tabindex="0"
          @click="toggleParticipantOnMain(mainParticipant.id)"
          @keydown.enter.prevent="toggleParticipantOnMain(mainParticipant.id)"
          @keydown.space.prevent="toggleParticipantOnMain(mainParticipant.id)"
          :class="
            mainParticipant.isSpeaking
              ? 'ring-primary ring-2 ring-offset-2 ring-offset-(--ui-bg)'
              : ''
          "
        >
          <div
            class="relative grid min-h-0 place-items-center overflow-hidden rounded-xs bg-neutral-950"
          >
            <video
              v-if="mainParticipant.isLocal"
              v-show="hasParticipantVideo(mainParticipant)"
              :ref="localVideoRefSetter"
              autoplay
              muted
              playsinline
              :class="getParticipantVideoClass(mainParticipant)"
            />
            <video
              v-else
              v-show="hasParticipantVideo(mainParticipant)"
              :ref="createRemoteVideoRefSetter(mainParticipant.id)"
              autoplay
              playsinline
              :class="getParticipantVideoClass(mainParticipant)"
            />
            <div
              class="flex flex-col items-center gap-3 text-white"
              v-if="!hasParticipantVideo(mainParticipant)"
            >
              <UAvatar
                class="size-24 text-3xl"
                :src="mainParticipant.avatar ? $storage(mainParticipant.avatar) : undefined"
                :alt="mainParticipant.name"
                size="3xl"
                img-class="object-cover"
              />
              <div class="text-sm font-semibold">{{ mainParticipant.name }}</div>
            </div>

            <div
              class="flex flex-col items-center gap-3 text-white"
              v-else-if="
                mainParticipant.isLocal &&
                !screenSharing &&
                cameraEnabled &&
                mediaState === 'checking'
              "
            >
              <UIcon class="size-11 animate-spin" name="i-ph-circle-notch-bold" />
              <div class="text-sm">{{ checkingLabel }}</div>
            </div>

            <div
              class="flex flex-col items-center gap-3 text-white"
              v-else-if="mainParticipant.isLocal && !screenSharing && cameraEnabled && !hasVideo"
            >
              <div class="flex size-20 items-center justify-center rounded-lg bg-white/10">
                <UIcon class="size-11" name="i-ph-video-camera-slash-bold" />
              </div>
              <div class="text-sm">Камера недоступна</div>
            </div>
          </div>
        </div>

        <div
          class="m-1 grid gap-2"
          v-if="currentParticipantPage.length"
          :class="[
            thumbnailGridClass,
            mainParticipant ? 'h-24 shrink-0 md:h-32' : 'min-h-0 flex-1 auto-rows-fr',
            isSingleParticipantGrid ? 'place-items-center' : '',
          ]"
        >
          <div
            class="relative grid min-h-0 rounded-xs ring-0 transition-shadow"
            v-for="participant in currentParticipantPage"
            :key="`${mainParticipant ? 'thumb' : 'grid'}-${participant.id}`"
            role="button"
            tabindex="0"
            @click="toggleParticipantOnMain(participant.id)"
            @keydown.enter.prevent="toggleParticipantOnMain(participant.id)"
            @keydown.space.prevent="toggleParticipantOnMain(participant.id)"
            :class="[
              participant.isSpeaking
                ? 'ring-primary ring-2 ring-offset-2 ring-offset-(--ui-bg)'
                : '',
              isSingleParticipantGrid ? 'h-full w-full max-w-6xl' : '',
            ]"
          >
            <div
              class="relative grid min-h-0 place-items-center overflow-hidden rounded-xs bg-neutral-950"
            >
              <video
                v-if="participant.isLocal"
                v-show="hasParticipantVideo(participant)"
                :ref="localVideoRefSetter"
                autoplay
                muted
                playsinline
                :class="getParticipantVideoClass(participant)"
              />
              <video
                v-else
                v-show="hasParticipantVideo(participant)"
                :ref="createRemoteVideoRefSetter(participant.id)"
                autoplay
                playsinline
                :class="getParticipantVideoClass(participant)"
              />
              <div
                class="flex flex-col items-center gap-3 text-white"
                v-if="!hasParticipantVideo(participant)"
              >
                <UAvatar
                  :src="participant.avatar ? $storage(participant.avatar) : undefined"
                  :alt="participant.name"
                  size="3xl"
                  img-class="object-cover"
                  :class="
                    mainParticipant ? 'size-12 text-lg md:size-14 md:text-xl' : 'size-24 text-3xl'
                  "
                />
                <div class="font-semibold" :class="mainParticipant ? 'text-xs' : 'text-sm'">
                  {{ participant.name }}
                </div>
              </div>

              <div
                class="flex flex-col items-center gap-3 text-white"
                v-else-if="
                  participant.isLocal &&
                  !screenSharing &&
                  cameraEnabled &&
                  mediaState === 'checking'
                "
              >
                <UIcon class="size-11 animate-spin" name="i-ph-circle-notch-bold" />
                <div class="text-sm">{{ checkingLabel }}</div>
              </div>

              <div
                class="flex flex-col items-center gap-3 text-white"
                v-else-if="participant.isLocal && !screenSharing && cameraEnabled && !hasVideo"
              >
                <div class="flex size-20 items-center justify-center rounded-lg bg-white/10">
                  <UIcon class="size-11" name="i-ph-video-camera-slash-bold" />
                </div>
                <div class="text-sm">Камера недоступна</div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 items-center justify-center gap-2" v-if="hasParticipantPages">
          <UButton
            icon="i-ph-caret-left-bold"
            size="xs"
            color="neutral"
            variant="soft"
            :disabled="participantsCarouselPage === 0"
            @click="showPreviousParticipantsPage"
          />
          <UBadge color="neutral" variant="soft" size="md">
            {{ participantsCarouselPage + 1 }} / {{ participantPages.length }}
          </UBadge>
          <UButton
            icon="i-ph-caret-right-bold"
            size="xs"
            color="neutral"
            variant="soft"
            :disabled="participantsCarouselPage >= participantPages.length - 1"
            @click="showNextParticipantsPage"
          />
        </div>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-ph-warning-circle-bold"
          :description="errorMessage"
        />

        <UButton
          v-if="errorMessage"
          label="Повторить подключение устройств"
          color="neutral"
          variant="soft"
          @click="retryCallMedia"
        />
        <div class="flex items-center justify-center gap-2">
          <UButton
            :icon="microphoneEnabled ? 'i-ph-microphone-bold' : 'i-ph-microphone-slash-bold'"
            size="xl"
            color="neutral"
            :variant="microphoneEnabled ? 'soft' : 'solid'"
            @click="microphoneEnabled = !microphoneEnabled"
          />
          <UButton
            :icon="cameraEnabled ? 'i-ph-video-camera-bold' : 'i-ph-video-camera-slash-bold'"
            size="xl"
            color="neutral"
            :variant="cameraEnabled ? 'soft' : 'solid'"
            @click="toggleCamera"
          />
          <UButton
            :icon="screenSharing ? 'i-ph-monitor-arrow-up-fill' : 'i-ph-monitor-arrow-up-bold'"
            size="xl"
            color="neutral"
            :variant="screenSharing ? 'solid' : 'soft'"
            @click="toggleScreenShare"
          />
          <UButton
            class="lg:hidden"
            icon="i-ph-users-bold"
            @click="participantsPanelOpen = true"
            size="xl"
            color="neutral"
            variant="soft"
          >
            <template #trailing>
              <UBadge color="neutral" variant="soft" size="sm">{{ participantsCount }}</UBadge>
            </template>
          </UButton>
          <UButton icon="i-ph-phone-disconnect-bold" size="xl" color="error" @click="leaveCall" />
        </div>
      </section>

      <aside
        class="border-default bg-elevated/40 hidden min-h-0 flex-col rounded-md border lg:flex"
      >
        <div class="border-default flex items-center justify-between border-b px-4 py-3">
          <div>
            <div class="text-sm font-semibold">{{ roomTitle }}</div>
            <div class="text-muted text-xs">Канал @{{ roomUsername }}</div>
          </div>
          <UBadge color="neutral" variant="soft">{{ participantsCount }}</UBadge>
        </div>

        <div class="min-h-0 flex-1 overflow-auto">
          <Item no-hover no-cursor>
            <template #avatar>
              <UAvatar
                :src="userAvatar ? $storage(userAvatar) : undefined"
                :alt="userFullName"
                size="3xl"
                img-class="object-cover"
              />
            </template>

            <template #heading>
              {{ userFullName }}
            </template>

            <template #description>
              <span class="flex items-center gap-1.5">
                <span
                  class="size-1.5 rounded-full"
                  :class="getConnectionStatusClass(localConnectionStatus)"
                />
                {{ localIsSpeaking ? 'Говорите' : getConnectionStatusLabel(localConnectionStatus) }}
              </span>
            </template>

            <template #action>
              <div class="flex items-center gap-1.5">
                <UIcon class="text-primary" v-if="localIsSpeaking" name="i-ph-waveform-bold" />
                <UIcon
                  :name="microphoneEnabled ? 'i-ph-microphone-bold' : 'i-ph-microphone-slash-bold'"
                />
                <UIcon
                  :name="cameraEnabled ? 'i-ph-video-camera-bold' : 'i-ph-video-camera-slash-bold'"
                />
                <UIcon v-if="screenSharing" name="i-ph-monitor-arrow-up-bold" />
              </div>
            </template>
          </Item>

          <Item v-for="participant in remoteParticipants" :key="participant.id" no-hover no-cursor>
            <template #avatar>
              <UAvatar
                :src="participant.avatar ? $storage(participant.avatar) : undefined"
                :alt="participant.name"
                size="3xl"
                img-class="object-cover"
              />
            </template>

            <template #heading>
              {{ participant.name }}
            </template>

            <template #description>
              <span class="flex items-center gap-1.5">
                <span
                  class="size-1.5 rounded-full"
                  :class="getConnectionStatusClass(participant.connectionStatus)"
                />
                {{
                  participant.isSpeaking
                    ? 'Говорит'
                    : getConnectionStatusLabel(participant.connectionStatus)
                }}
              </span>
            </template>

            <template #action>
              <div class="flex items-center gap-1.5">
                <UIcon
                  class="text-primary"
                  v-if="participant.isSpeaking"
                  name="i-ph-waveform-bold"
                />
                <UIcon
                  :name="
                    participant.microphoneEnabled
                      ? 'i-ph-microphone-bold'
                      : 'i-ph-microphone-slash-bold'
                  "
                />
                <UIcon
                  :name="
                    participant.cameraEnabled
                      ? 'i-ph-video-camera-bold'
                      : 'i-ph-video-camera-slash-bold'
                  "
                />
                <UIcon v-if="participant.screenSharing" name="i-ph-monitor-arrow-up-bold" />
              </div>
            </template>
          </Item>
        </div>
      </aside>

      <USlideover
        v-model:open="participantsPanelOpen"
        side="right"
        title="Участники"
        :description="roomTitle"
      >
        <template #content>
          <div class="flex h-full min-h-0 flex-col">
            <div class="border-default flex items-center justify-between border-b px-4 py-3">
              <div>
                <div class="text-sm font-semibold">{{ roomTitle }}</div>
                <div class="text-muted text-xs">Канал @{{ roomUsername }}</div>
              </div>
              <div class="flex items-center gap-2">
                <UBadge color="neutral" variant="soft">{{ participantsCount }}</UBadge>
                <UButton
                  icon="i-ph-x-bold"
                  @click="participantsPanelOpen = false"
                  size="lg"
                  color="neutral"
                  variant="ghost"
                />
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-auto">
              <Item no-hover no-cursor>
                <template #avatar>
                  <UAvatar
                    :src="userAvatar ? $storage(userAvatar) : undefined"
                    :alt="userFullName"
                    size="3xl"
                    img-class="object-cover"
                  />
                </template>

                <template #heading>
                  {{ userFullName }}
                </template>

                <template #description>
                  <span class="flex items-center gap-1.5">
                    <span
                      class="size-1.5 rounded-full"
                      :class="getConnectionStatusClass(localConnectionStatus)"
                    />
                    {{
                      localIsSpeaking ? 'Говорите' : getConnectionStatusLabel(localConnectionStatus)
                    }}
                  </span>
                </template>

                <template #action>
                  <div class="flex items-center gap-1.5">
                    <UIcon class="text-primary" v-if="localIsSpeaking" name="i-ph-waveform-bold" />
                    <UIcon
                      :name="
                        microphoneEnabled ? 'i-ph-microphone-bold' : 'i-ph-microphone-slash-bold'
                      "
                    />
                    <UIcon
                      :name="
                        cameraEnabled ? 'i-ph-video-camera-bold' : 'i-ph-video-camera-slash-bold'
                      "
                    />
                    <UIcon v-if="screenSharing" name="i-ph-monitor-arrow-up-bold" />
                  </div>
                </template>
              </Item>

              <Item
                v-for="participant in remoteParticipants"
                :key="participant.id"
                no-hover
                no-cursor
              >
                <template #avatar>
                  <UAvatar
                    :src="participant.avatar ? $storage(participant.avatar) : undefined"
                    :alt="participant.name"
                    size="3xl"
                    img-class="object-cover"
                  />
                </template>

                <template #heading>
                  {{ participant.name }}
                </template>

                <template #description>
                  <span class="flex items-center gap-1.5">
                    <span
                      class="size-1.5 rounded-full"
                      :class="getConnectionStatusClass(participant.connectionStatus)"
                    />
                    {{
                      participant.isSpeaking
                        ? 'Говорит'
                        : getConnectionStatusLabel(participant.connectionStatus)
                    }}
                  </span>
                </template>

                <template #action>
                  <div class="flex items-center gap-1.5">
                    <UIcon
                      class="text-primary"
                      v-if="participant.isSpeaking"
                      name="i-ph-waveform-bold"
                    />
                    <UIcon
                      :name="
                        participant.microphoneEnabled
                          ? 'i-ph-microphone-bold'
                          : 'i-ph-microphone-slash-bold'
                      "
                    />
                    <UIcon
                      :name="
                        participant.cameraEnabled
                          ? 'i-ph-video-camera-bold'
                          : 'i-ph-video-camera-slash-bold'
                      "
                    />
                    <UIcon v-if="participant.screenSharing" name="i-ph-monitor-arrow-up-bold" />
                  </div>
                </template>
              </Item>
            </div>
          </div>
        </template>
      </USlideover>
    </main>

    <UModal
      v-model:open="leaveConfirmOpen"
      title="Выйти из звонка"
      description="Подтвердите выход из встречи"
    >
      <template #content>
        <div class="space-y-4 p-4">
          <div class="space-y-1">
            <div class="text-lg font-semibold">Выйти из звонка?</div>
            <div class="text-muted text-sm">
              Вы отключитесь от встречи и вернетесь к настройкам перед входом.
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Отмена"
              @click="leaveConfirmOpen = false"
            />
            <UButton
              color="error"
              label="Выйти"
              @click="confirmLeaveCall"
              icon="i-ph-phone-disconnect-bold"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
