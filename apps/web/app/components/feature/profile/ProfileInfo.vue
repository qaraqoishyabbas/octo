<script setup lang="ts">
import type { Dialog, MessageAttachment } from '~/types';
import { copyToClipboard } from '~/utils/copy-to-clipboard';

const props = defineProps<{
  profile: Dialog;
}>();

const toast = useToast();
const dayjs = useDayjs();
const usersOnline = useUsersOnlineStore();
const { withCount } = useInflection();
const isAvatarViewerOpen = ref(false);
const avatarViewerIndex = ref(0);

const currentDialogType = computed(() => String(props.profile?.type ?? '').toUpperCase());
const isDirectDialog = computed(() => currentDialogType.value === 'D');
const isSelfDialog = computed(() => Boolean(props.profile?.is_self));
const showDirectDetails = computed(() => isDirectDialog.value && !isSelfDialog.value);
const onlineText = computed(() =>
  usersOnline.getOnlineText(props.profile?.author_id, 'был(-а) давно'),
);
const isOnline = computed(() => usersOnline.isOnline(props.profile?.author_id));
const avatarSrc = computed(() => (props.profile.avatar ? $storage(props.profile.avatar) : ''));
const avatarFileName = computed(
  () =>
    String(props.profile.avatar ?? '')
      .split('/')
      .pop() || 'Фото профиля',
);
const avatarViewerItems = computed<MessageAttachment[]>(() =>
  props.profile.avatar
    ? [
        {
          id: `profile-avatar-${props.profile.id}`,
          type: 'media',
          mime_type: 'image/*',
          original_name: avatarFileName.value,
          path: props.profile.avatar,
          size: 0,
        },
      ]
    : [],
);

const dialogAudienceText = computed(() => {
  const count = Number(props.profile?.users_count ?? 0);

  if (currentDialogType.value === 'G') {
    return withCount(count, ['участник', 'участника', 'участников']);
  }

  if (currentDialogType.value === 'C') {
    return withCount(count, ['подписчик', 'подписчика', 'подписчиков']);
  }

  return '';
});

const formattedBirthDate = computed(() => {
  if (!props.profile?.birth_date) {
    return '';
  }

  return dayjs(props.profile.birth_date).format('D MMMM YYYY');
});

const userInfoItems = computed(() => [
  {
    value: props.profile?.bio,
    label: 'О себе',
  },
  {
    value: props.profile?.username ? `@${props.profile.username}` : '',
    copyValue: `@${props.profile.username}`,
    label: 'Логин',
  },
  {
    value: props.profile?.email,
    copyValue: props.profile?.email,
    label: 'Email',
  },
  {
    value: formattedBirthDate.value,
    label: 'Дата рождения',
  },
]);

const visibleUserInfoItems = computed(() => userInfoItems.value.filter((item) => item.value));

const openAvatarViewer = () => {
  if (!avatarSrc.value) {
    return;
  }

  isAvatarViewerOpen.value = true;
};

const copyProfileInfo = async (value?: string | null) => {
  const text = String(value ?? '').trim();

  if (!text) {
    return;
  }

  try {
    await copyToClipboard(text);
    toast.add({
      title: 'Скопировано',
      color: 'success',
      icon: 'i-ph-check-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  } catch {
    toast.add({
      title: 'Не удалось скопировать',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

watch(
  () => [props.profile?.author_id, props.profile?.last_seen_at, currentDialogType.value],
  ([userId, lastSeenAt]) => {
    if (showDirectDetails.value && lastSeenAt !== undefined) {
      usersOnline.setBackendLastSeen(userId, lastSeenAt);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-4 p-4">
    <div class="flex flex-col items-center space-y-4">
      <button
        class="rounded-full outline-none"
        type="button"
        :class="[
          { 'rounded-[0.75rem]': profile.type === 'G' || profile.type === 'C' },
          avatarSrc ? 'cursor-pointer' : 'cursor-default',
        ]"
        :disabled="!avatarSrc"
        @click="openAvatarViewer"
      >
        <UAvatar
          class="size-28 rounded-full text-4xl uppercase"
          :src="avatarSrc"
          :alt="profile.title"
          img-class="object-cover"
          :class="{ 'rounded-[0.75rem]': profile.type === 'G' || profile.type === 'C' }"
        />
      </button>
      <div>
        <div
          class="px-4 text-center text-lg/5 font-semibold break-words wrap-anywhere whitespace-pre-line"
        >
          {{ profile.title }}
        </div>
        <div
          class="px-4 text-center text-sm"
          v-if="showDirectDetails"
          :class="isOnline ? 'text-primary' : 'text-muted'"
        >
          {{ onlineText }}
        </div>
        <div class="text-muted px-4 text-center text-sm" v-if="dialogAudienceText">
          {{ dialogAudienceText }}
        </div>
      </div>
    </div>
    <PhotoViewer
      v-model:open="isAvatarViewerOpen"
      v-model:index="avatarViewerIndex"
      :items="avatarViewerItems"
      :downloadable="false"
      :rotatable="false"
      title-mode="file"
      :show-file-subtitle="false"
    />
    <div class="bg-elevated rounded-md" v-if="!isSelfDialog && profile.description">
      <div class="flex w-full flex-col justify-center space-y-1 px-3 py-2">
        <div class="text-sm break-words wrap-anywhere whitespace-pre-line">
          {{ profile.description }}
        </div>
        <div class="text-muted text-xs">Описание</div>
      </div>
    </div>
    <div class="bg-elevated rounded-md" v-if="showDirectDetails && visibleUserInfoItems.length > 0">
      <div v-for="(item, index) in visibleUserInfoItems" :key="item.label">
        <USeparator v-if="index > 0" />
        <div class="flex w-full items-center gap-2 px-3 py-2">
          <div class="flex min-w-0 flex-1 flex-col justify-center space-y-1">
            <div class="text-muted text-xs">{{ item.label }}</div>
            <div class="text-sm break-words wrap-anywhere whitespace-pre-line">
              {{ item.value }}
            </div>
          </div>
          <UButton
            v-if="item.copyValue"
            icon="i-ph-copy-bold"
            size="xl"
            color="neutral"
            variant="ghost"
            :aria-label="`Скопировать ${item.label}`"
            @click="copyProfileInfo(item.copyValue)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
