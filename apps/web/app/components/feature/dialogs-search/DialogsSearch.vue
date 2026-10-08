<script setup lang="ts">
const dialogsSearch = useDialogsSearchStore();
const { query, usersLoading, usersError, isSearching, suggestedDialogs, contactResults } =
  storeToRefs(dialogsSearch);

const emit = defineEmits<{
  (e: 'close', value: boolean): void;
}>();

const closePanel = () => {
  emit('close', false);
};

const openDialog = async (target: string) => {
  if (!target) return;

  await navigateTo(`/@${target}`);
  closePanel();
};

onMounted(() => {
  dialogsSearch.init();
});

onBeforeUnmount(() => {
  dialogsSearch.dispose();
});
</script>

<template>
  <USlideover side="left" title="Поиск" description="Поиск диалогов">
    <template v-slot:content>
      <AppBar>
        <template v-slot:left>
          <UButton
            v-if="isSearching"
            icon="i-ph-x-bold"
            size="xl"
            color="neutral"
            variant="ghost"
            @click="dialogsSearch.closeSearch"
          />
          <UButton
            v-else
            icon="i-ph-caret-left-bold"
            size="xl"
            color="neutral"
            variant="ghost"
            @click="closePanel"
          />
        </template>

        <template v-slot:input>
          <UInput
            class="w-full"
            v-model="query"
            :highlight="false"
            icon="i-ph-magnifying-glass-bold"
            placeholder="Поиск"
            size="xl"
            autofocus
            variant="none"
            @input="dialogsSearch.search"
          />
        </template>
      </AppBar>
      <template v-if="!isSearching">
        <section>
          <div class="flex snap-x flex-nowrap overflow-x-auto">
            <button
              class="hover:bg-elevated flex max-w-20 min-w-20 cursor-pointer snap-center flex-col items-center space-y-2 rounded-md px-2 py-1 text-left"
              v-for="dialog in suggestedDialogs"
              :key="dialog.dialog_id"
              type="button"
              @click="openDialog(dialog.username || dialog.dialog_id)"
            >
              <UAvatar
                class="size-18 text-4xl uppercase"
                size="3xl"
                :src="$storage(dialog.avatar)"
                :alt="dialog.title"
                :class="{ 'rounded-[0.75rem]': dialog.type === 'G' || dialog.type === 'C' }"
              />
              <div
                class="line-clamp-1 truncate text-center text-xs wrap-anywhere whitespace-pre-line"
              >
                {{ dialog.title }}
              </div>
            </button>
          </div>
        </section>
      </template>
      <template v-else>
        <section v-if="contactResults.length > 0">
          <div class="bg-elevated p-4 py-1 text-base font-bold">Контакты и чаты</div>
          <button
            class="block w-full text-left"
            v-for="item in contactResults"
            :key="item.key"
            type="button"
            @click="openDialog(item.target)"
          >
            <Item>
              <template v-slot:avatar>
                <UAvatar
                  size="3xl"
                  :alt="item.title"
                  :src="$storage(item.avatar)"
                  :class="{ 'rounded-[0.75rem]': item.type === 'G' || item.type === 'C' }"
                />
              </template>
              <template v-slot:heading>{{ item.title }}</template>
              <template v-slot:description>
                <span :class="{ 'text-primary': item.is_online }">{{ item.description }}</span>
              </template>
            </Item>
          </button>
        </section>
        <div class="flex h-full items-center justify-center" v-else-if="usersLoading">
          <UBadge color="neutral" variant="soft" size="lg">
            <UIcon class="animate-spin" name="i-ph-spinner-gap" />
            Загрузка
          </UBadge>
        </div>
        <div class="flex h-full items-center justify-center" v-else-if="usersError">
          <UBadge color="error" variant="soft" label="Не удалось загрузить контакты" size="lg" />
        </div>
        <div
          class="flex h-full items-center justify-center"
          v-if="!usersLoading && !usersError && contactResults.length === 0"
        >
          <UBadge label="Ничего не найдено" color="neutral" variant="soft" size="lg" />
        </div>
      </template>
    </template>
  </USlideover>
</template>
