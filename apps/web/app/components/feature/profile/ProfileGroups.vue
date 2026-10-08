<script setup lang="ts">
import type { DialogPreview } from '~/types';

const GROUPS_TAB_VALUE = 'groups';

const emit = defineEmits<{ (e: 'close', value: boolean): void }>();
const props = defineProps<{
  target?: string | null;
  enabled?: boolean;
  activeTab?: string | null;
}>();

const { withCount } = useInflection();
const normalizedTarget = computed(() => String(props.target ?? '').trim());
const hasGroupsAccess = computed(() => Boolean(props.enabled) && Boolean(normalizedTarget.value));
const isGroupsTabActive = computed(() => String(props.activeTab ?? '').trim() === GROUPS_TAB_VALUE);
const canLoad = computed(() => hasGroupsAccess.value && isGroupsTabActive.value);

const content = useProfileContentStore().createScope('groups');
const {
  list: groups,
  loading: groupsLoading,
  error: groupsError,
  loadedTarget,
} = toRefs(content.state);
onUnmounted(content.dispose);
const resetGroups = content.$reset;
const loadGroups = async (options?: { force?: boolean }) => {
  if (canLoad.value) await content.fetchData(normalizedTarget.value, options);
};

const openGroup = async (item: DialogPreview) => {
  const target = String(item.username || item.dialog_id || '').trim();

  if (!target) {
    return;
  }

  await navigateTo(`/@${target}`);
  emit('close', false);
};

const usersCountText = (count?: number | null) =>
  withCount(Number(count ?? 0), ['участник', 'участника', 'участников']);

watch(
  () => [normalizedTarget.value, hasGroupsAccess.value],
  async () => {
    resetGroups();
    if (canLoad.value) {
      await loadGroups();
    }
  },
  { immediate: true },
);

watch(
  () => canLoad.value,
  async (value) => {
    if (
      !value ||
      groups.value.length > 0 ||
      groupsLoading.value ||
      loadedTarget.value === normalizedTarget.value
    ) {
      return;
    }

    await loadGroups();
  },
);
</script>

<template>
  <div class="h-full">
    <ProfileListLoading v-if="groupsLoading" />
    <ProfileListError
      v-else-if="groupsError"
      padded
      label="Не удалось загрузить группы"
      @retry="loadGroups({ force: true })"
    />

    <div v-else-if="groups.length > 0">
      <div v-for="(item, index) in groups" :key="item.dialog_id">
        <Item @click="openGroup(item)">
          <template v-slot:avatar>
            <UAvatar
              size="3xl"
              :alt="item.title"
              :src="$storage(item.avatar)"
              :class="{ 'rounded-[0.75rem]': item.type === 'G' || item.type === 'C' }"
            />
          </template>
          <template v-slot:heading>
            {{ item.title }}
          </template>
          <template v-slot:description>
            {{ usersCountText(item.users_count) }}
          </template>
        </Item>
      </div>
    </div>
    <ProfileListEmpty v-else-if="canLoad" padded label="Нет общих групп" />
  </div>
</template>
