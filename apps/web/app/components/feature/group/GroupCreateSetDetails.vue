<script setup lang="ts">
import type { User } from '~/types';

useSeoMeta({ title: 'Создать группу' });

const emit = defineEmits<{ (e: 'close', value: boolean): void }>();

const props = withDefaults(defineProps<{ userList?: User[] }>(), {
  userList: () => [],
});

const toast = useToast();
const { withCount } = useInflection();
const dialogs = useDialogsStore();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const getUserIds = () =>
  props.userList
    .map((user) => String(user?.id ?? '').trim())
    .filter((id, index, ids) => uuidPattern.test(id) && ids.indexOf(id) === index);

const loading = computed(() => dialogs.creatingGroup);
const state = reactive({
  title: '',
  users: getUserIds(),
  avatar: '',
});
const avatarType = 'G';
const canSubmit = computed(
  () => state.title.trim().length > 0 && state.users.length > 0 && !loading.value,
);

const submit = async () => {
  state.users = getUserIds();

  if (!canSubmit.value) return;

  try {
    const target = await dialogs.createGroup({
      title: state.title.trim(),
      users: state.users,
      avatar: state.avatar || null,
    });
    if (target) {
      await navigateTo(`/@${target}`);
      emit('close', false);
      return;
    }

    toast.add({ color: 'error', title: 'Ошибка при создании группы' });
  } catch (e) {
    toast.add({ color: 'error', title: 'Ошибка при создании группы' });
  }
};
</script>

<template>
  <USlideover side="left" title="Создать группу" description="Страница создание группы">
    <template #content>
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
        <template v-slot:center>Создать группу</template>
        <template v-slot:right>
          <UButton
            label="Создать"
            size="xl"
            :color="canSubmit ? 'primary' : 'neutral'"
            :variant="canSubmit ? 'soft' : 'ghost'"
            :disabled="!canSubmit"
            :loading="loading"
            @click="submit"
          />
        </template>
      </AppBar>

      <div class="space-y-4 px-2.5 pb-4">
        <div class="flex items-center space-x-4">
          <UFormField label="" name="avatar">
            <AvatarUploader v-model="state.avatar">
              <UAvatar
                class="size-20 rounded-full text-4xl uppercase"
                :src="$storage(state.avatar)"
                :alt="state.title"
                img-class="object-cover"
                :class="{ 'rounded-[0.75rem]': avatarType === 'G' || avatarType === 'C' }"
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
      </div>
      <div>
        <div class="px-3.5 py-2 font-semibold">
          {{ withCount(props.userList.length, ['участник', 'участника', 'участников']) }}
        </div>
        <Item v-for="user in props.userList" :key="user.id" no-hover no-cursor>
          <template v-slot:avatar>
            <UAvatar size="3xl" :alt="user.name" :src="$storage(user.avatar)" />
          </template>

          <template v-slot:heading>
            {{ user.name }}
          </template>

          <template v-slot:description>
            {{ user.email }}
          </template>
        </Item>
      </div>
    </template>
  </USlideover>
</template>
