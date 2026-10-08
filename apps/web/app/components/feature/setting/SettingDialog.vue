<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core';

const isEnterMode = useLocalStorage('nuxt-send-on-enter', true);
const toggleEnterMode = computed({
  get() {
    return isEnterMode.value;
  },
  set() {
    isEnterMode.value = !isEnterMode.value;
  },
});
</script>

<template>
  <section>
    <div class="px-3 py-1 text-base font-bold">Прочие настройки</div>
    <div class="bg-elevated rounded-md">
      <UButton
        class="justify-between"
        block
        size="xl"
        color="neutral"
        variant="ghost"
        label="Отправка по Enter"
        @click="toggleEnterMode = !toggleEnterMode"
      >
        <template v-slot:trailing>
          <USwitch
            v-model="toggleEnterMode"
            size="xl"
            checked-icon="i-ph-check-bold"
            unchecked-icon="i-ph-x-bold"
            @click="toggleEnterMode = !toggleEnterMode"
          />
        </template>
      </UButton>
    </div>
  </section>
</template>
