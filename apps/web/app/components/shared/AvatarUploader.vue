<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    entity?: string;
    maxSize?: number;
    width?: number;
    height?: number;
  }>(),
  {
    entity: 'avatars',
    height: 400,
    width: 400,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
}>();
const toast = useToast();
const config = useRuntimeConfig();
const uploads = useUploadsStore();
let disposed = false;

const value = computed({
  get() {
    return props.modelValue;
  },
  set(value) {
    emit('update:modelValue', value);
  },
});

const inputRef = useTemplateRef('inputRef');
const loading = ref(false);
const progress = ref(0);
const error = ref('');
const selectedFile = ref<File | null>(null);
const abortController = ref<AbortController | null>(null);
const temporaryUploadId = ref<string | null>(null);
const maxSizeBytes = computed(() => {
  if (props.maxSize) {
    return props.maxSize * 1024 * 1024;
  }

  return Number(config.public.uploadAvatarMaxMb || 5) * 1024 * 1024;
});
const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const showOversizedToast = (file: File) => {
  toast.add({
    title: 'Файл слишком большой',
    description: `${file.name}: ${formatSize(file.size)}. Максимум: ${formatSize(maxSizeBytes.value)}.`,
    color: 'error',
    icon: 'i-heroicons-exclamation-circle-solid',
    progress: false,
    duration: 3200,
  });
};

const deleteTemporaryUpload = async () => {
  if (!temporaryUploadId.value) {
    return;
  }

  const uploadId = temporaryUploadId.value;
  temporaryUploadId.value = null;

  await uploads.deleteTemporaryUpload(uploadId);
};

const uploadAvatar = async (file: File) => {
  abortController.value?.abort();

  const controller = new AbortController();
  const startedRevision = uploads.revision;
  abortController.value = controller;
  loading.value = true;
  progress.value = 0;
  error.value = '';

  try {
    await deleteTemporaryUpload();
    if (disposed || controller.signal.aborted || startedRevision !== uploads.revision) {
      throw new DOMException('Upload aborted', 'AbortError');
    }
    const response = await uploads.uploadAvatar(file, {
      entity: props.entity,
      width: props.width,
      height: props.height,
      signal: controller.signal,
      onProgress: (nextProgress) => {
        if (!disposed && abortController.value === controller) {
          progress.value = nextProgress;
        }
      },
    });

    if (
      disposed ||
      controller.signal.aborted ||
      abortController.value !== controller ||
      startedRevision !== uploads.revision
    ) {
      if (response.id) {
        await uploads.deleteTemporaryUpload(response.id);
      }
      return;
    }

    if (response.ok && response.path) {
      temporaryUploadId.value = response.id ?? null;
      value.value = String(response.path);
      return;
    }

    throw new Error(response.message || 'Не удалось загрузить фото');
  } catch (uploadError) {
    if (disposed || abortController.value !== controller || startedRevision !== uploads.revision)
      return;
    const isAbortError = uploadError instanceof DOMException && uploadError.name === 'AbortError';
    const message = isAbortError
      ? 'Загрузка отменена'
      : uploadError instanceof Error
        ? uploadError.message
        : 'Не удалось загрузить фото';

    error.value = message;

    if (!isAbortError) {
      toast.add({
        title: message,
        color: 'error',
        icon: 'i-heroicons-exclamation-circle-solid',
        progress: false,
        duration: 2200,
      });
    }
  } finally {
    if (abortController.value === controller) {
      loading.value = false;
      abortController.value = null;
    }
  }
};

const onSelect = (e: Event) => {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;
  input.value = null;

  if (file.size > maxSizeBytes.value) {
    showOversizedToast(file);
    return;
  }

  selectedFile.value = file;
  void uploadAvatar(file);
};

const retryUpload = () => {
  if (selectedFile.value && !loading.value) {
    void uploadAvatar(selectedFile.value);
  }
};

const cancelUpload = () => {
  abortController.value?.abort();
};

const clearAvatar = () => {
  abortController.value?.abort();
  void deleteTemporaryUpload();
  value.value = '';
  error.value = '';
  progress.value = 0;
};

const openFilePicker = () => {
  if (!loading.value) {
    inputRef.value?.click();
  }
};

onBeforeUnmount(() => {
  disposed = true;
  abortController.value?.abort();
  void deleteTemporaryUpload();
});
</script>

<template>
  <div class="flex items-center justify-center">
    <div class="relative flex">
      <span @click="openFilePicker">
        <slot />
      </span>
      <div
        class="absolute inset-0 flex items-center justify-center rounded-[0.75rem] bg-black/35 text-xs font-medium text-white"
        v-if="loading"
      >
        {{ progress }}%
      </div>
      <UTooltip
        class="absolute end-0 bottom-0"
        v-if="loading"
        text="Отменить загрузку"
        :delay-duration="0"
        :content="{ side: 'right', align: 'center' }"
      >
        <UButton
          class="rounded-full p-0.5"
          type="button"
          color="neutral"
          icon="i-ph-stop-bold"
          size="xs"
          variant="soft"
          @click="cancelUpload"
        />
      </UTooltip>
      <UTooltip
        class="absolute end-0 bottom-0"
        v-else-if="value"
        text="Убрать фотографию"
        :delay-duration="0"
        :content="{ side: 'right', align: 'center' }"
      >
        <UButton
          class="rounded-full p-0.5"
          :disabled="loading"
          @click="clearAvatar"
          :loading="loading"
          type="button"
          color="neutral"
          icon="i-ph-x-bold"
          size="xs"
          variant="soft"
        />
      </UTooltip>
      <UTooltip
        class="absolute end-0 bottom-0"
        v-else-if="error && selectedFile"
        text="Повторить загрузку"
        :delay-duration="0"
        :content="{ side: 'right', align: 'center' }"
      >
        <UButton
          class="rounded-full p-0.5"
          type="button"
          color="neutral"
          icon="i-ph-arrow-clockwise-bold"
          size="xs"
          variant="soft"
          @click="retryUpload"
        />
      </UTooltip>
      <input
        class="hidden"
        ref="inputRef"
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        @change="onSelect"
      />
    </div>
  </div>
</template>
