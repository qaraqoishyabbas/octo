<script setup lang="ts">
import type { Dialog } from '~/types';

const props = defineProps<{ item: Dialog }>();

const auth = useAuthStore();
const drafts = useMessagesDraftStore();
const usersOnline = useUsersOnlineStore();
const dialogTyping = useDialogTypingStore();
const linkTarget = computed(() => props.item.username || props.item.dialog_id);
const isSelfDialog = computed(() => Boolean(props.item.is_self));
const usernameText = computed(() =>
  props.item.username ? `@${props.item.username}` : 'был(-а) давно',
);
const typingText = computed(() => dialogTyping.getAudienceText(props.item));
const lastMessagePrefix = computed(() => {
  const message = props.item.message;

  if ((props.item.type !== 'G' && props.item.type !== 'D') || !message) {
    return '';
  }

  if (message.is_sender) {
    return 'Вы: ';
  }

  const senderName = message.sender?.name?.trim();

  return senderName ? `${senderName}: ` : '';
});
const draft = computed(() => {
  drafts.list;

  return drafts.getDraft({
    userId: auth.user?.id,
    dialogId: props.item.dialog_id,
  });
});
const { renderedTextPreview: draftText } = useText(() => draft.value.content);
const draftPreview = computed(
  () => draftText.value.trim() || (draft.value.replyMessage ? 'Ответить' : ''),
);
const hasDraft = computed(() => Boolean(draftPreview.value));
const onlineText = computed(() =>
  props.item.type === 'D' && !isSelfDialog.value && props.item.author_id
    ? usersOnline.getOnlineText(props.item.author_id, usernameText.value)
    : '',
);
const isOnline = computed(
  () => props.item.type === 'D' && usersOnline.isOnline(props.item.author_id),
);
watch(
  () => props.item.last_seen_at,
  (lastSeenAt) => {
    if (
      props.item.type === 'D' &&
      !isSelfDialog.value &&
      props.item.author_id &&
      lastSeenAt !== undefined
    ) {
      usersOnline.setBackendLastSeen(props.item.author_id, lastSeenAt);
    }
  },
  { immediate: true },
);
</script>

<template>
  <DialogsListItemContextMenu :item="item">
    <NuxtLink
      class="[&.router-link-active>div]:bg-primary/15"
      :id="`dialog-${item.dialog_id}`"
      :data-dialog-id="item.dialog_id"
      :data-dialog-target="linkTarget"
      :to="`/@${linkTarget}`"
    >
      <Item>
        <template v-slot:avatar>
          <UAvatar
            v-if="isSelfDialog"
            size="3xl"
            :alt="item.title"
            :src="$storage(item.avatar)"
            :class="{ 'rounded-[0.75rem]': item.type === 'G' || item.type === 'C' }"
          />
          <UChip v-else position="bottom-right" inset :show="isOnline" color="success">
            <UAvatar
              size="3xl"
              :alt="item.title"
              :src="$storage(item.avatar)"
              :class="{ 'rounded-[0.75rem]': item.type === 'G' || item.type === 'C' }"
            />
          </UChip>
        </template>
        <template v-slot:heading>{{ item.title }}</template>
        <template v-if="hasDraft || typingText || item.message || onlineText" v-slot:description>
          <template v-if="hasDraft">
            <span class="text-primary">Черновик: </span>
            {{ draftPreview }}
          </template>
          <template v-else-if="typingText">
            <span class="text-primary">{{ typingText }}</span>
          </template>
          <template v-else-if="item.message">
            <span class="text-primary" v-if="lastMessagePrefix">{{ lastMessagePrefix }}</span>
            <DialogsListItemText
              :message="item.message?.message"
              :attachments="item.message?.attachments"
            />
          </template>
          <template v-else>
            <span :class="{ 'text-primary': isOnline }">{{ onlineText }}</span>
          </template>
        </template>
        <template v-if="item.message" v-slot:loadingTop>
          <DialogsListItemDate :created-at="item.message.created_at" />
        </template>
        <template v-slot:loadingBottom>
          <UTooltip v-if="item.archived" arrow text="В архиве" :content="{ sideOffset: 1 }">
            <UBadge size="xs" variant="soft" color="neutral">
              <UIcon class="size-3" name="i-ph-archive-bold" />
            </UBadge>
          </UTooltip>
          <UTooltip v-if="item.muted" arrow text="Приглушенный диалог" :content="{ sideOffset: 1 }">
            <UBadge size="xs" variant="soft" color="neutral">
              <UIcon class="size-3" name="i-ph-bell-slash-bold" />
            </UBadge>
          </UTooltip>
          <UTooltip
            v-if="item.pinned"
            arrow
            text="Закрепленный диалог"
            :content="{ sideOffset: 1 }"
          >
            <UBadge size="xs" variant="soft" :color="item.muted ? 'neutral' : 'primary'">
              <UIcon class="size-3" name="i-ph-push-pin-bold" />
            </UBadge>
          </UTooltip>
          <UTooltip v-if="item.has_reminder" arrow text="Вас отметили" :content="{ sideOffset: 1 }">
            <UBadge size="xs" variant="soft" :color="item.muted ? 'neutral' : 'primary'">
              <UIcon class="size-3" name="i-ph-at-bold" />
            </UBadge>
          </UTooltip>
          <UTooltip
            v-if="(item.counter ?? 0) > 0"
            arrow
            text="Непрочитанные сообщения"
            :content="{ sideOffset: 1 }"
          >
            <UBadge
              size="md"
              variant="soft"
              :color="item.muted ? 'neutral' : 'primary'"
              :ui="{ base: 'py-0 px-1.5' }"
            >
              {{ item.counter }}
            </UBadge>
          </UTooltip>
        </template>
      </Item>
    </NuxtLink>
  </DialogsListItemContextMenu>
</template>
