<script setup lang="ts">
import { createLocalId } from '~/utils/create-local-id';
import type DialogTextEditor from './DialogTextEditor.vue';
import type { UploadPreview } from './DialogTextareaUploadPreviews.vue';

const props = defineProps<{
  files: File[];
  uploadType?: 'media' | 'file';
  initialMessageHtml?: string;
  initialMessageText?: string;
  onDraftReturn?: (draft: { html: string; text: string }) => void;
}>();

const emit = defineEmits<{
  close: [value: boolean];
}>();

const uploads = useUploadsStore();
let closed = false;
const config = useRuntimeConfig();
const messages = useMessagesStore();
const toast = useToast();
const messageHtml = ref(props.initialMessageHtml ?? '');
const messageText = ref(props.initialMessageText ?? '');
const loading = ref(false);
const editorRef = ref<InstanceType<typeof DialogTextEditor> | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
let shouldReturnDraft = true;
const deletedUploadIds = new Set<string>();
const maxUploadFiles = Number(config.public.uploadMessageMaxFiles || 10);
const maxUploadSizeMb = Number(config.public.uploadMessageMaxMb || 100);
const maxUploadSize = maxUploadSizeMb * 1024 * 1024;
const mediaInputAccept =
  'image/*,video/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.heic,.heif,.mp4,.m4v,.mov,.webm,.mkv,.avi,.mpeg,.mpg,.3gp,.3g2';
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

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const mimeOf = (file: File | UploadPreview) => {
  const type = 'type' in file ? file.type : '';

  if (type && type !== 'application/octet-stream') {
    return type;
  }

  return extensionMimeTypes[extensionOf(file.name)] ?? type;
};

const isImagePreview = (file: UploadPreview) => mimeOf(file).startsWith('image/');
const isVideoPreview = (file: UploadPreview) => mimeOf(file).startsWith('video/');
const isMediaFile = (file: File) => {
  const mimeType = mimeOf(file);

  return mimeType.startsWith('image/') || mimeType.startsWith('video/');
};
const getUploadErrorMessage = (error: unknown) => {
  const fetchError = error as {
    data?: { message?: string; errors?: Array<{ messages?: string[] }> | Record<string, string[]> };
    response?: {
      _data?: {
        message?: string;
        errors?: Array<{ messages?: string[] }> | Record<string, string[]>;
      };
    };
  };
  const data = fetchError.data ?? fetchError.response?._data;
  const errors = data?.errors;
  const firstError = Array.isArray(errors)
    ? errors[0]?.messages?.[0]
    : Object.values(errors ?? {})[0]?.[0];

  return firstError || data?.message || 'Не удалось загрузить';
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

const createPreview = (file: File): UploadPreview => ({
  localId: createLocalId(),
  name: file.name,
  type: mimeOf(file) || 'application/octet-stream',
  size: file.size,
  sourceFile: file,
  uploading: true,
  progress: 0,
});

const initialOversizedFiles = props.files.filter((file) => file.size > maxUploadSize);
const initialValidFiles = props.files.filter((file) => file.size <= maxUploadSize);
const initialFiles = initialValidFiles.slice(0, maxUploadFiles);
const initialSkippedFilesCount = initialValidFiles.length - initialFiles.length;
const previews = reactive<UploadPreview[]>(initialFiles.map(createPreview));

const isFileUploadMode = computed(() => props.uploadType === 'file');
const mediaPreviews = computed(() =>
  isFileUploadMode.value
    ? []
    : previews.filter((file) => isImagePreview(file) || isVideoPreview(file)),
);
const filePreviews = computed(() =>
  isFileUploadMode.value
    ? previews
    : previews.filter((file) => !isImagePreview(file) && !isVideoPreview(file)),
);
const hasOnlyMedia = computed(() => previews.length > 0 && filePreviews.value.length === 0);
const modalTitle = computed(() =>
  isFileUploadMode.value ? 'Документы' : hasOnlyMedia.value ? 'Фото или Видео' : 'Файлы',
);
const inputAccept = computed(() => (isFileUploadMode.value ? undefined : mediaInputAccept));
const totalUploadsSize = computed(() => previews.reduce((total, file) => total + file.size, 0));
const hasUploadingPreviews = computed(() => previews.some((file) => file.uploading));
const hasFailedPreviews = computed(() => previews.some((file) => file.error));
const canAddMoreFiles = computed(() => previews.length < maxUploadFiles);
const readyUploadIds = computed(() => previews.map((file) => file.id).filter(Boolean) as string[]);
const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};
const maxUploadSizeLabel = computed(() => formatSize(maxUploadSize));

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
      : `${firstFile.name}: ${formatSize(firstFile.size)}. Максимум: ${maxUploadSizeLabel.value}.`,
    color: 'error',
    icon: 'i-ph-warning-circle-fill',
    progress: false,
    duration: 3200,
  });
};

