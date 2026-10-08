<script setup lang="ts">
import { Profile, ProfileAdminSettings } from '#components';
import type { ContextMenuItem } from '@nuxt/ui';
import type { DialogMemberRole, DialogPermission, DialogType, User } from '~/types';

const AUDIENCE_TAB_VALUE = 'audience';

const props = defineProps<{
  target?: string | null;
  enabled?: boolean;
  activeTab?: string | null;
  tabValue?: string;
  role?: 'owner' | 'admin' | 'member' | null;
  roles?: Array<'owner' | 'admin' | 'member'>;
  currentMemberRole?: DialogMemberRole | null;
  currentMemberPermissions?: DialogPermission[];
  dialogType?: DialogType | null;
  emptyLabel?: string;
  bottomTrigger?: number;
  refreshTrigger?: number;
}>();

const normalizedTarget = computed(() => String(props.target ?? '').trim());
const hasAudienceAccess = computed(() => Boolean(props.enabled) && Boolean(normalizedTarget.value));
const ownTabValue = computed(() => String(props.tabValue || AUDIENCE_TAB_VALUE).trim());
const isAudienceTabActive = computed(
  () => String(props.activeTab ?? '').trim() === ownTabValue.value,
);
const canLoad = computed(() => hasAudienceAccess.value && isAudienceTabActive.value);
const rolesQuery = computed(() => (props.roles?.length ? props.roles.join(',') : undefined));
const hasPermission = (permission: DialogPermission) =>
  Boolean(props.currentMemberPermissions?.includes(permission));
const canOpenUserContextMenu = computed(
  () =>
    hasPermission('manage_admins') || hasPermission('ban_users') || hasPermission('invite_users'),
);
const canPromoteUsers = computed(() => hasPermission('manage_admins'));
const canManageAdminSettings = computed(
  () =>
    hasPermission('manage_admins') &&
    ['G', 'C'].includes(String(props.dialogType ?? '').toUpperCase()),
);
const canOpenAdminSettingsByClick = computed(
  () => canManageAdminSettings.value && ownTabValue.value === 'admins',
);
const isChannelDialog = computed(() => String(props.dialogType ?? '').toUpperCase() === 'C');
const canRemoveUser = (user: User) =>
  !isChannelDialog.value &&
  user.dialog_role !== 'owner' &&
  hasPermission('ban_users') &&
  (hasPermission('manage_admins') || user.dialog_role === 'member');

const members = useProfileMembersStore().createScope();
const {
  list: audienceList,
  loading: audienceLoading,
  error: audienceError,
  hasMore: audienceHasMore,
  softRefreshing: audienceSoftRefreshing,
  busyUserAction,
} = toRefs(members.state);
onUnmounted(members.dispose);
const overlay = useOverlay();
const toast = useToast();
const { confirm } = useConfirm();
const usersOnline = useUsersOnlineStore();

const getUserOnlineText = (user: User) =>
  usersOnline.getOnlineText(user.id, user.username ? `@${user.username}` : 'был(-а) давно');
const isUserOnline = (user: User) => usersOnline.isOnline(user.id);

const userDisplayName = (user: User) => user.name || user.username || 'пользователя';

