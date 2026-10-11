<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core';
import { DialogTextareaUploadModal } from '#components';
import type EmojiPicker from '~/components/shared/EmojiPicker.vue';
import type DialogTextEditor from './DialogTextEditor.vue';

type UploadType = 'media' | 'file';
type DraftScope = {
  userId?: string | null;
  dialogId?: string | null;
};

const dialog = useDialogStore();
const dialogs = useDialogsStore();
const messages = useMessagesStore();
const auth = useAuthStore();
const drafts = useMessagesDraftStore();
const members = useDialogMembersStore();
const typingStore = useDialogTypingStore();
const overlay = useOverlay();
const toast = useToast();
const config = useRuntimeConfig();
const sendOnEnter = useLocalStorage('nuxt-send-on-enter', true);
const silentMessage = ref(false);
const messageHtml = ref('');
const messageText = ref('');
const editorRef = ref<InstanceType<typeof DialogTextEditor> | null>(null);
const emojiPickerRef = ref<InstanceType<typeof EmojiPicker> | null>(null);
const emojiPanel = ref<HTMLElement | null>(null);
const insertEmoji = (emoji: string, focus = true) => editorRef.value?.insertText(emoji, focus);
watch(
  () => dialog.current?.dialog_id,
  () => emojiPickerRef.value?.close(),
);
const showMentionSuggestions = computed(() => editorRef.value?.showMentionSuggestions ?? false);
const mentionSuggestionItems = computed(() => editorRef.value?.mentionSuggestionItems ?? []);
const selectedMentionId = computed(() => editorRef.value?.selectedMentionId);
const selectMentionById = (id?: string) => editorRef.value?.selectMentionById(id);
const isRestoringDraft = ref(false);
const notificationLoading = ref(false);
const isSubscribing = computed(() =>
  dialogs.joiningDialogIds.includes(dialog.current?.dialog_id ?? ''),
);
const dragDepth = ref(0);
const activeUploadDropZone = ref<'files' | 'media'>('files');
const activeDraftScope = ref<DraftScope>({});
const maxUploadFiles = Number(config.public.uploadMessageMaxFiles || 10);
const maxUploadSizeMb = Number(config.public.uploadMessageMaxMb || 100);
const maxUploadSize = maxUploadSizeMb * 1024 * 1024;
const permissions = useDialogPermissions();
const extensionMimeTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
};

const canWriteMessage = computed(() => permissions.canSendMessages.value);
const isDialogMember = computed(() => Boolean(dialog.current?.role));
const editingMessage = computed(() => messages.editingMessage);
const replyMessage = computed(() => messages.replyMessage);
const isEditingMessage = computed(() => Boolean(editingMessage.value));
const editingMessageSaving = computed(() => {
  const messageId = editingMessage.value?.id;

  return messageId ? messages.editingMessageIds.includes(messageId) : false;
});
const editingMessageHasAttachments = computed(
  () => (editingMessage.value?.attachments ?? []).length > 0,
);
const editingMessageChanged = computed(
  () => messageHtml.value.trim() !== String(editingMessage.value?.message ?? '').trim(),
);
const hasMessage = computed(() => messageText.value.trim().length > 0);
const canSubmit = computed(() => {
  if (!canWriteMessage.value || !dialog.current) {
    return false;
  }

  if (isEditingMessage.value) {
    return (
      editingMessageChanged.value &&
      !editingMessageSaving.value &&
      (messageText.value.trim().length > 0 || editingMessageHasAttachments.value)
    );
  }

  return hasMessage.value && !messages.sending;
});
const isDraggingUploads = computed(() => dragDepth.value > 0);
const notificationButtonLabel = computed(() =>
  dialog.current?.muted ? 'Включить уведомления' : 'Выключить уведомления',
);
const draftScope = computed(() => ({
  userId: auth.user?.id,
  dialogId: dialog.current?.dialog_id,
}));
const canMentionMembers = computed(
  () =>
    canWriteMessage.value &&
    ['G', 'C'].includes(String(dialog.current?.type ?? '')) &&
    dialog.current?.can_view_members !== false,
);

