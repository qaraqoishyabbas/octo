<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { DialogPreview } from '~/types';
import { ChannelListSearch } from '#components';

useSeoMeta({ title: 'Список каналов' });
const emit = defineEmits<{ close: [boolean] }>();
const { withCount } = useInflection();
const overlay = useOverlay();
const store = useChannelsStore();
const { list: channels, loading, pageInLoading: initialLoading, error } = storeToRefs(store);
const subscribersText = (count: number) =>
  withCount(count, ['подписчик', 'подписчика', 'подписчиков']);
const openChannel = async (channel: DialogPreview) => {
  await navigateTo(`/@${channel.dialog_id}`);
  emit('close', false);
};
onMounted(() => {
  void store.fetchData({ reset: true });
});
</script>
<template>
  <USlideover side="left">
    <template v-slot:content>
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
        <template v-slot:center> Список каналов </template>
        <template v-slot:right>
          <UButton
            icon="i-ph-magnifying-glass-bold"
            size="xl"
            variant="soft"
            color="neutral"
            @click="overlay.create(ChannelListSearch).open()"
          />
        </template>
      </AppBar>

      <ChannelListLoading v-if="initialLoading" />
      <ChannelListError v-else-if="error" @retry="store.fetchData" />
      <div class="w-full flex-1" v-else-if="channels.length > 0">
        <Item v-for="channel in channels" :key="channel.id" @click="openChannel(channel)">
          <template v-slot:avatar>
            <UAvatar
              class="rounded-[0.75rem]"
              size="3xl"
              :alt="channel.title ?? 'Канал'"
              :src="$storage(channel.avatar)"
            />
          </template>
          <template v-slot:heading>{{ channel.title }}</template>
          <template v-slot:description>{{ subscribersText(channel.users_count) }}</template>
        </Item>
      </div>
      <ChannelListEmpty v-else />
    </template>
  </USlideover>
</template>
