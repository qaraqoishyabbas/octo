<script setup lang="ts">
const colorMode = useColorMode();
const isDark = computed({
  get() {
    return colorMode.value === 'dark';
  },
  set() {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
  },
});
const isSystem = computed({
  get() {
    return colorMode.preference === 'system';
  },
  set() {
    colorMode.preference = colorMode.preference === 'system' ? colorMode.value : 'system';
  },
});
</script>

<template>
  <section>
    <div class="bg-elevated rounded-md">
      <UButton
        class="justify-start"
        block
        size="xl"
        color="neutral"
        variant="soft"
        :label="!isDark ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'"
        :icon="!isDark ? 'i-ph-moon-bold' : 'i-ph-sun-bold'"
        @click="isDark = !isDark"
      />
      <UButton
        class="justify-between"
        block
        size="xl"
        color="neutral"
        variant="soft"
        @click="isSystem = !isSystem"
      >
        <div class="flex justify-center gap-2">
          <UIcon class="size-6 shrink-0" name="i-ph-devices-bold" />
          Тема устройства (как в системе)
        </div>
        <template v-slot:trailing>
          <USwitch
            v-model="isSystem"
            size="xl"
            checked-icon="i-ph-check-bold"
            unchecked-icon="i-ph-x-bold"
            @click="isSystem = !isSystem"
          />
        </template>
      </UButton>
    </div>
  </section>
</template>