const uploadPreview = async (file: File, preview: UploadPreview) => {
  const controller = new AbortController();
  const startedRevision = uploads.revision;
  preview.abortController = controller;
  preview.uploading = true;
  preview.progress = 0;
  preview.error = undefined;

  try {
    const response = await uploads.uploadMessageFile(file, {
      type: props.uploadType ?? 'media',
      onProgress: (progress) => {
        if (!closed && preview.abortController === controller) {
          preview.progress = progress;
        }
      },
      signal: controller.signal,
    });
    const currentPreview = previews.find((item) => item.localId === preview.localId);

    if (
      closed ||
      controller.signal.aborted ||
      startedRevision !== uploads.revision ||
      !currentPreview ||
      currentPreview.abortController !== controller
    ) {
      if (!closed && currentPreview?.abortController === controller) {
        currentPreview.uploading = false;
        currentPreview.progress = 0;
        currentPreview.abortController = undefined;
        currentPreview.error = 'Загрузка отменена';
      }
      await uploads.deleteTemporaryUpload(response.id);
      return;
    }

    currentPreview.id = response.id;
    currentPreview.path = response.path;
    currentPreview.thumbnail_path = response.thumbnail_path;
    currentPreview.type = response.mime_type || currentPreview.type;
    currentPreview.name = response.original_name || currentPreview.name;
    currentPreview.size = response.size || currentPreview.size;
    currentPreview.width = response.width;
    currentPreview.height = response.height;
    currentPreview.duration = response.duration;
    currentPreview.uploading = false;
    currentPreview.progress = 100;
    currentPreview.abortController = undefined;
    currentPreview.error = undefined;
  } catch (error) {
    const currentPreview = previews.find((item) => item.localId === preview.localId);
    if (
      closed ||
      !currentPreview ||
      currentPreview.abortController !== controller ||
      startedRevision !== uploads.revision
    )
      return;
    const isAbortError = error instanceof DOMException && error.name === 'AbortError';
    const message = isAbortError ? 'Загрузка отменена' : getUploadErrorMessage(error);

    currentPreview.uploading = false;
    currentPreview.progress = 0;
    currentPreview.abortController = undefined;
    currentPreview.error = message;

    if (isAbortError) {
      return;
    }

    toast.add({
      title: message,
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2200,
    });
  }
};

const retryUpload = (preview: UploadPreview) => {
  if (!preview.sourceFile || loading.value || preview.uploading) {
    return;
  }

  void uploadPreview(preview.sourceFile, preview);
};

const cancelUpload = (preview: UploadPreview) => {
  preview.abortController?.abort();
};

const deleteTemporaryUpload = async (preview: UploadPreview) => {
  if (!preview.id || deletedUploadIds.has(preview.id)) {
    return;
  }

  deletedUploadIds.add(preview.id);

  await uploads.deleteTemporaryUpload(preview.id);
};

const cleanupTemporaryUploads = () => {
  previews.forEach((preview) => {
    if (preview.id) {
      void deleteTemporaryUpload(preview);
    }
  });
};

const uploadPreviews = async () => {
  await Promise.all(
    initialFiles.map((file, index) => {
      const preview = previews[index];
      return preview ? uploadPreview(file, preview) : undefined;
    }),
  );
};

const addFiles = (files: FileList | File[]) => {
  const selectedFiles = Array.from(files);
  const matchingFiles = isFileUploadMode.value ? selectedFiles : selectedFiles.filter(isMediaFile);
  const oversizedFiles = matchingFiles.filter((file) => file.size > maxUploadSize);
  const validFiles = matchingFiles.filter((file) => file.size <= maxUploadSize);

  if (matchingFiles.length === 0) {
    toast.add({
      title: isFileUploadMode.value ? 'Выберите файл' : 'Выберите фото или видео',
      color: 'neutral',
      icon: 'i-ph-info-bold',
      progress: false,
      duration: 1800,
      close: false,
    });
    return;
  }

  if (oversizedFiles.length > 0) {
    showOversizedFilesToast(oversizedFiles);
  }

  if (matchingFiles.length < selectedFiles.length) {
    toast.add({
      title: 'Можно добавить только фото или видео',
      color: 'neutral',
      icon: 'i-ph-info-bold',
      progress: false,
      duration: 1800,
      close: false,
    });
  }

  const availableSlots = Math.max(0, maxUploadFiles - previews.length);
  const filesToAdd = validFiles.slice(0, availableSlots);

  if (filesToAdd.length < validFiles.length) {
    showUploadCountLimitToast(validFiles.length - filesToAdd.length);
  }

  if (filesToAdd.length === 0) {
    return;
  }

  filesToAdd.forEach((file) => {
    const preview = createPreview(file);
    previews.push(preview);
    void uploadPreview(file, preview);
  });
};

