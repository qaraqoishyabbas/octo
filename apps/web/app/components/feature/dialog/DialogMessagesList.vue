<script setup lang="ts">
import type { ChatMessage } from '~/types';
import { useMessageListHistory } from '~/composables/useMessageListHistory';
import { useMessageListObservers } from '~/composables/useMessageListObservers';
import { useMessageListScroll } from '~/composables/useMessageListScroll';
import { groupDialogMessages } from '~/utils/dialog-message-groups';

const messages = useMessagesStore();
const dialog = useDialogStore();
const dayjs = useDayjs();
const container = inject('dialogScrollContainer', ref<HTMLElement | null>(null));
const olderAnchor = ref<HTMLElement | null>(null);
const newerAnchor = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);

const getMessageDayKey = (message: ChatMessage) => {
  const parsed = dayjs(message.created_at);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : 'unknown';
};

const formatDateGroupLabel = (dayKey: string) => {
  if (dayKey === 'unknown') {
    return '';
  }

  const parsed = dayjs(dayKey);
  const now = dayjs();

  if (parsed.isSame(now, 'day')) {
    return 'Сегодня';
  }

  if (parsed.isSame(now.subtract(1, 'day'), 'day')) {
    return 'Вчера';
  }

  return parsed.isSame(now, 'year') ? parsed.format('D MMMM') : parsed.format('D MMMM YYYY');
};

const groupedMessages = computed(() =>
  groupDialogMessages(messages.list, {
    unreadBoundaryMessageId: messages.unreadBoundaryMessageId,
    getDayKey: getMessageDayKey,
    formatDayLabel: formatDateGroupLabel,
  }),
);

const showSenderNames = computed(() => dialog.current?.type !== 'D');

const observerRootMargin = computed(() => {
  const viewport = container.value?.getBoundingClientRect();
  if (!container.value || !viewport) {
    return '0px';
  }

  const applicationBarBottom = container.value
    .querySelector<HTMLElement>('[data-dialog-application-bar]')
    ?.getBoundingClientRect().bottom;
  const textareaTop = container.value
    .querySelector<HTMLElement>('[data-dialog-textarea]')
    ?.getBoundingClientRect().top;
  const topInset = Math.max(0, (applicationBarBottom ?? viewport.top) - viewport.top);
  const bottomInset = Math.max(0, viewport.bottom - (textareaTop ?? viewport.bottom));

  return `-${Math.ceil(topInset)}px 0px -${Math.ceil(bottomInset)}px 0px`;
});

let scrollController: ReturnType<typeof useMessageListScroll> | null = null;
let historyController: ReturnType<typeof useMessageListHistory> | null = null;

const observers = useMessageListObservers({
  container,
  olderSentinel: olderAnchor,
  newerSentinel: newerAnchor,
  messages: computed(() => messages.list),
  lastReadAt: computed(() => dialog.current?.last_read_at),
  rootMargin: observerRootMargin,
  resizeElements: () => [
    content.value,
    container.value?.querySelector<HTMLElement>('[data-dialog-application-bar]'),
    container.value?.querySelector<HTMLElement>('[data-dialog-textarea]'),
  ],
  onLoadOlder: () => historyController?.loadOlder(),
  onLoadNewer: () => historyController?.loadNewer(),
  onReadUntil: (messageId) => messages.markReadUntil(messageId),
  onResize: () => scrollController?.handleResize(),
});

const scroll = useMessageListScroll({
  container,
  content,
  onQueueReadCheck: observers.queueReadCheck,
});
scrollController = scroll;

const history = useMessageListHistory({ messages, scroll });
historyController = history;

const getMessageListLayoutState = () =>
  messages.list.map((message) => ({
    id: message.id,
    senderId: message.sender_id,
    senderName: message.sender?.name,
    createdAt: message.created_at,
    updatedAt: message.updated_at,
    text: message.message,
    edited: message.is_edited,
    pinned: message.is_pinned,
    attachments: (message.attachments ?? [])
      .map((attachment) =>
        [
          attachment.id,
          attachment.path,
          attachment.thumbnail_path,
          attachment.width,
          attachment.height,
          attachment.duration,
          attachment.size,
        ].join(':'),
      )
      .join('|'),
    reply: message.reply_to
      ? [message.reply_to.id, message.reply_to.updated_at, message.reply_to.message].join(':')
      : '',
  }));

onMounted(async () => {
  await nextTick();
  observers.reconnect();

  if (messages.scrollIntent) {
    await history.reconcileCurrentWindow([]);
  } else {
    scroll.scrollToBottom('auto');
  }
});

watch(
  getMessageListLayoutState,
  async (_nextState, previousState) => {
    await history.reconcileCurrentWindow((previousState ?? []).map(({ id }) => id));
    await nextTick();
    observers.reconnect();
  },
  { flush: 'pre' },
);

watch(
  () => messages.scrollIntent?.messageId,
  async (messageId) => {
    if (!messageId) {
      return;
    }

    await history.reconcileCurrentWindow(messages.list.map(({ id }) => id));
    observers.reconnect();
  },
);
</script>

<template>
  <div class="relative w-full">
    <div class="mx-auto w-full overflow-x-hidden" ref="content">
      <div ref="olderAnchor">
        <div class="mt-1 flex items-center justify-center" v-if="messages.olderLoading">
          <UIcon class="animate-spin" name="i-ph-spinner-gap" />
        </div>
        <div class="mt-1 flex items-center justify-center" v-else-if="messages.olderError">
          <UButton
            color="neutral"
            variant="soft"
            size="xs"
            icon="i-ph-arrow-clockwise-bold"
            label="Повторить"
            @click="history.retryOlder"
          />
        </div>
      </div>

      <template v-for="item in groupedMessages" :key="item.key">
        <div class="my-1 flex justify-center" v-if="item.type === 'date' && item.label">
          <UBadge :label="item.label" color="neutral" variant="soft" />
        </div>

        <div class="my-2 flex justify-center" v-else-if="item.type === 'unread'">
          <UBadge :label="item.label" color="primary" variant="soft" />
        </div>

        <DialogMessagesListItem
          v-else-if="item.type === 'message'"
          :message="item.message"
          :group-section-start="item.groupSectionStart"
          :group-section-end="item.groupSectionEnd"
          :show-sender-name="showSenderNames && item.groupSectionStart"
          :highlighted="scroll.highlightedMessageId.value === item.message.id"
        />
      </template>

      <div ref="newerAnchor">
        <div class="mb-1 flex items-center justify-center" v-if="messages.newerLoading">
          <UIcon class="animate-spin" name="i-ph-spinner-gap" />
        </div>
        <div class="mb-1 flex items-center justify-center" v-else-if="messages.newerError">
          <UButton
            color="neutral"
            variant="soft"
            size="xs"
            icon="i-ph-arrow-clockwise-bold"
            label="Повторить"
            @click="history.retryNewer"
          />
        </div>
      </div>
    </div>
  </div>
</template>
