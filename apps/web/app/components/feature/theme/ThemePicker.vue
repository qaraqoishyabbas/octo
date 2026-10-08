<script setup lang="ts">
import colors from 'tailwindcss/colors';
import { nextTick } from 'vue';
import type { ComponentPublicInstance } from 'vue';

const appConfig = useAppConfig();
const colorMode = useColorMode();

const scrollContainer = ref<HTMLElement | null>(null);
const colorRefs = reactive<Record<string, HTMLElement | null>>({});

const primaryToNeutral = {
  red: 'stone',
  orange: 'stone',
  amber: 'taupe',
  yellow: 'olive',

  lime: 'olive',
  green: 'neutral',
  emerald: 'mist',

  teal: 'mist',
  cyan: 'mist',
  sky: 'slate',

  blue: 'slate',
  indigo: 'zinc',
  violet: 'mauve',
  purple: 'mauve',
  fuchsia: 'mauve',

  pink: 'taupe',
  rose: 'gray',
} as const;

const selectableColors = computed(() =>
  Object.entries(primaryToNeutral).map(([primaryName, neutralName]) => ({
    primary: {
      name: primaryName,
      shades: colors[primaryName as keyof typeof colors],
    },
    neutral: {
      name: neutralName,
      shades: colors[neutralName as keyof typeof colors],
    },
  })),
);

const primary = computed({
  get: () => appConfig.ui.colors.primary,
  set: (val: string) => {
    appConfig.ui.colors.primary = val;
    localStorage.setItem('nuxt-ui-primary', val);
  },
});

const neutral = computed({
  get: () => appConfig.ui.colors.neutral,
  set: (val: string) => {
    appConfig.ui.colors.neutral = val;
    localStorage.setItem('nuxt-ui-neutral', val);
  },
});

const getShade = (shades: Record<number, string>, light = 200, dark = 700) =>
  colorMode.value === 'dark' ? shades[dark] : shades[light];

const selectColor = async (p: string, n: string) => {
  primary.value = p;
  neutral.value = n;
  await scrollToActiveItem('smooth');
};

const getKey = (p: string, n: string) => `${p}-${n}`;

const setColorRef = (key: string, el: Element | ComponentPublicInstance | null) => {
  colorRefs[key] = el instanceof HTMLElement ? el : null;
};

const scrollToActiveItem = async (behavior: ScrollBehavior = 'instant') => {
  await nextTick();

  const container = scrollContainer.value;
  const key = getKey(primary.value, neutral.value);
  const target = colorRefs[key];

  if (container && target) {
    const scrollLeft = target.offsetLeft - container.clientWidth / 2 + target.offsetWidth / 2;

    container.scrollTo({ left: scrollLeft, behavior });
  }
};

watch([primary, neutral], () => scrollToActiveItem('smooth'));

onMounted(() => scrollToActiveItem());
</script>

<template>
  <section>
    <div class="px-5.5 py-1 text-base font-bold">Цветовая тема</div>

    <div
      class="mb-1 flex snap-x flex-nowrap space-x-2 overflow-x-auto px-4 py-1"
      ref="scrollContainer"
    >
      <div
        v-for="color in selectableColors"
        :key="getKey(color.primary.name, color.neutral.name)"
        :ref="(el) => setColorRef(getKey(color.primary.name, color.neutral.name), el)"
        :class="[
          'ring-primary-500 cursor-pointer snap-center space-y-2 rounded-md p-2',
          primary === color.primary.name && neutral === color.neutral.name ? 'ring-4' : '',
        ]"
        :style="{ backgroundColor: getShade(color.neutral.shades, 200, 700) }"
        @click="selectColor(color.primary.name, color.neutral.name)"
      >
        <div class="flex justify-center">
          <div
            class="h-4 w-10 rounded-md opacity-20"
            :style="{ backgroundColor: color.primary.shades[500] }"
          />
        </div>

        <div
          class="h-6 w-12 rounded-md"
          :style="{ backgroundColor: getShade(color.neutral.shades, 300, 800) }"
        />

        <div
          class="ml-10 h-6 w-16 rounded-md"
          :style="{ backgroundColor: color.primary.shades[500] }"
        />

        <div
          class="h-6 w-8 rounded-md"
          :style="{ backgroundColor: getShade(color.neutral.shades, 300, 800) }"
        />
      </div>
    </div>
  </section>
</template>
