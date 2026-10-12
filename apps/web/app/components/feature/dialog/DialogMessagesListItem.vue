<script setup lang="ts">
import {
  DialogMessagesListItemContextMenu,
  DialogPinnedMessagesListItemContextMenu,
} from '#components';
import type { ChatMessage } from '~/types';

const props = withDefaults(
  defineProps<{
    message: ChatMessage;
    contextMenu?: 'default' | 'pinned';
    mediaInteractive?: boolean;
    groupSectionStart?: boolean;
    groupSectionEnd?: boolean;
    showSenderName?: boolean;
    highlighted?: boolean;
    highlightFading?: boolean;
  }>(),
  {
    contextMenu: 'default',
    mediaInteractive: true,
    groupSectionStart: true,
    groupSectionEnd: true,
    showSenderName: true,
    highlighted: false,
    highlightFading: false,
  },
);

const emit = defineEmits<{
  open: [];
}>();

const messages = useMessagesStore();
const searchHighlightQuery = computed(() => messages.searchHighlightQuery);
const isOwn = computed(() => props.message.is_sender);
const isSystem = computed(() => !props.message.sender_id);
const mediaFiles = computed(() =>
  (props.message.attachments ?? []).filter((file) => file.type === 'media'),
);
const documentFiles = computed(() =>
  (props.message.attachments ?? []).filter((file) => file.type === 'file'),
);
const hasMediaFiles = computed(() => mediaFiles.value.length > 0);
const hasAttachments = computed(() => (props.message.attachments ?? []).length > 0);
const mediaSenderName = computed(
  () => props.message.sender?.name || (props.message.is_sender ? 'Вы' : null),
);
const replyTo = computed(() => props.message.reply_to ?? null);
const replyTitle = computed(() => {
  const message = replyTo.value;

  if (!message) {
    return '';
  }

  return message.is_sender ? 'Вы' : message.sender?.name || 'Сообщение';
});

const bubbleClass = computed(() => {
  if (isSystem.value) {
    return {};
  }

  if (isOwn.value) {
    return {
      'rounded-tr-xs': !props.groupSectionStart,
      'rounded-br-xs': !props.groupSectionEnd,
    };
  }

  return {
    'rounded-tl-xs': !props.groupSectionStart,
    'rounded-bl-xs': !props.groupSectionEnd,
  };
});

const senderNameVisible = computed(() => props.showSenderName && !isOwn.value && !isSystem.value);
const contextMenuComponent = computed(() =>
  props.contextMenu === 'pinned'
    ? DialogPinnedMessagesListItemContextMenu
    : DialogMessagesListItemContextMenu,
);

const openReplyTarget = () => {
  if (replyTo.value?.id) {
    void messages.loadAroundMessage(replyTo.value.id, true);
  }
};
</script>

<template>
  <div
    class="px-2"
    :class="[
      groupSectionStart ? 'pt-1' : 'pt-0.5',
      groupSectionEnd ? 'pb-1' : 'pb-0',
      highlighted ? 'bg-primary/10' : 'bg-transparent',
    ]"
    :data-message-id="message.id"
  >
    <div class="mx-6 flex justify-center" v-if="isSystem">
      <component :is="contextMenuComponent" :message="message" @open="emit('open')">
        <UBadge class="max-w-md text-center" color="neutral" variant="soft" size="lg">
          <DialogMessagesListItemText
            :message="message.message"
            :highlight-query="searchHighlightQuery"
          />
        </UBadge>
      </component>
    </div>
    <div class="flex min-w-0" v-else :class="[isOwn ? 'ml-10 justify-end' : 'mr-10 justify-start']">
      <component :is="contextMenuComponent" :message="message" @open="emit('open')">
        <div
          class="max-w-md min-w-0 rounded-md p-2"
          :class="[
            !!hasAttachments && 'w-full',
            isOwn ? 'bg-primary-200 dark:bg-primary-800' : 'bg-elevated',
            bubbleClass,
          ]"
        >
          <div class="text-primary" v-if="senderNameVisible">
            {{ message.sender?.name }}
          </div>
          <DialogTextareaReference
            class="mb-1"
            v-if="replyTo"
            :title="replyTitle"
            :message="replyTo.message"
            :attachments="replyTo.attachments"
            :closeable="false"
            :icon="null"
            clickable
            @open="openReplyTarget"
          />
          <DialogMessagesListItemMedia
            :files="mediaFiles"
            :sender-name="mediaSenderName"
            :sent-at="message.created_at"
            :has-text-above="senderNameVisible || Boolean(replyTo) || Boolean(message.message)"
            :media-interactive="mediaInteractive"
          />
          <DialogMessagesListItemText
            v-if="message.message"
            :message="message.message"
            :highlight-query="searchHighlightQuery"
          />

          <DialogMessagesListItemFiles :files="documentFiles" :own="isOwn" />
          <div class="text-toned flex items-center justify-end space-x-1 pt-1 text-xs">
            <!--            <UBadge :label="message.id" size="sm" class="py-0.5" variant="soft" />-->
            <UBadge class="py-0.5" v-if="message.is_pinned" size="sm" variant="soft">
              <UIcon class="size-3" name="i-ph-push-pin-bold" />
            </UBadge>
            <DialogMessagesListItemDate
              v-if="message.created_at"
              :created-at="message.created_at"
              :edited="message.is_edited"
            />
          </div>
        </div>
      </component>
    </div>
  </div>
</template>
