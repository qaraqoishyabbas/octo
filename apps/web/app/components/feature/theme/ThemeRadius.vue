<script setup lang="ts">
const appConfig = useAppConfig();
const radius = computed({
  get() {
    return appConfig.theme.radius;
  },
  set(option) {
    appConfig.theme.radius = option;
    window.localStorage.setItem('nuxt-ui-radius', String(appConfig.theme.radius));
  },
});
</script>

<template>
  <section>
    <div class="px-3 py-1 text-base font-bold">Углы блоков</div>
    <div class="bg-elevated rounded-md">
      <div class="flex space-x-4 px-3 py-2">
        <USlider v-model="radius" :step="0.1" :default-value="0.6" :max="1" :min="0" />
        <span class="text-primary">{{ (radius * 100).toFixed() }}</span>
      </div>
    </div>
  </section>
</template>