const subscribe = async () => {
  const current = dialog.current;

  if (!current || current.type !== 'C' || current.role || isSubscribing.value) {
    return;
  }

  try {
    const response = await dialogs.join(current.dialog_id);

    if (!response?.ok) {
      throw new Error('Channel subscription failed');
    }

    await Promise.all([
      dialog.fetchData(String(current.username || current.dialog_id)),
      dialogs.refreshById(response.dialog_id),
    ]);
  } catch {
    toast.add({
      title: 'Не удалось подписаться на канал',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

const ensureMembersLoaded = () => {
  const current = dialog.current;

  if (!current || !canMentionMembers.value) {
    return;
  }

  void members.fetchAll(String(current.username || current.dialog_id));
};

const sendTypingSignal = async (
  typing = true,
  dialogId = dialog.current?.dialog_id,
  force = false,
) => {
  const safeDialogId = String(dialogId ?? '').trim();
  const currentDialogId = String(dialog.current?.dialog_id ?? '').trim();
  const isCurrentChannel =
    String(dialog.current?.type ?? '').toUpperCase() === 'C' && safeDialogId === currentDialogId;

  if (
    !safeDialogId ||
    !auth.token ||
    !isDialogMember.value ||
    !canWriteMessage.value ||
    isCurrentChannel
  ) {
    return;
  }

  await typingStore.sendSignal(safeDialogId, typing, force);
};

const stopTypingSignal = (dialogId = typingStore.lastTypingDialogId) => {
  if (!dialogId) {
    return;
  }

  void sendTypingSignal(false, dialogId, true);
};

const formatUploadSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};
const maxUploadSizeLabel = computed(() => formatUploadSize(maxUploadSize));

const showOversizedFilesToast = (files: File[]) => {
  if (files.length === 0) {
    return;
  }

  const firstFile = files[0];
  const hasMore = files.length > 1;

  toast.add({
    title: hasMore ? `Не удалось добавить ${files.length} файла` : 'Файл слишком большой',
    description: hasMore
      ? `Максимальный размер одного файла: ${maxUploadSizeLabel.value}.`
      : `${firstFile.name}: ${formatUploadSize(firstFile.size)}. Максимум: ${maxUploadSizeLabel.value}.`,
    color: 'error',
    icon: 'i-ph-warning-circle-fill',
    progress: false,
    duration: 3200,
  });
};

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const mimeOf = (file: File) => {
  const type = file.type;

  if (type && type !== 'application/octet-stream') {
    return type;
  }

  return extensionMimeTypes[extensionOf(file.name)] ?? type;
};
const isMediaFile = (file: File) => {
  const mimeType = mimeOf(file);

  return mimeType.startsWith('image/') || mimeType.startsWith('video/');
};

const showUploadCountLimitToast = (skippedCount = 0) => {
  toast.add({
    title: 'Вы выбрали слишком много файлов',
    description:
      skippedCount > 0
        ? `За один раз можно отправить до ${maxUploadFiles} файлов. Лишние файлы не добавлены: ${skippedCount}.`
        : `За один раз можно отправить до ${maxUploadFiles} файлов.`,
    color: 'error',
    icon: 'i-ph-info-bold',
    progress: false,
    duration: 3600,
    close: false,
  });
};

const selectUploads = (files: FileList | File[], type: UploadType = 'media') => {
  const selectedFiles = Array.from(files);
  const oversizedFiles = selectedFiles.filter((file) => file.size > maxUploadSize);
  const validFiles = selectedFiles.filter((file) => file.size <= maxUploadSize);

  if (selectedFiles.length === 0) {
    return;
  }

  showOversizedFilesToast(oversizedFiles);

  if (validFiles.length === 0) {
    return;
  }

  const modalFiles = validFiles.slice(0, maxUploadFiles);

  if (validFiles.length > maxUploadFiles) {
    showUploadCountLimitToast(validFiles.length - modalFiles.length);
  }

  const initialMessageHtml = messageHtml.value;
  const initialMessageText = messageText.value;
  editorRef.value?.clearContent(false);
  editorRef.value?.closeMentionSuggestions();
  messageHtml.value = '';
  messageText.value = '';

  overlay
    .create(DialogTextareaUploadModal, {
      props: {
        files: modalFiles,
        uploadType: type,
        initialMessageHtml,
        initialMessageText,
        onDraftReturn: (draft: { html: string; text: string }) => {
          messageHtml.value = draft.html;
          messageText.value = draft.text;
          editorRef.value?.setContent(draft.html, false);
        },
      },
    })
    .open();
};

const onPaste = (event: ClipboardEvent) => {
  if (
    !canWriteMessage.value ||
    messages.sending ||
    isEditingMessage.value ||
    overlay.overlays.some((item) => item.isOpen && item.component === DialogTextareaUploadModal) ||
    event.defaultPrevented
  ) {
    return;
  }

  const clipboard = event.clipboardData;
  if (!clipboard) {
    return;
  }

  const files = Array.from(clipboard.files);
  if (files.length === 0) {
    for (const item of Array.from(clipboard.items)) {
      const file = item.kind === 'file' ? item.getAsFile() : null;
      if (file) files.push(file);
    }
  }
  if (files.length === 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  selectUploads(files, files.every(isMediaFile) ? 'media' : 'file');
};

const getUploadDropZone = (event: DragEvent) => {
  return event.clientY < window.innerHeight / 2 ? 'files' : 'media';
};

const addDroppedUploads = (files: FileList | File[], zone: 'files' | 'media') => {
  const selectedFiles = Array.from(files);
  const matchingFiles = zone === 'media' ? selectedFiles.filter(isMediaFile) : selectedFiles;

  if (matchingFiles.length === 0) {
    toast.add({
      title: zone === 'media' ? 'Перетащите фото или видео' : 'Перетащите документ или файл',
      color: 'neutral',
      icon: 'i-ph-info-bold',
      progress: false,
      duration: 1800,
      close: false,
    });
    return;
  }

  if (zone === 'media') {
    selectUploads(matchingFiles);
    return;
  }

  selectUploads(matchingFiles, 'file');
};

const hasDraggedFiles = (event: DragEvent) => {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
};

const onDragEnter = (event: DragEvent) => {
  if (!canWriteMessage.value || !hasDraggedFiles(event)) {
    return;
  }

  event.preventDefault();
  dragDepth.value += 1;
  activeUploadDropZone.value = getUploadDropZone(event);
};

const onDragOver = (event: DragEvent) => {
  if (!canWriteMessage.value || !hasDraggedFiles(event)) {
    return;
  }

  event.preventDefault();
  activeUploadDropZone.value = getUploadDropZone(event);
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
};

const onDragLeave = (event: DragEvent) => {
  if (!canWriteMessage.value || !hasDraggedFiles(event)) {
    return;
  }

  event.preventDefault();
  dragDepth.value = Math.max(0, dragDepth.value - 1);
};

const onDrop = (event: DragEvent) => {
  if (!canWriteMessage.value || !hasDraggedFiles(event)) {
    return;
  }

  event.preventDefault();
  const zone = getUploadDropZone(event);
  dragDepth.value = 0;
  activeUploadDropZone.value = zone;

  if (event.dataTransfer?.files?.length) {
    addDroppedUploads(event.dataTransfer.files, zone);
  }
};

const preventWindowFileDrop = (event: DragEvent) => {
  if (!canWriteMessage.value || !hasDraggedFiles(event)) {
    return;
  }

  event.preventDefault();
  activeUploadDropZone.value = getUploadDropZone(event);
};

const onWindowDragEnter = (event: DragEvent) => {
  if (!canWriteMessage.value || !hasDraggedFiles(event)) {
    return;
  }

  dragDepth.value += 1;
  activeUploadDropZone.value = getUploadDropZone(event);
};

const onWindowDragLeave = (event: DragEvent) => {
  if (!canWriteMessage.value || !hasDraggedFiles(event)) {
    return;
  }

  const leftWindow =
    event.clientX <= 0 ||
    event.clientY <= 0 ||
    event.clientX >= window.innerWidth ||
    event.clientY >= window.innerHeight;

  if (leftWindow) {
    dragDepth.value = 0;
  }
};

const onWindowDrop = (event: DragEvent) => {
  if (!canWriteMessage.value || !hasDraggedFiles(event)) {
    return;
  }

  event.preventDefault();
  const zone = getUploadDropZone(event);
  dragDepth.value = 0;
  activeUploadDropZone.value = zone;

  if (event.dataTransfer?.files?.length) {
    addDroppedUploads(event.dataTransfer.files, zone);
  }
};

const toggleNotifications = async () => {
  if (!dialog.current?.dialog_id || notificationLoading.value) {
    return;
  }

  notificationLoading.value = true;
  try {
    const response = await dialogs.mute(dialog.current.dialog_id);

    if (typeof response?.muted === 'boolean') {
      dialog.current.muted = response.muted;
    }
  } finally {
    notificationLoading.value = false;
  }
};

const saveDraft = (scope: DraftScope = draftScope.value) => {
  if (!canWriteMessage.value || isEditingMessage.value) {
    return;
  }

  if (!scope.userId || !scope.dialogId) {
    return;
  }

  if (!messageText.value.trim() && !replyMessage.value) {
    drafts.remove(scope);
    return;
  }

  drafts.set({
    ...scope,
    content: messageHtml.value,
    replyMessage: replyMessage.value,
  });
};

const focusEditor = () => {
  if (!canWriteMessage.value) {
    return;
  }

  editorRef.value?.focusEnd();
};

const restoreDraft = (html: string) => {
  isRestoringDraft.value = true;
  editorRef.value?.setContent(html, false);
  isRestoringDraft.value = false;
};

const loadDraft = async () => {
  if (isEditingMessage.value) {
    return;
  }

  if (
    !canWriteMessage.value ||
    !editorRef.value ||
    !draftScope.value.userId ||
    !draftScope.value.dialogId
  ) {
    editorRef.value?.clearContent(false);
    messageHtml.value = '';
    messageText.value = '';
    messages.restoreReplyDraft(null);
    return;
  }

  saveDraft(activeDraftScope.value);
  activeDraftScope.value = { ...draftScope.value };
  drafts.loadUser(draftScope.value.userId);

  const draft = drafts.getDraft(draftScope.value);

  isRestoringDraft.value = true;
  messages.restoreReplyDraft(draft.replyMessage);
  editorRef.value.setContent(draft.content, false);
  await nextTick();
  isRestoringDraft.value = false;
};

const send = async () => {
  if (!canSubmit.value) {
    return;
  }

  if (editingMessage.value) {
    const messageId = editingMessage.value.id;
    const text = messageText.value.trim() ? messageHtml.value.trim() : '';

    try {
      const updated = await messages.update(messageId, text);

      toast.add({
        title: updated ? 'Сообщение изменено' : 'Не удалось изменить сообщение',
        color: updated ? 'success' : 'error',
        icon: updated ? 'i-ph-check-circle-fill' : 'i-ph-warning-circle-fill',
        progress: false,
        duration: 1800,
        close: false,
      });

      if (updated) {
        editorRef.value?.clearContent(true);
        editorRef.value?.closeMentionSuggestions();
        await loadDraft();
      }
    } finally {
      await nextTick();
      focusEditor();
    }

    return;
  }

  const text = messageText.value.trim() ? messageHtml.value.trim() : '';
  const sentScope = { ...draftScope.value };
  const sentSilent = silentMessage.value;
  stopTypingSignal(dialog.current?.dialog_id);
  messageHtml.value = '';
  messageText.value = '';
  silentMessage.value = false;
  editorRef.value?.clearContent(true);
  editorRef.value?.closeMentionSuggestions();
  drafts.remove(sentScope);

  const restoreFailedMessage = () => {
    if (
      draftScope.value.userId !== sentScope.userId ||
      draftScope.value.dialogId !== sentScope.dialogId
    ) {
      const oldDialogDraft = drafts.getDraft(sentScope);
      drafts.set({
        ...sentScope,
        content: `${text}${oldDialogDraft.content}`,
        replyMessage: oldDialogDraft.replyMessage,
      });
      return;
    }

    const nextMessage = messageText.value.trim() ? messageHtml.value.trim() : '';
    restoreDraft(`${text}${nextMessage}`);
    if (!nextMessage) silentMessage.value = sentSilent;
  };

  try {
    const pendingSend = messages.send(text, [], sentSilent);
    await nextTick();
    focusEditor();
    const sent = await pendingSend;

    if (!sent) {
      restoreFailedMessage();
    }
  } catch {
    restoreFailedMessage();
  }
};

const cancelEditing = async () => {
  stopTypingSignal(dialog.current?.dialog_id);
  messages.cancelEditing();
  editorRef.value?.clearContent(false);
  messageHtml.value = '';
  messageText.value = '';
  await loadDraft();
  await nextTick();
  focusEditor();
};

const cancelReply = async () => {
  messages.cancelReply();
  await nextTick();
  focusEditor();
};

watch(
  () => [editorRef.value, draftScope.value.userId, draftScope.value.dialogId],
  () => {
    void loadDraft();
  },
  { immediate: true },
);

watch(
  () => messageText.value,
  (value) => {
    if (isRestoringDraft.value || isEditingMessage.value) {
      return;
    }

    if (value.trim()) {
      void sendTypingSignal(true);
      if (value.includes('@')) {
        ensureMembersLoaded();
      }
      return;
    }

    stopTypingSignal(dialog.current?.dialog_id);
  },
);

watch(
  () => replyMessage.value?.id,
  () => {
    if (isRestoringDraft.value || isEditingMessage.value) {
      return;
    }

    saveDraft(activeDraftScope.value);
  },
);

watch(
  () => dialog.current?.dialog_id,
  (_nextDialogId, previousDialogId) => {
    stopTypingSignal(previousDialogId);
    typingStore.resetOutgoing();
    members.$reset();
  },
);

onBeforeUnmount(() => {
  stopTypingSignal();
});

watch(
  () => [editingMessage.value?.id, editorRef.value],
  async ([messageId]) => {
    if (!messageId || !editorRef.value || !editingMessage.value) {
      return;
    }

    saveDraft(activeDraftScope.value);
    isRestoringDraft.value = true;
    editorRef.value.setContent(editingMessage.value.message ?? '', false);
    await nextTick();
    isRestoringDraft.value = false;
    focusEditor();
  },
);

const saveActiveDraft = () => {
  saveDraft(activeDraftScope.value);
};

onMounted(() => {
  window.addEventListener('paste', onPaste, { capture: true });
  window.addEventListener('beforeunload', saveActiveDraft);
  window.addEventListener('dragenter', onWindowDragEnter);
  window.addEventListener('dragover', preventWindowFileDrop);
  window.addEventListener('dragleave', onWindowDragLeave);
  window.addEventListener('drop', onWindowDrop);
});

onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste, { capture: true });
  window.removeEventListener('beforeunload', saveActiveDraft);
  window.removeEventListener('dragenter', onWindowDragEnter);
  window.removeEventListener('dragover', preventWindowFileDrop);
  window.removeEventListener('dragleave', onWindowDragLeave);
  window.removeEventListener('drop', onWindowDrop);
  saveActiveDraft();
});
</script>

<template>
  <div
    class="sticky right-0 bottom-0 left-0 z-20"
    data-dialog-textarea
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop.stop="onDrop"
  >
    <DialogDragDropOverlay v-if="isDraggingUploads" :active-zone="activeUploadDropZone" />
    <div class="via-default/80 to-default bg-gradient-to-b from-transparent">
      <div class="flex justify-between gap-1.5 px-6 py-4" v-if="!canWriteMessage && isDialogMember">
        <div></div>
        <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
          <UButton
            color="neutral"
            variant="soft"
            size="xl"
            :label="notificationButtonLabel"
            :loading="notificationLoading"
            @click="toggleNotifications"
          />
        </div>
        <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
          <UButton
            size="xl"
            color="neutral"
            variant="soft"
            icon="i-ph-magnifying-glass-bold"
            @click="dialog.openSearch"
          />
        </div>
      </div>
      <div
        class="flex justify-between gap-1.5 px-6 py-4"
        v-else-if="!canWriteMessage && !isDialogMember"
      >
        <div></div>
        <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
          <UButton
            color="neutral"
            variant="soft"
            size="xl"
            label="Подписаться"
            :loading="isSubscribing"
            :disabled="isSubscribing"
            @click="subscribe"
          />
        </div>
        <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
          <UButton
            size="xl"
            color="neutral"
            variant="soft"
            icon="i-ph-magnifying-glass-bold"
            @click="dialog.openSearch"
          />
        </div>
      </div>
      <!--      <div-->
      <!--        class="text-muted flex min-h-14 w-full items-center justify-center px-6 py-4 text-sm"-->
      <!--        v-else-if="!canWriteMessage"-->
      <!--      >-->
      <!--        Нет доступа к отправке сообщений-->
      <!--      </div>-->
      <form
        class="relative mx-auto flex min-h-14 w-full flex-col space-y-2 px-6 py-4"
        v-else
        @submit.prevent="send"
      >
        <div
          class="bg-default max-h-40 w-full overflow-x-auto rounded-md p-0.5"
          v-if="showMentionSuggestions"
          @mousedown.prevent
          @pointerdown.prevent
        >
          <Item
            v-for="item in mentionSuggestionItems"
            :key="item.id"
            :class="{ 'bg-elevated': item.id === selectedMentionId }"
            @click="selectMentionById(item.id)"
          >
            <template #avatar>
              <UAvatar size="xs" :alt="item.name" :src="$storage(item.avatarUrl)" />
            </template>
            <template #heading>
              <span class="text-base">{{ item.label }}</span>
              <span class="text-muted truncate text-sm">{{ item.description }}</span>
            </template>
          </Item>
        </div>

        <div class="flex items-end gap-1.5">
          <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
            <DialogTextareaUpload
              :disabled="messages.sending || isEditingMessage"
              @select="selectUploads"
            />
          </div>
          <div class="bg-elevated flex w-full min-w-0 flex-col gap-4 rounded-md p-0.5 shadow-lg">
            <DialogTextareaReference
              v-if="editingMessage"
              title="Редактировать"
              :message="editingMessage.message"
              :attachments="editingMessage.attachments"
              @close="cancelEditing"
            />
            <DialogTextareaReference
              v-else-if="replyMessage"
              title="Ответить"
              :message="replyMessage.message"
              :attachments="replyMessage.attachments"
              icon="i-ph-arrow-bend-up-left-bold"
              @close="cancelReply"
            />
            <div class="flex w-full min-w-0 items-end gap-1.5">
              <div class="w-full min-w-0">
                <DialogTextEditor
                  v-model:html="messageHtml"
                  v-model:text="messageText"
                  ref="editorRef"
                  :editable="canWriteMessage && !editingMessageSaving"
                  :send-on-enter="sendOnEnter"
                  :mention-users="members.list"
                  :can-mention="canMentionMembers"
                  bubble-plugin-key="dialog-composer-bubble-menu"
                  @mention-search="ensureMembersLoaded"
                  @submit="send"
                  @focus="emojiPickerRef?.close()"
                />
              </div>
              <EmojiPicker
                ref="emojiPickerRef"
                :mobile-container="emojiPanel"
                :disabled="editingMessageSaving"
                @select="insertEmoji"
                @keyboard="editorRef?.focus()"
              />
              <UButton
                v-if="hasMessage && !isEditingMessage"
                type="button"
                size="xl"
                color="neutral"
                :variant="silentMessage ? 'solid' : 'soft'"
                :icon="silentMessage ? 'i-ph-bell-slash-bold' : 'i-ph-bell-bold'"
                :aria-label="silentMessage ? 'Отправить со звуком' : 'Отправить без звука'"
                :title="silentMessage ? 'Тихое сообщение' : 'Обычное сообщение'"
                @click="silentMessage = !silentMessage"
              />
              <UButton
                class="text-white"
                v-if="hasMessage || isEditingMessage"
                type="submit"
                size="xl"
                color="primary"
                variant="solid"
                icon="i-ph-paper-plane-tilt-bold"
                :loading="editingMessageSaving"
                :disabled="!canSubmit"
              />
            </div>
          </div>
          <div
            class="bg-elevated flex rounded-md p-0.5 shadow-lg"
            v-if="!hasMessage && !isEditingMessage"
          >
            <UButton
              type="button"
              size="xl"
              color="neutral"
              variant="soft"
              icon="i-ph-microphone-bold"
              :disabled="messages.sending || editingMessageSaving"
            />
          </div>
        </div>
      </form>
    </div>
    <div ref="emojiPanel" />
  </div>
</template>
