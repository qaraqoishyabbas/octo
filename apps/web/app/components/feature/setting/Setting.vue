<script setup lang="ts">
import {
  Account,
  AccountShare,
  Device,
  SettingChatFolders,
  SettingLanguage,
  SettingNotifications,
  Theme,
} from '#components';
useSeoMeta({ title: 'Настройки' });
const overlay = useOverlay();
const auth = useAuthStore();
const { confirm } = useConfirm();
const { locale, locales } = useI18n();

const currentLocaleName = computed(() => {
  return locales.value.find((l) => l.code === locale.value)?.name;
});

const openSaves = async () => {
  await navigateTo(`/@${auth.user.dialog_id}`);
};

const logout = () => {
  confirm({
    title: 'Выйти из системы?',
    description: 'Вы уверены, что хотите завершить сеанс?',
    confirmButtonText: 'Выйти',
    confirmButtonColor: 'error',
    cancelButtonText: 'Отмена',
    onConfirm: async () => {
      await auth.logout();
      await navigateTo('/login');
    },
  });
};
</script>

<template>
  <AppBar>
    <template v-slot:left>
      <UButton
        size="xl"
        variant="soft"
        color="neutral"
        icon="i-ph-qr-code-bold"
        @click="overlay.create(AccountShare).open()"
      />
    </template>
    <template v-slot:right>
      <UButton
        size="xl"
        variant="soft"
        color="neutral"
        label="Изм."
        @click="overlay.create(Account).open()"
      />
    </template>
  </AppBar>
  <div class="space-y-4 px-2.5">
    <SettingUser />
    <div class="bg-elevated rounded-md">
      <UButton
        class="justify-start"
        block
        size="xl"
        color="primary"
        variant="soft"
        icon="i-ph-camera-plus-bold"
        label="Изменить фотографию"
        @click="overlay.create(Account).open()"
      />
    </div>
    <div class="bg-elevated rounded-md">
      <UButton
        class="justify-start"
        block
        color="neutral"
        size="xl"
        variant="soft"
        icon="i-ph-bookmark-simple-bold"
        label="Избранное"
        trailing-icon="i-ph-caret-right-bold"
        @click="openSaves"
      />
      <UButton
        class="justify-start"
        block
        color="neutral"
        size="xl"
        variant="soft"
        icon="i-ph-phone-call-bold"
        label="Недавние звонки"
        disabled
        trailing-icon="i-ph-caret-right-bold"
      />
      <UButton
        class="justify-start"
        block
        color="neutral"
        size="xl"
        variant="soft"
        icon="i-ph-devices-bold"
        label="Устройства"
        trailing-icon="i-ph-caret-right-bold"
        @click="overlay.create(Device).open()"
      />
      <UButton
        class="justify-start"
        block
        color="neutral"
        size="xl"
        variant="soft"
        icon="i-ph-folder-bold"
        label="Папки с чатами"
        @click="overlay.create(SettingChatFolders).open()"
        trailing-icon="i-ph-caret-right-bold"
      />
    </div>
    <div class="bg-elevated rounded-md">
      <UButton
        class="justify-start"
        block
        color="neutral"
        size="xl"
        variant="soft"
        icon="i-ph-bell-ringing-bold"
        label="Уведомления и звук"
        trailing-icon="i-ph-caret-right-bold"
        @click="overlay.create(SettingNotifications).open()"
      />
      <UButton
        class="justify-start"
        block
        disabled
        color="neutral"
        size="xl"
        variant="soft"
        icon="i-ph-lock-key-bold"
        label="Конфиденциальность"
        trailing-icon="i-ph-caret-right-bold"
      />
      <UButton
        class="justify-start"
        block
        disabled
        color="neutral"
        size="xl"
        variant="soft"
        icon="i-ph-database-bold"
        label="Данные и память"
        trailing-icon="i-ph-caret-right-bold"
      />
      <UButton
        class="justify-start"
        block
        color="neutral"
        size="xl"
        variant="soft"
        icon="i-ph-palette-bold"
        label="Оформление"
        trailing-icon="i-ph-caret-right-bold"
        @click="overlay.create(Theme).open()"
      />
      <UButton
        class="justify-start"
        block
        disabled
        color="neutral"
        size="xl"
        variant="soft"
        icon="i-ph-battery-charging-bold"
        label="Энергосбережение"
        trailing-icon="i-ph-caret-right-bold"
      />
      <UButton
        class="justify-start"
        block
        size="xl"
        color="neutral"
        variant="soft"
        label="Язык"
        icon="i-ph-translate-bold"
        @click="overlay.create(SettingLanguage).open()"
      >
        <div class="flex w-full justify-between">
          <span class="truncate">Язык</span>
          <div class="text-muted">{{ currentLocaleName }}</div>
        </div>
      </UButton>
    </div>
    <SettingDialog />

    <div class="bg-elevated rounded-md">
      <UButton
        class="justify-start"
        block
        color="error"
        size="xl"
        variant="soft"
        icon="i-ph-sign-out-bold"
        label="Выйти"
        @click="logout"
      />
    </div>
  </div>
</template>
