<script setup lang="ts">
import type { User } from '~/types';

const emit = defineEmits<{ close: [boolean] }>();
const props = defineProps<{
  target?: string | null;
  title?: string | null;
}>();

const toast = useToast();
const { withCount } = useInflection();
const selectedUsers = ref<User[]>([]);
const members = useProfileMembersStore().createScope();
const { saving: loading, loading: membersLoading } = toRefs(members.state);
const existingUserIds = computed(() => members.state.list.map((user) => user.id));
onUnmounted(members.dispose);
const normalizedTarget = computed(() => String(props.target ?? '').trim());
const existingUserIdSet = computed(() => new Set(existingUserIds.value.map((id) => String(id))));
const newSelectedUsers = computed(() =>
  selectedUsers.value.filter((user) => !existingUserIdSet.value.has(String(user.id))),
);
const canSubmit = computed(
  () =>
    newSelectedUsers.value.length > 0 &&
    !loading.value &&
    !membersLoading.value &&
    !members.state.error &&
    Boolean(normalizedTarget.value),
);

const fetchExistingUsers = async () => {
  await members.fetchData(normalizedTarget.value, { all: true, force: true });
  if (members.state.error)
    toast.add({ color: 'error', title: 'Не удалось загрузить участников группы' });
};

const submit = async () => {
  if (!canSubmit.value) return;

  try {
    const response = await members.add(
      normalizedTarget.value,
      newSelectedUsers.value.map((user) => user.id),
    );
    if (!response) return;

    if (response?.ok === true) {
      toast.add({
        color: 'success',
        title: response.added
          ? `Добавлено ${withCount(response.added, ['участник', 'участника', 'участников'])}`
          : 'Новых участников нет',
      });
      emit('close', false);
      return;
    }

    toast.add({ color: 'error', title: 'Не удалось добавить участников' });
  } catch {
    toast.add({ color: 'error', title: 'Не удалось добавить участников' });
  }
};

watch(normalizedTarget, () => {
  selectedUsers.value = [];
  void fetchExistingUsers();
});
onMounted(fetchExistingUsers);
</script>

<template>
  <USlideover side="right" title="Добавить участников" description="Добавить участников в группу">
    <template #content>
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
        <template v-slot:center>Добавить участников</template>
        <template v-slot:right>
          <UButton
            label="Добавить"
            size="xl"
            :color="canSubmit ? 'primary' : 'neutral'"
            :variant="canSubmit ? 'soft' : 'ghost'"
            :disabled="!canSubmit || membersLoading"
            :loading="loading || membersLoading"
            @click="submit"
          />
        </template>
      </AppBar>
      <ProfileListError
        v-if="members.state.error"
        compact
        padded
        label="Не удалось загрузить участников группы"
        @retry="fetchExistingUsers"
      />
      <GroupUserListWithSelect
        v-else
        v-model="selectedUsers"
        :disabled-user-ids="existingUserIds"
      />
    </template>
  </USlideover>
</template>
