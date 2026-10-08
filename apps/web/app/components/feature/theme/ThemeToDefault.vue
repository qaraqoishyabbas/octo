<script setup lang="ts">
const colorMode = useColorMode();
const appConfig = useAppConfig();

const { confirm } = useConfirm();

const handleClick = () => {
  confirm({
    title: 'Сброс настроек',
    description: 'Вы точно хотите сбросить настройки темы?',
    confirmButtonText: 'Сброс',
    cancelButtonText: 'Отмена',
    onConfirm: async () => {
      colorMode.preference = 'system';
      window.localStorage.setItem('nuxt-ui-radius', '1');
      appConfig.theme.radius = 1;
      window.localStorage.setItem('nuxt-ui-primary', 'violet');
      appConfig.ui.colors.primary = 'violet';
    },
  });
};
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
        label="Восстановить тему по умолчанию"
        icon="i-ph-arrow-counter-clockwise-bold"
        @click="handleClick"
      />
    </div>
  </section>
</template>
