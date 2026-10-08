<script setup lang="ts">
type ButtonColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral';
type ButtonVariant = 'link' | 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost';

type OnFn = () => void | Promise<void>;

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;

    confirmButtonText?: string;
    confirmButtonColor?: ButtonColor; // Nuxt UI color: primary, neutral, red, etc.
    confirmButtonVariant?: ButtonVariant; // Nuxt UI variant: solid, ghost, soft, link...

    cancelButtonText?: string;
    cancelButtonColor?: ButtonColor;
    cancelButtonVariant?: ButtonVariant;

    onConfirm?: OnFn;
    onCancel?: OnFn;
  }>(),
  {
    description: '',
    confirmButtonText: 'Подтвердить',
    confirmButtonColor: 'primary',
    confirmButtonVariant: 'soft',

    cancelButtonText: 'Отмена',
    cancelButtonColor: 'neutral',
    cancelButtonVariant: 'ghost',
  },
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();

const isLoading = ref(false);

const handleClose = () => emit('close');

const handleConfirm = async () => {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    if (props.onConfirm) {
      await props.onConfirm(); // используем callback-режим
    } else {
      emit('confirm'); // либо событийный режим
    }
  } finally {
    isLoading.value = false;
    emit('close');
  }
};

const handleCancel = async () => {
  if (isLoading.value) return;
  try {
    if (props.onCancel) {
      await props.onCancel();
    } else {
      emit('cancel');
    }
  } finally {
    emit('close');
  }
};
</script>

<template>
  <UModal
    :title="title"
    description="Подтвердите действие"
    :dismissible="!isLoading"
    @close="handleClose"
  >
    <template v-slot:content>
      <div class="flow-root space-y-3 p-4">
        <div class="space-y-2">
          <div class="text-lg font-semibold">{{ title }}</div>
          <div class="text-sm text-(--ui-text-muted)" v-if="description" v-html="description" />
        </div>

        <div class="float-right flex gap-2">
          <UButton
            type="button"
            :label="cancelButtonText"
            :color="cancelButtonColor"
            :variant="cancelButtonVariant"
            :disabled="isLoading"
            @click="handleCancel"
          />
          <UButton
            type="button"
            :label="confirmButtonText"
            :color="confirmButtonColor"
            :variant="confirmButtonVariant"
            :disabled="isLoading"
            :loading="isLoading"
            @click="handleConfirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
