<script setup lang="ts">
// Статические данные UI-мокапа.
type PreviewConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
type PreviewParticipant = {
  id: string;
  name: string;
  avatar: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  screenSharing: boolean;
  hasVideo: boolean;
  connectionStatus: PreviewConnectionStatus;
  isSpeaking: boolean;
  isLocal: boolean;
};

const roomUsername = 'demo';

const roomTitle = 'Командная встреча';

const userFullName = 'Вы';

const userAvatar = '';

const cameraEnabled = true;

const microphoneEnabled = true;

const screenSharing = false;

const hasVideo = false;

const mediaState = 'ready';

const checkingLabel = 'Проверяем устройства...';

const errorMessage = '';

const participantsPanelOpen = false;

const leaveConfirmOpen = false;

const localIsSpeaking = false;

const localConnectionStatus: PreviewConnectionStatus = 'connected';

const connectionStatusConfig = {
  connecting: { label: 'Подключается', class: 'bg-sky-500' },
  connected: { label: 'Подключен', class: 'bg-emerald-500' },
  reconnecting: { label: 'Переподключение', class: 'bg-amber-500' },
  disconnected: { label: 'Отключен', class: 'bg-neutral-500' },
};

const localParticipant: PreviewParticipant = {
  id: 'local',
  name: userFullName,
  avatar: '',
  cameraEnabled,
  microphoneEnabled,
  screenSharing: false,
  hasVideo: false,
  connectionStatus: 'connected',
  isSpeaking: false,
  isLocal: true,
};

const remoteParticipants: PreviewParticipant[] = [
  {
    id: 'preview-1',
    name: 'Алия',
    avatar: '',
    cameraEnabled: false,
    microphoneEnabled: true,
    screenSharing: false,
    hasVideo: false,
    connectionStatus: 'connected',
    isSpeaking: true,
    isLocal: false,
  },
  {
    id: 'preview-2',
    name: 'Данияр',
    avatar: '',
    cameraEnabled: false,
    microphoneEnabled: false,
    screenSharing: false,
    hasVideo: false,
    connectionStatus: 'connected',
    isSpeaking: false,
    isLocal: false,
  },
  {
    id: 'preview-3',
    name: 'Мария',
    avatar: '',
    cameraEnabled: false,
    microphoneEnabled: true,
    screenSharing: false,
    hasVideo: false,
    connectionStatus: 'reconnecting',
    isSpeaking: false,
    isLocal: false,
  },
];

const mainParticipant: PreviewParticipant | null = null;

const currentParticipantPage = [localParticipant, ...remoteParticipants];

const participantPages = [currentParticipantPage];

const participantsCount = currentParticipantPage.length;

const participantsCarouselPage = 0;

const hasParticipantPages = false;

const isSingleParticipantGrid = false;

const thumbnailGridClass = 'grid-cols-2';
</script>

<template>
  <div class="bg-default text-default flex h-dvh min-h-dvh flex-col overflow-hidden">
    <main class="grid h-full min-h-0 w-full flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section class="flex min-h-0 flex-col gap-2 overflow-hidden">
        <div
          class="relative grid min-h-0 flex-1 rounded-xs ring-0 transition-shadow"
          v-if="mainParticipant"
          :key="`main-${mainParticipant.id}`"
          :class="
            mainParticipant.isSpeaking
              ? 'ring-primary ring-2 ring-offset-2 ring-offset-(--ui-bg)'
              : ''
          "
        >
          <div
            class="relative grid min-h-0 place-items-center overflow-hidden rounded-xs bg-neutral-950"
          >
            <div
              class="flex flex-col items-center gap-3 text-white"
              v-if="!mainParticipant.hasVideo"
            >
              <UAvatar
                class="size-24 text-3xl"
                :src="mainParticipant.avatar || undefined"
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
              <div class="text-sm">Предпросмотр камеры</div>
            </div>
          </div>
        </div>

        <div
          class="grid gap-2"
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
              <div class="flex flex-col items-center gap-3 text-white" v-if="!participant.hasVideo">
                <UAvatar
                  :src="participant.avatar || undefined"
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
                <div class="text-sm">Предпросмотр камеры</div>
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
          />
        </div>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-ph-warning-circle-bold"
          :description="errorMessage"
        />

        <div class="flex items-center justify-center gap-2">
          <UButton
            :icon="microphoneEnabled ? 'i-ph-microphone-bold' : 'i-ph-microphone-slash-bold'"
            size="xl"
            color="neutral"
            :variant="microphoneEnabled ? 'soft' : 'solid'"
          />
          <UButton
            :icon="cameraEnabled ? 'i-ph-video-camera-bold' : 'i-ph-video-camera-slash-bold'"
            size="xl"
            color="neutral"
            :variant="cameraEnabled ? 'soft' : 'solid'"
          />
          <UButton
            :icon="screenSharing ? 'i-ph-monitor-arrow-up-fill' : 'i-ph-monitor-arrow-up-bold'"
            size="xl"
            color="neutral"
            :variant="screenSharing ? 'solid' : 'soft'"
          />
          <UButton
            class="lg:hidden"
            icon="i-ph-users-bold"
            size="xl"
            color="neutral"
            variant="soft"
          >
            <template #trailing>
              <UBadge color="neutral" variant="soft" size="sm">{{ participantsCount }}</UBadge>
            </template>
          </UButton>
          <UButton icon="i-ph-phone-disconnect-bold" size="xl" color="error" />
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
                :src="userAvatar || undefined"
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
                  :class="connectionStatusConfig[localConnectionStatus].class"
                />
                {{
                  localIsSpeaking ? 'Говорите' : connectionStatusConfig[localConnectionStatus].label
                }}
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
                :src="participant.avatar || undefined"
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
                  :class="connectionStatusConfig[participant.connectionStatus].class"
                />
                {{
                  participant.isSpeaking
                    ? 'Говорит'
                    : connectionStatusConfig[participant.connectionStatus].label
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
        :open="participantsPanelOpen"
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
                <UButton icon="i-ph-x-bold" size="lg" color="neutral" variant="ghost" />
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-auto">
              <Item no-hover no-cursor>
                <template #avatar>
                  <UAvatar
                    :src="userAvatar || undefined"
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
                      :class="connectionStatusConfig[localConnectionStatus].class"
                    />
                    {{
                      localIsSpeaking
                        ? 'Говорите'
                        : connectionStatusConfig[localConnectionStatus].label
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
                    :src="participant.avatar || undefined"
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
                      :class="connectionStatusConfig[participant.connectionStatus].class"
                    />
                    {{
                      participant.isSpeaking
                        ? 'Говорит'
                        : connectionStatusConfig[participant.connectionStatus].label
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
      :open="leaveConfirmOpen"
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
            <UButton color="neutral" variant="ghost" label="Отмена" />
            <UButton color="error" label="Выйти" icon="i-ph-phone-disconnect-bold" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
