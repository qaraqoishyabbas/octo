<script setup lang="ts">
import { useInfiniteScroll } from '@vueuse/core';
import type { Dialog } from '~/types';

type ProfileTabValue = 'audience' | 'media' | 'file' | 'link' | 'groups';

const emit = defineEmits<{ (e: 'close', value: boolean): void }>();
const props = defineProps<{
  target?: string | null;
}>();

const dialog = useDialogStore();
const profileContentRef = ref<HTMLElement | null>(null);
const activeTab = ref<ProfileTabValue>('media');
const bottomTrigger = ref(0);
const audienceRefreshTrigger = ref(0);
const details = useProfileDetailsStore().createScope();
const { loading, error, profile: loadedProfile } = toRefs(details.state);
onUnmounted(details.dispose);

const normalizedTarget = computed(() => String(props.target ?? '').trim());
const shouldFetchProfile = computed(() => normalizedTarget.value.length > 0);
const profile = computed(() => (shouldFetchProfile.value ? loadedProfile.value : dialog.current));
const currentDialogType = computed(() => String(profile.value?.type ?? '').toUpperCase());
const currentDialogTarget = computed(
  () => profile.value?.username || profile.value?.dialog_id || normalizedTarget.value,
);
const isAudienceDialog = computed(() => ['G', 'C'].includes(currentDialogType.value));
const isDirectDialog = computed(() => currentDialogType.value === 'D');
const hasFileDialog = computed(
  () => !isDirectDialog.value || profile.value?.id !== profile.value?.author_id,
);
const canViewMembers = computed(() => Boolean(profile.value?.can_view_members));
const isAudienceEnabled = computed(() => isAudienceDialog.value && canViewMembers.value);
const audienceTabLabel = computed(() =>
  currentDialogType.value === 'C' ? 'Подписчики' : 'Участники',
);
const isGroupsEnabled = computed(() => isDirectDialog.value && Boolean(currentDialogTarget.value));
const canOpenProfileDialog = computed(
  () => Boolean(currentDialogTarget.value) && !profile.value?.is_self,
);
const canSearch = computed(
  () => Boolean(profile.value?.dialog_id) && profile.value?.dialog_id === dialog.current?.dialog_id,
);

const fetchProfile = () => details.fetchData(normalizedTarget.value);

const openDialog = async () => {
  const target = currentDialogTarget.value;

  if (!target) {
    return;
  }

  await navigateTo(`/@${target}`);
  emit('close', false);
};

const openSearch = () => {
  dialog.openSearch();
  emit('close', false);
};

const updateProfile = (updatedDialog: Dialog) => {
  if (shouldFetchProfile.value) {
    loadedProfile.value = updatedDialog;
  }

  if (
    dialog.current &&
    (dialog.current.dialog_id === updatedDialog.dialog_id ||
      dialog.current.username === updatedDialog.username)
  ) {
    dialog.current = updatedDialog;
  }
};

const items = computed(() => {
  const base: Array<{ label: string; slot: ProfileTabValue; value: ProfileTabValue }> = [
    { label: 'Медиа', slot: 'media', value: 'media' },
    { label: 'Файлы', slot: 'file', value: 'file' },
    { label: 'Ссылки', slot: 'link', value: 'link' },
  ];

  if (isGroupsEnabled.value) {
    base.push({ label: 'Группы', slot: 'groups', value: 'groups' });
  }

  if (isAudienceEnabled.value) {
    return [{ label: audienceTabLabel.value, slot: 'audience', value: 'audience' }, ...base];
  }

  return base;
});

watch(
  normalizedTarget,
  async () => {
    await fetchProfile();
  },
  { immediate: true },
);

watch(
  items,
  (tabs) => {
    if (!tabs.some((tab) => tab.value === activeTab.value) && tabs[0]?.value) {
      activeTab.value = tabs[0].value as ProfileTabValue;
    }
  },
  { immediate: true },
);

useInfiniteScroll(
  profileContentRef,
  () => {
    bottomTrigger.value += 1;
  },
  { distance: 160 },
);

watch(
  () => [currentDialogTarget.value, Number(profile.value?.users_count ?? 0)],
  () => {
    audienceRefreshTrigger.value += 1;
  },
);
</script>

<template>
  <USlideover title="Информация диалога" description="Информация диалога">
    <template #content>
      <div class="flex min-h-full overflow-y-auto">
        <ProfileApplicationBar
          :profile="profile"
          :target="currentDialogTarget"
          :can-open-dialog="isDirectDialog"
          @close="emit('close', $event)"
          @open-dialog="openDialog"
          @updated="updateProfile"
        />
        <div class="flex flex-1 flex-col overflow-y-auto" ref="profileContentRef">
          <ProfileDetailsLoading v-if="loading" />
          <ProfileListError
            v-else-if="error"
            compact
            padded
            label="Не удалось загрузить профиль"
            @retry="fetchProfile"
          />

          <template v-else-if="profile">
            <ProfileInfo :profile="profile" />
            <ProfileQuickActions
              :profile="profile"
              :target="currentDialogTarget"
              :can-open-dialog="canOpenProfileDialog"
              :can-search="canSearch"
              @open-dialog="openDialog"
              @open-search="openSearch"
              @updated="updateProfile"
            />
            <UTabs
              class="flex-1"
              v-model="activeTab"
              size="lg"
              :items="items"
              :ui="{ list: 'top-14', content: 'h-full' }"
            >
              <template #audience>
                <ProfileUsers
                  :target="currentDialogTarget"
                  :enabled="isAudienceEnabled"
                  :active-tab="activeTab"
                  :current-member-role="profile.role"
                  :current-member-permissions="profile.permissions"
                  :dialog-type="profile.type"
                  :bottom-trigger="bottomTrigger"
                  :refresh-trigger="audienceRefreshTrigger"
                />
              </template>
              <template #media>
                <ProfileMedia
                  :target="currentDialogTarget"
                  :enabled="activeTab === 'media' && hasFileDialog"
                  :bottom-trigger="bottomTrigger"
                />
              </template>
              <template #file>
                <ProfileFiles
                  :target="currentDialogTarget"
                  :enabled="activeTab === 'file' && hasFileDialog"
                  :bottom-trigger="bottomTrigger"
                />
              </template>
              <template #link>
                <ProfileLinks
                  :target="currentDialogTarget"
                  :enabled="activeTab === 'link' && hasFileDialog"
                  :bottom-trigger="bottomTrigger"
                />
              </template>
              <template #groups>
                <ProfileGroups
                  :target="currentDialogTarget"
                  :enabled="isGroupsEnabled"
                  :active-tab="activeTab"
                  @close="emit('close', $event)"
                />
              </template>
            </UTabs>
          </template>
        </div>
      </div>
    </template>
  </USlideover>
</template>
