<script setup lang="ts">
const emit = defineEmits<{ close: [boolean] }>();
useSeoMeta({ title: 'Внешний вид' });

const showCustomTheme = ref(false);
let clickCount = 0;
let clickTimer: ReturnType<typeof setTimeout> | null = null;
let pressTimer: ReturnType<typeof setTimeout> | null = null;

const trigger = () => {
  if (clickTimer) clearTimeout(clickTimer);
  clickCount += 1;
  if (clickCount >= 3) {
    showCustomTheme.value = true;
    clickCount = 0;
    return;
  }
  clickTimer = setTimeout(() => {
    clickCount = 0;
  }, 800);
};
const up = () => {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
};
const down = () => {
  up();
  pressTimer = setTimeout(() => {
    showCustomTheme.value = true;
  }, 1500);
};
onBeforeUnmount(() => {
  up();
  if (clickTimer) clearTimeout(clickTimer);
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
        <template v-slot:center>
          <span
            @click="trigger"
            @pointerdown="down"
            @pointerup="up"
            @pointercancel="up"
            @pointerleave="up"
          >
            Внешний вид
          </span>
        </template>
      </AppBar>
      <div class="space-y-4 pb-4">
        <ThemeExample />
        <ThemePicker />
        <ThemePickerCustom v-if="showCustomTheme" />
        <div class="space-y-4 px-2.5">
          <ThemeSwitcher />
          <ThemeRadius />
          <ThemeToDefault />
        </div>
      </div>
    </template>
  </USlideover>
</template>
