<script setup lang="ts">
import type { Dialog } from '~/types';

const emit = defineEmits<{
  close: [boolean];
  updated: [Dialog];
}>();
const props = defineProps<{
  profile: Dialog;
  target?: string | null;
}>();

const toast = useToast();
const normalizedTarget = computed(() =>
  String(props.target || props.profile.dialog_id || '').trim(),
);
const isChannel = computed(() => props.profile.type === 'C');
const details = useProfileDetailsStore().createScope();
const { saving: loading } = toRefs(details.state);
onUnmounted(details.dispose);
const state = reactive({
  title: props.profile.title ?? '',
  description: props.profile.description ?? '',
  avatar: props.profile.avatar ?? '',
});
const canSubmit = computed(() => state.title.trim().length > 0 && !loading.value);

const submit = async () => {
  if (!canSubmit.value || !normalizedTarget.value) {
    return;
  }

  try {
    const response = await details.save(normalizedTarget.value, {
      title: state.title.trim(),
      description: state.description.trim() || null,
      avatar: state.avatar || null,
    });
    if (!response) return;
    const updatedDialog = response?.dialog;

    if (response?.ok && updatedDialog) {
      emit('updated', updatedDialog);
      emit('close', false);
      return;
    }

    toast.add({ color: 'error', title: 'Не удалось сохранить изменения' });
  } catch {
    toast.add({ color: 'error', title: 'Не удалось сохранить изменения' });
  }
};
</script>

<template>
  <USlideover side="right" title="Изменить" description="Редактирование группы или канала">
    <template #content>
      <div class="overflow-y-auto">
        <AppBar>
          <template v-slot:left>
            <UButton
              icon="i-ph-caret-left-bold"
              size="xl"
              variant="soft"
              color="neutral"
              @click="emit('close', false)"
            />
          </template>
          <template v-slot:center>{{ isChannel ? 'Изменить канал' : 'Изменить группу' }}</template>
          <template v-slot:right>
            <UButton
              label="Сохранить"
              size="xl"
              :color="canSubmit ? 'primary' : 'neutral'"
              :variant="canSubmit ? 'soft' : 'ghost'"
              :disabled="!canSubmit"
              :loading="loading"
              @click="submit"
            />
          </template>
        </AppBar>
        <div class="w-full flex-1">
          <div class="space-y-4 px-2.5">
            <div class="flex items-center space-x-4 px-2">
              <UFormField label="" name="avatar">
                <AvatarUploader v-model="state.avatar">
                  <UAvatar
                    class="size-20 rounded-[0.75rem] text-4xl uppercase"
                    :src="$storage(state.avatar)"
                    :alt="state.title"
                    img-class="object-cover"
                  />
                </AvatarUploader>
              </UFormField>

              <div class="bg-elevated flex w-full items-center rounded-md">
                <InputTextarea
                  v-model="state.title"
                  :disabled="loading"
                  :max-length="70"
                  placeholder="Название"
                />
              </div>
            </div>

            <div class="space-y-2 px-2">
              <UTextarea
                class="w-full"
                v-model="state.description"
                :disabled="loading"
                placeholder="Описание (необязательно)"
                :autoresize="true"
                :rows="5"
                variant="soft"
                :ui="{ base: 'resize-none' }"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
