<script setup lang="ts">
import colors from 'tailwindcss/colors';

const colorsNames = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'taupe',
  'mauve',
  'mist',
  'olive',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const;

const selectableColors = colorsNames.map((name) => ({
  name,
  shades: colors[name as keyof typeof colors],
}));

const appConfig = useAppConfig();
const selectPrimary = (option) => {
  appConfig.ui.colors.primary = option;
  window.localStorage.setItem('nuxt-ui-primary', appConfig.ui.colors.primary);
};
const selectNeutral = (option) => {
  appConfig.ui.colors.neutral = option;
  window.localStorage.setItem('nuxt-ui-neutral', appConfig.ui.colors.neutral);
};
</script>

<template>
  <section class="select-text">
    <div class="px-7 py-1 text-base font-bold">neutral</div>
    <div class="mb-1 flex snap-x flex-nowrap space-x-2 overflow-x-auto px-4 py-1">
      <div
        class="cursor-pointer rounded-md"
        v-for="color in selectableColors"
        @click="selectNeutral(color.name)"
      >
        <div class="h-8 w-20 rounded-md p-2" :style="{ backgroundColor: color.shades[500] }">
          {{ color.name }}
        </div>
      </div>
    </div>
    <div class="px-7 py-1 text-base font-bold">primary</div>
    <div class="mb-1 flex snap-x flex-nowrap space-x-2 overflow-x-auto px-4 py-1">
      <div
        class="cursor-pointer rounded-md"
        v-for="color in selectableColors"
        @click="selectPrimary(color.name)"
      >
        <div class="h-8 w-20 rounded-md p-2" :style="{ backgroundColor: color.shades[500] }">
          {{ color.name }}
        </div>
      </div>
    </div>
  </section>
</template>