const openFilePicker = () => {
  if (!loading.value && canAddMoreFiles.value) {
    fileInput.value?.click();
  }
};

const onFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement | null;

  if (!input?.files?.length) {
    return;
  }

  addFiles(input.files);
  input.value = '';
};

const removePreview = (file: UploadPreview) => {
  file.abortController?.abort();
  void deleteTemporaryUpload(file);

  const index = previews.findIndex((item) => item.localId === file.localId);

  if (index !== -1) {
    previews.splice(index, 1);
  }

  if (previews.length === 0) {
    close();
  }
};

const close = () => {
  if (!loading.value) {
    closed = true;
    previews.forEach((preview) => preview.abortController?.abort());
    cleanupTemporaryUploads();
    emit('close', false);
  }
};

const sendMessage = async () => {
  if (
    loading.value ||
    hasUploadingPreviews.value ||
    hasFailedPreviews.value ||
    readyUploadIds.value.length === 0
  ) {
    return;
  }

  if (totalUploadsSize.value > maxUploadSize) {
    toast.add({
      title: 'Размер файлов слишком большой',
      description: `Все файлы не должны превышать ${maxUploadSizeLabel.value}.`,
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2400,
    });
    return;
  }

  loading.value = true;

  try {
    const text = messageText.value.trim() ? messageHtml.value.trim() : '';
    const sent = await messages.send(text, readyUploadIds.value);

    if (sent) {
      shouldReturnDraft = false;
      emit('close', false);
    }
  } catch {
    toast.add({
      title: 'Не удалось отправить вложения',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2200,
    });
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  showOversizedFilesToast(initialOversizedFiles);

  if (initialSkippedFilesCount > 0) {
    showUploadCountLimitToast(initialSkippedFilesCount);
  }

  if (initialFiles.length === 0) {
    close();
    return;
  }

  void uploadPreviews();

  await nextTick();
  if (props.initialMessageHtml) {
    editorRef.value?.setContent(props.initialMessageHtml, false);
  }
});

onBeforeUnmount(() => {
  closed = true;
  previews.forEach((preview) => preview.abortController?.abort());

  if (shouldReturnDraft) {
    cleanupTemporaryUploads();
  }

  if (shouldReturnDraft && messageText.value.trim()) {
    props.onDraftReturn?.({
      html: messageHtml.value,
      text: messageText.value,
    });
  }
});
</script>

<template>
  <UModal
    :dismissible="!loading"
    :title="modalTitle"
    description="Форма отправки вложений"
    :ui="{ content: 'max-w-2xl overflow-hidden' }"
  >
    <template #content>
      <AppBar class="min-h-14">
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="ghost"
            :disabled="loading"
            @click="close"
          />
        </template>
        <template #center>{{ modalTitle }}</template>
        <template #right>
          <input
            class="hidden"
            v-if="canAddMoreFiles"
            ref="fileInput"
            type="file"
            multiple
            :accept="inputAccept"
            @change="onFileSelect"
          />
          <UButton
            v-if="canAddMoreFiles"
            color="neutral"
            icon="i-ph-plus-bold"
            size="xl"
            variant="ghost"
            :disabled="loading"
            @click="openFilePicker"
          />
        </template>
      </AppBar>

      <DialogTextareaUploadPreviews
        :media="mediaPreviews"
        :files="filePreviews"
        :loading="loading"
        @retry="retryUpload"
        @cancel="cancelUpload"
        @remove="removePreview"
      />

      <div class="flex items-end justify-between gap-2 p-2">
        <div class="w-full min-w-0">
          <DialogTextEditor
            v-model:html="messageHtml"
            v-model:text="messageText"
            ref="editorRef"
            :editable="!loading"
            :send-on-enter="true"
            editor-class="tiptap-editor w-full min-h-[2rem] max-h-32 overflow-y-auto px-1 py-2 text-base leading-5 outline-none"
            bubble-plugin-key="dialog-upload-composer-bubble-menu"
            @submit="sendMessage"
          />
        </div>
        <UButton
          label="Отправить"
          color="primary"
          variant="solid"
          :loading="loading || hasUploadingPreviews"
          :disabled="hasFailedPreviews || readyUploadIds.length === 0"
          @click="sendMessage"
        />
      </div>
    </template>
  </UModal>
</template>
