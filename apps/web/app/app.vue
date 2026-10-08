<script setup lang="ts">
const appConfig = useAppConfig();
const radius = computed(() => `:root { --ui-radius: ${appConfig.theme.radius}rem; }`);
import * as locales from '@nuxt/ui/locale';
const { locale } = useI18n();
import dayjs from 'dayjs';
const lang = computed(() => locales[locale.value].code);
const dir = computed(() => locales[locale.value].dir);
watch(
  locale,
  (newLocale) => {
    dayjs.locale(newLocale);
  },
  { immediate: true },
);
useHead({
  style: [{ innerHTML: radius, id: 'nuxt-ui-radius', tagPriority: -2 }],
  bodyAttrs: { class: 'select-none' },
  htmlAttrs: { lang, dir },
});

onMounted(() => document.addEventListener('contextmenu', (event) => event.preventDefault()));
</script>

<template>
  <UApp
    :toaster="{
      position: 'bottom-left',
      class: 'max-w-full w-full sm:w-full left-0 px-4 lg:max-w-md',
    }"
    :locale="locales[locale]"
  >
    <NuxtLoadingIndicator class="!opacity-50" :height="2" :throttle="0" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
