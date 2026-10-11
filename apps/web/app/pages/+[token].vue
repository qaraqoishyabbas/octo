<script setup lang="ts">
definePageMeta({ path: '/+:token', middleware: ['auth'] });
const route = useRoute();
const toast = useToast();
const dialogs = useDialogsStore();
const invitations = useInvitationsStore();
const token = computed(() => String(route.params.token ?? '').trim());

const joinInvite = async () => {
  const target = await invitations.join();
  if (target) {
    await dialogs.fetchData();
    await navigateTo(`/@${target}`, { replace: true });
  } else if (invitations.joinError) {
    toast.add({
      title: 'Не удалось присоединиться',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2500,
      close: false,
    });
  }
};
onMounted(() => {
  void invitations.fetchData(token.value);
});
watch(token, (value) => {
  void invitations.fetchData(value);
});
onBeforeUnmount(() => invitations.$reset());
</script>

<template>
  <div class="bg-default fixed inset-0 z-100 lg:relative lg:flex-1">
    <div class="flex min-h-svh flex-1 flex-col">
      <AppBar>
        <template v-slot:left>
          <UButton icon="i-ph-caret-left-bold" size="xl" variant="ghost" color="neutral" to="/" />
        </template>
      </AppBar>
      <div class="flex h-full w-full items-center justify-center">
        <InviteLoading v-if="invitations.loading" />
        <InviteError v-else-if="invitations.error" />
        <InviteCard
          v-else-if="invitations.current"
          :item="invitations.current"
          :joining="invitations.joining"
          @join="joinInvite"
        />
      </div>
    </div>
  </div>
</template>
