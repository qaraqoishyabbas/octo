<script setup lang="ts">
const emit = defineEmits<{ close: [boolean] }>();
</script>
<template>
  <SettingDataAutoDownload profile="mobile" @close="emit('close', $event)" />
</template>
