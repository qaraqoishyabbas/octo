<script setup lang="ts">
import type { MessageLink } from '~/types';

const props = defineProps<{
  target?: string | null;
  enabled?: boolean;
  bottomTrigger?: number;
}>();

const content = useProfileContentStore().createScope('links');
const { loading, loadingMore, error, list: links } = toRefs(content.state);
onUnmounted(content.dispose);
const dayjs = useDayjs();

type LinkMonthGroup = {
  key: string;
  label: string;
  links: MessageLink[];
};

const getLinkMonthKey = (link: MessageLink) => {
  if (!link.created_at) {
    return 'unknown';
  }

  const parsed = dayjs(link.created_at);

  return parsed.isValid() ? parsed.format('YYYY-MM') : 'unknown';
};

const formatLinkMonthLabel = (monthKey: string) => {
  if (monthKey === 'unknown') {
    return 'Без даты';
  }

  return dayjs(`${monthKey}-01`).format('MMMM YYYY');
};

const groupedLinks = computed<LinkMonthGroup[]>(() => {
  const groups: LinkMonthGroup[] = [];
  const groupsByMonth = new Map<string, LinkMonthGroup>();

  links.value.forEach((link) => {
    const monthKey = getLinkMonthKey(link);
    let group = groupsByMonth.get(monthKey);

    if (!group) {
      group = {
        key: monthKey,
        label: formatLinkMonthLabel(monthKey),
        links: [],
      };
      groupsByMonth.set(monthKey, group);
      groups.push(group);
    }

    group.links.push(link);
  });

  return groups;
});

const resetLinks = () => {
  content.$reset();
};
const fetchLinks = async (options?: { force?: boolean }) => {
  if (!props.enabled || !props.target) {
    resetLinks();
    return;
  }
  await content.fetchData(props.target, options);
};

const displayTitle = (link: MessageLink) => link.title || link.url;

watch(
  () => [props.target, props.enabled],
  () => {
    resetLinks();
    void fetchLinks();
  },
  { immediate: true },
);

watch(
  () => Number(props.bottomTrigger ?? 0),
  () => {
    if (props.enabled) {
      void fetchLinks();
    }
  },
);
</script>

<template>
  <div class="h-full">
    <ProfileListLoading v-if="loading" />
    <ProfileListError
      v-else-if="error"
      :badge="false"
      label="Не удалось загрузить ссылки"
      @retry="fetchLinks()"
    />
    <ProfileListEmpty v-else-if="links.length === 0" />
    <div class="space-y-5" v-else>
      <section v-for="group in groupedLinks" :key="group.key">
        <div class="bg-elevated text-muted p-4 py-1 text-sm font-bold">{{ group.label }}</div>
        <div v-for="link in group.links" :key="link.id">
          <a class="block" :href="link.url" target="_blank" rel="noopener noreferrer nofollow">
            <Item class="group bg-transparent hover:bg-neutral-500/10">
              <template #avatar>
                <UAvatar class="rounded-[0.75rem]" size="3xl" icon="i-ph-link-bold" />
              </template>
              <template #heading>
                <span class="line-clamp-1">{{ displayTitle(link) }}</span>
              </template>
              <template #description>
                <span class="line-clamp-2">{{ link.url }}</span>
              </template>
            </Item>
          </a>
        </div>
      </section>
      <ProfileListLoading v-if="loadingMore" more />
    </div>
  </div>
</template>