const updateUserRole = async (user: User, role: DialogMemberRole) => {
  if (!normalizedTarget.value || busyUserAction.value) {
    return;
  }

  try {
    await members.updateRole(normalizedTarget.value, user, role);
  } catch {
    toast.add({
      title:
        role === 'admin' ? 'Не удалось сделать администратором' : 'Не удалось снять администратора',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

const removeUserFromGroup = async (user: User) => {
  if (!normalizedTarget.value || busyUserAction.value) {
    return;
  }

  try {
    await members.remove(normalizedTarget.value, user);
  } catch {
    toast.add({
      title: 'Не удалось исключить из группы',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

const confirmUpdateUserRole = (user: User, role: DialogMemberRole) => {
  const makeAdmin = role === 'admin';

  confirm({
    title: makeAdmin ? 'Сделать администратором?' : 'Снять права администратора?',
    description: makeAdmin
      ? `Пользователь ${userDisplayName(user)} получит права администратора.`
      : `Пользователь ${userDisplayName(user)} потеряет права администратора.`,
    confirmButtonText: makeAdmin ? 'Сделать администратором' : 'Снять администратора',
    confirmButtonColor: makeAdmin ? 'primary' : 'error',
    cancelButtonText: 'Отмена',
    onConfirm: () => updateUserRole(user, role),
  });
};

const confirmRemoveUserFromGroup = (user: User) => {
  confirm({
    title: 'Исключить из группы?',
    description: `Пользователь ${userDisplayName(user)} потеряет доступ к группе.`,
    confirmButtonText: 'Исключить',
    confirmButtonColor: 'error',
    cancelButtonText: 'Отмена',
    onConfirm: () => removeUserFromGroup(user),
  });
};

const applyAdminSettingsUpdate = (updatedUser: User) => members.syncUser(updatedUser);

const openAdminSettings = (user: User) => {
  if (!canManageAdminSettings.value || user.dialog_role !== 'admin') {
    return false;
  }

  overlay.create(ProfileAdminSettings).open({
    target: normalizedTarget.value,
    user,
    dialogType: props.dialogType,
    onUpdated: applyAdminSettingsUpdate,
  });

  return true;
};

const getUserContextMenuItems = (user: User): ContextMenuItem[][] =>
  [
    [
      canManageAdminSettings.value && user.dialog_role === 'admin'
        ? {
            label: 'Редактировать права',
            icon: 'i-ph-sliders-horizontal-bold',
            disabled: Boolean(busyUserAction.value),
            onSelect: () => openAdminSettings(user),
          }
        : null,
      canPromoteUsers.value && user.dialog_role === 'member'
        ? {
            label: 'Сделать администратором',
            icon: 'i-ph-shield-plus-bold',
            loading: busyUserAction.value === `admin:${user.id}`,
            disabled: Boolean(busyUserAction.value),
            onSelect: () => confirmUpdateUserRole(user, 'admin'),
          }
        : null,
      canPromoteUsers.value && user.dialog_role === 'admin'
        ? {
            label: 'Снять администратора',
            icon: 'i-ph-shield-slash-bold',
            loading: busyUserAction.value === `member:${user.id}`,
            disabled: Boolean(busyUserAction.value),
            onSelect: () => confirmUpdateUserRole(user, 'member'),
          }
        : null,
      canRemoveUser(user)
        ? {
            label: 'Исключить из группы',
            icon: 'i-ph-user-minus-bold',
            color: 'error',
            loading: busyUserAction.value === `remove:${user.id}`,
            disabled: Boolean(busyUserAction.value),
            onSelect: () => confirmRemoveUserFromGroup(user),
          }
        : null,
    ],
  ].map((group) => group.filter(Boolean) as ContextMenuItem[]);
const hasUserContextMenuItems = (user: User) =>
  getUserContextMenuItems(user).some((group) => group.length > 0);

const resetAudience = members.$reset;
const loadAudience = async (options?: { force?: boolean }) => {
  if (!canLoad.value || (!options?.force && audienceError.value)) return;
  await members.fetchData(normalizedTarget.value, { role: props.role, roles: rolesQuery.value });
};
const softReloadAudience = async () => {
  if (!canLoad.value || audienceLoading.value) return;
  await members.fetchData(normalizedTarget.value, {
    role: props.role,
    roles: rolesQuery.value,
    soft: true,
  });
};

const openUserProfile = (user: User) => {
  if (canOpenAdminSettingsByClick.value && openAdminSettings(user)) {
    return;
  }

  const target = String(user.username || user.dialog_id || '').trim();

  if (!target) {
    return;
  }

  overlay.create(Profile, { props: { target } }).open();
};

watch(
  () => [normalizedTarget.value, hasAudienceAccess.value, props.role, rolesQuery.value],
  async () => {
    resetAudience();
    if (canLoad.value) {
      await loadAudience();
    }
  },
  { immediate: true },
);

watch(
  () => canLoad.value,
  async (value) => {
    if (
      !value ||
      audienceList.value.length > 0 ||
      audienceLoading.value ||
      !audienceHasMore.value
    ) {
      return;
    }

    await loadAudience();
  },
);

watch(
  () => Number(props.bottomTrigger ?? 0),
  async () => {
    if (!canLoad.value) {
      return;
    }

    await loadAudience();
  },
);

watch(
  () => Number(props.refreshTrigger ?? 0),
  async () => {
    if (!canLoad.value) {
      return;
    }

    await softReloadAudience();
  },
);
</script>

<template>
  <div class="h-full">
    <ProfileListLoading
      v-if="audienceLoading && audienceList.length === 0 && !audienceSoftRefreshing"
    />

    <template v-else-if="audienceList.length > 0">
      <template v-for="user in audienceList" :key="user.id">
        <UContextMenu
          v-if="canOpenUserContextMenu && hasUserContextMenuItems(user)"
          :items="getUserContextMenuItems(user)"
        >
          <button class="w-full text-left" type="button" @click="openUserProfile(user)">
            <Item>
              <template #avatar>
                <UAvatar size="3xl" :alt="user.name" :src="$storage(user.avatar)" />
              </template>
              <template #heading>
                {{ user.name }}
              </template>
              <template #description>
                <span :class="{ 'text-primary': isUserOnline(user) }">{{
                  getUserOnlineText(user)
                }}</span>
              </template>
              <template #loadingTop>
                <UBadge
                  v-if="user.dialog_role === 'owner' || user.dialog_role === 'admin'"
                  size="xs"
                  variant="soft"
                  :color="user.dialog_role === 'owner' ? 'primary' : 'neutral'"
                  :label="user.dialog_role === 'owner' ? 'Владелец' : 'Администратор'"
                />
              </template>
            </Item>
          </button>
        </UContextMenu>
        <button class="w-full text-left" v-else type="button" @click="openUserProfile(user)">
          <Item>
            <template #avatar>
              <UAvatar size="3xl" :alt="user.name" :src="$storage(user.avatar)" />
            </template>
            <template #heading>
              {{ user.name }}
            </template>
            <template #description>
              <span :class="{ 'text-primary': isUserOnline(user) }">{{
                getUserOnlineText(user)
              }}</span>
            </template>
            <template #loadingTop>
              <UBadge
                v-if="user.dialog_role === 'owner' || user.dialog_role === 'admin'"
                size="xs"
                variant="soft"
                :color="user.dialog_role === 'owner' ? 'primary' : 'neutral'"
                :label="user.dialog_role === 'owner' ? 'Владелец' : 'Администратор'"
              />
            </template>
          </Item>
        </button>
      </template>
    </template>

    <ProfileListLoading
      v-if="audienceLoading && audienceList.length > 0 && !audienceSoftRefreshing"
      more
    />
    <ProfileListError
      v-else-if="audienceError"
      compact
      label="Не удалось загрузить список"
      @retry="loadAudience({ force: true })"
    />
    <ProfileListEmpty
      v-else-if="canLoad && audienceList.length === 0"
      compact
      :label="props.emptyLabel || 'Список пуст'"
    />
  </div>
</template>
