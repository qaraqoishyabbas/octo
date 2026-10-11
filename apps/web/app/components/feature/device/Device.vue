<script setup lang="ts">
useSeoMeta({ title: 'Устройства' });
const emit = defineEmits<{ close: [boolean] }>();
const devices = useDevicesStore();
onMounted(() => {
  void devices.fetchData();
});
</script>

<template>
  <USlideover side="left">
    <template v-slot:content>
      <AppBar>
        <template v-slot:left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            @click="emit('close', false)"
          />
        </template>
        <template v-slot:center>Устройства</template>
      </AppBar>
      <DeviceList />
    </template>
  </USlideover>
</template>
