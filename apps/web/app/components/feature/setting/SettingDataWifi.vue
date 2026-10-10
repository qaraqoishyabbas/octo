<script setup lang="ts">
const emit = defineEmits<{ close: [boolean] }>();
</script>
<template>
  <SettingDataAutoDownload profile="wifi" @close="emit('close', $event)" />
</template>
