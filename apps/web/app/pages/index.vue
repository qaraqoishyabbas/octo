<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });

const dialog = useDialogStore();
const messages = useMessagesStore();

onMounted(() => {
  dialog.$reset();
  messages.$reset();
});
</script>
<template>
  <div class="hidden h-dvh w-full items-center justify-center lg:flex">
    <UBadge color="neutral" variant="soft" size="lg" label="Здесь будут ваши диалоги" />
  </div>
</template>
