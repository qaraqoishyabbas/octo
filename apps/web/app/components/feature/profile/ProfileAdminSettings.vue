<script setup lang="ts">
import type { DialogMemberRole, DialogPermission, DialogType, User } from '~/types';

type PermissionItem = {
  value: DialogPermission;
  label: string;
};

const emit = defineEmits<{
  close: [boolean];
  updated: [User];
}>();

const props = defineProps<{
  target: string;
  user: User;
  dialogType?: DialogType | null;
}>();

const toast = useToast();
const { confirm } = useConfirm();
const usersOnline = useUsersOnlineStore();
const members = useProfileMembersStore().createScope();
const { saving } = toRefs(members.state);
onUnmounted(members.dispose);
const selectedPermissions = ref<DialogPermission[]>([...(props.user.dialog_permissions ?? [])]);
const isChannelDialog = computed(() => String(props.dialogType ?? '').toUpperCase() === 'C');

const permissionItems = computed<PermissionItem[]>(() => [
  {
    value: 'manage_dialog',
    label: 'Изменение описания',
  },
  {
    value: 'delete_messages',
    label: 'Удаление сообщений',
  },
  {
    value: 'ban_users',
    label: 'Блокировка пользователей',
  },
  {
    value: 'invite_users',
    label: 'Пригласительные ссылки',
  },
  {
    value: 'pin_messages',
    label: 'Закрепление сообщений',
  },
  {
    value: 'manage_admins',
    label: 'Настройки администраторов',
  },
  ...(isChannelDialog.value
    ? [
        {
          value: 'send_messages' as DialogPermission,
          label: 'Публикация сообщений',
        },
      ]
    : []),
]);
const editablePermissionValues = computed(
  () => new Set(permissionItems.value.map((item) => item.value)),
);

const onlineText = computed(() =>
  usersOnline.getOnlineText(
    props.user.id,
    props.user.username ? `@${props.user.username}` : 'был(-а) давно',
  ),
);

const userDisplayName = computed(() => props.user.name || props.user.username || 'пользователь');

const hasPermission = (permission: DialogPermission) =>
  selectedPermissions.value.includes(permission);

const togglePermission = (permission: DialogPermission, value?: boolean) => {
  const enabled = value ?? !hasPermission(permission);

  selectedPermissions.value = enabled
    ? [...new Set([...selectedPermissions.value, permission])]
    : selectedPermissions.value.filter((item) => item !== permission);
};

const updateAdmin = async (role: DialogMemberRole) => {
  if (saving.value) {
    return;
  }

  try {
    const updatedUser = await members.updateRole(
      props.target,
      props.user,
      role,
      role === 'admin'
        ? selectedPermissions.value.filter((permission) =>
            editablePermissionValues.value.has(permission),
          )
        : [],
    );
    if (!updatedUser) return;
    emit('updated', updatedUser);
    emit('close', false);
  } catch {
    toast.add({
      title: role === 'admin' ? 'Не удалось сохранить права' : 'Не удалось снять администратора',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

const confirmDemoteAdmin = () => {
  confirm({
    title: 'Снять права администратора?',
    description: `Пользователь ${userDisplayName.value} потеряет права администратора.`,
    confirmButtonText: 'Снять администратора',
    confirmButtonColor: 'error',
    cancelButtonText: 'Отмена',
    onConfirm: () => updateAdmin('member'),
  });
};

watch(
  () => props.user.last_seen_at,
  (lastSeenAt) => {
    if (lastSeenAt !== undefined) {
      usersOnline.setBackendLastSeen(props.user.id, lastSeenAt);
    }
  },
  { immediate: true },
);
</script>

<template>
  <USlideover side="right" title="Администратор" description="Настройки прав администратора">
    <template #content>
      <div class="overflow-y-auto">
        <AppBar>
          <template v-slot:left>
            <UButton
              color="neutral"
              icon="i-ph-caret-left-bold"
              size="xl"
              variant="soft"
              :disabled="saving"
              @click="emit('close', false)"
            />
          </template>
          <template v-slot:center>Администратор</template>
          <template v-slot:right>
            <UButton
              color="primary"
              label="Готово"
              size="xl"
              variant="soft"
              :loading="saving"
              :disabled="saving"
              @click="updateAdmin('admin')"
            />
          </template>
        </AppBar>
        <div class="w-full flex-1">
          <div class="space-y-4 px-2.5">
            <section>
              <div class="bg-elevated flex items-center gap-3 rounded-md px-3 py-2">
                <UAvatar size="3xl" :alt="props.user.name" :src="$storage(props.user.avatar)" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-base font-bold">{{ props.user.name }}</div>
                  <div class="text-muted truncate text-sm">{{ onlineText }}</div>
                </div>
              </div>
            </section>

            <section>
              <div class="px-3 py-1 text-base font-bold">Разрешения</div>
              <div class="bg-elevated rounded-md">
                <template v-for="(item, index) in permissionItems" :key="item.value">
                  <UButton
                    class="justify-between"
                    block
                    color="neutral"
                    variant="ghost"
                    size="xl"
                    @click="togglePermission(item.value)"
                  >
                    <span class="truncate">{{ item.label }}</span>
                    <USwitch
                      :model-value="hasPermission(item.value)"
                      size="xl"
                      checked-icon="i-ph-check-bold"
                      unchecked-icon="i-ph-x-bold"
                      @update:model-value="togglePermission(item.value, Boolean($event))"
                      @click.stop
                    />
                  </UButton>
                  <USeparator v-if="index < permissionItems.length - 1" />
                </template>
              </div>
              <div class="text-muted px-3 pt-2 text-xs font-normal text-pretty">
                Эти настройки определяют, какие действия администратор сможет выполнять в группе или
                канале.
              </div>
            </section>

            <section>
              <div class="bg-elevated rounded-md">
                <UButton
                  class="justify-start"
                  block
                  color="error"
                  icon="i-ph-shield-slash-bold"
                  label="Снять администратора"
                  size="xl"
                  variant="ghost"
                  :disabled="saving"
                  @click="confirmDemoteAdmin"
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
