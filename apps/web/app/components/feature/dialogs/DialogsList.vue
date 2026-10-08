<script lang="ts" setup>
const dialogsWrapper = ref<HTMLDivElement | null>(null);
const dialogs = useDialogsStore();
const auth = useAuthStore();
const drafts = useMessagesDraftStore();
const target = useRoute().params.target as string;

const scrollToTop = () => dialogsWrapper.value?.scrollTo({ top: 0, behavior: 'smooth' });

const scrollToByTarget = (target: string) => {
  const wrapper = dialogsWrapper.value;
  const el = wrapper?.querySelector<HTMLElement>(
    `[data-dialog-id="${target}"], [data-dialog-target="${target}"]`,
  );
  if (!wrapper || !el) return;
  wrapper.scrollTo({ top: el.offsetTop - wrapper.offsetTop - 28 });
};

defineExpose({ scrollToTop });

watch(
  () => auth.user?.id,
  (userId) => drafts.loadUser(userId),
  { immediate: true },
);

onMounted(async () => {
  if (target) {
    await nextTick();
    scrollToByTarget(target);
  }
});
</script>
<template>
  <div class="w-full flex-1" ref="dialogsWrapper">
    <template v-for="item in dialogs.filteredList" :key="item.id">
      <DialogsListItem :item="item" />
    </template>
  </div>
</template>
