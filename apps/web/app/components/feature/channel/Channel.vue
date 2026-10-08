<script lang="ts" setup>
useSeoMeta({ title: 'Создать канал' });
const emit = defineEmits<{ close: [boolean] }>();

const toast = useToast();
const dialogs = useDialogsStore();

const state = reactive({
  title: '',
  description: '',
  avatar: '',
});

const loading = computed(() => dialogs.creatingChannel);
const canSubmit = computed(() => state.title.trim().length > 0 && !loading.value);

const submit = async () => {
  if (!canSubmit.value) return;

  try {
    const target = await dialogs.createChannel({
      title: state.title.trim(),
      description: state.description.trim(),
      avatar: state.avatar || null,
    });
    if (target) {
      await navigateTo(`/@${target}`);
      emit('close', false);
      return;
    }

    toast.add({ color: 'error', title: 'Ошибка при создании канала' });
  } catch (e) {
    toast.add({ color: 'error', title: 'Ошибка при создании канала' });
  }
};
</script>
<template>
  <USlideover side="left">
    <template v-slot:content>
      <AppBar>
        <template v-slot:left>
          <UButton
            icon="i-ph-caret-left-bold"
            size="xl"
            variant="ghost"
            color="neutral"
            @click="emit('close', false)"
          />
        </template>
        <template v-slot:center> Создать канал </template>
        <template v-slot:right>
          <UButton
            label="Создать"
            size="xl"
            :loading="loading"
            @click="submit"
            :color="canSubmit ? 'primary' : 'neutral'"
            :variant="canSubmit ? 'soft' : 'ghost'"
            :disabled="!canSubmit"
          />
        </template>
      </AppBar>
      <div class="space-y-4 px-2.5 pb-4">
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
              :maxLength="70"
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
          <div class="text-xs font-normal text-neutral-500">
            Можете указать дополнительное описание канала.
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
