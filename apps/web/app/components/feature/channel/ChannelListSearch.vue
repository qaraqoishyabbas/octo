<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useDebounceFn } from '@vueuse/core';
import type { DialogPreview } from '~/types';

const emit = defineEmits<{ close: [boolean] }>();
const { withCount } = useInflection();
const store = useChannelsStore();
const {
  searchList: channels,
  searchQuery,
  searchLoading: loading,
  searchError: error,
} = storeToRefs(store);
const subscribersText = (count: number) =>
  withCount(count, ['подписчик', 'подписчика', 'подписчиков']);
let disposed = false;
const searchChannels = useDebounceFn(() => {
  if (!disposed) return store.fetchSearchData();
}, 400);
const onSearchInput = () => {
  store.invalidateSearch();
  void searchChannels();
};
const openChannel = async (channel: DialogPreview) => {
  await navigateTo(`/@${channel.dialog_id}`);
  emit('close', false);
};
onBeforeUnmount(() => {
  disposed = true;
  store.closeSearch();
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
        <template v-slot:input>
          <UInput
            class="w-full"
            v-model="searchQuery"
            :highlight="false"
            icon="i-ph-magnifying-glass-bold"
            placeholder="Поиск"
            variant="none"
            autofocus
            size="xl"
            @input="onSearchInput"
          />
        </template>
      </AppBar>

      <ChannelListLoading v-if="loading" />
      <ChannelListError v-else-if="error" @retry="store.fetchSearchData" />
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
      <ChannelListEmpty v-else-if="searchQuery.trim().length > 0" />
    </template>
  </USlideover>
</template>
