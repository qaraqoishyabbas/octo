<script setup lang="ts">
import type { Form } from '#ui/types';
import { AccountUsername } from '#components';

const emit = defineEmits<{ close: [boolean] }>();
useSeoMeta({ title: 'Изменить профиль' });

const auth = useAuthStore();
const account = useAccountStore();
const overlay = useOverlay();
const form = useTemplateRef<Form<Record<string, unknown>>>('form');

const { confirm } = useConfirm();

const state = reactive({
  ...{
    email: auth.user.email,
    name: auth.user.name,
    first_name: auth.user.first_name,
    last_name: auth.user.last_name,
    bio: auth.user.bio,
    avatar: auth.user.avatar,
  },
});

async function onSubmit() {
  if (await account.updateProfile(state)) {
    state.name = auth.user.name;
    state.first_name = auth.user.first_name;
    state.last_name = auth.user.last_name;
    state.bio = auth.user.bio;
    state.email = auth.user.email;
    state.avatar = auth.user.avatar;
    emit('close', false);
  } else if (account.formErrors.profile.length) {
    form.value?.setErrors(account.formErrors.profile);
  }
}

const loading = computed(() => account.status.profile === 'pending');

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
  <USlideover side="left">
    <template v-slot:content>
      <AppBar>
        <template v-slot:left>
          <UButton
            size="xl"
            color="neutral"
            variant="soft"
            label="Отмена"
            @click="emit('close', false)"
            :disabled="loading"
          />
        </template>
        <template v-slot:right>
          <UButton
            size="xl"
            color="primary"
            variant="soft"
            label="Готово"
            type="submit"
            :loading="loading"
            :disabled="loading"
            @click="form?.submit()"
          />
        </template>
      </AppBar>

      <div class="space-y-4 px-2.5 pb-4">
        <UForm class="space-y-4" ref="form" :state="state" @submit.prevent="onSubmit">
          <section>
            <div class="pb-6">
              <UFormField label="" name="avatar">
                <AvatarUploader v-model="state.avatar">
                  <UAvatar
                    class="size-28 rounded-full text-4xl uppercase"
                    :src="$storage(state.avatar)"
                    :alt="state.first_name + ' ' + state.last_name"
                    img-class="object-cover"
                  />
                </AvatarUploader>
              </UFormField>
            </div>
            <div class="bg-elevated flex flex-col items-center gap-2 rounded-md px-2 py-2">
              <UFormField class="w-full" name="first_name">
                <UInput
                  class="w-full"
                  v-model="state.first_name"
                  :disabled="loading"
                  variant="none"
                  maxlength="64"
                  size="xl"
                  placeholder="Имя"
                />
              </UFormField>
              <USeparator class="px-2" :ui="{ border: 'border-accented' }" />
              <UFormField class="w-full" name="last_name">
                <UInput
                  class="bg-elevated w-full"
                  v-model="state.last_name"
                  :disabled="loading"
                  variant="none"
                  maxlength="64"
                  size="xl"
                  placeholder="Фамилия"
                />
              </UFormField>
            </div>
            <div class="text-muted px-3 pt-2 text-xs font-normal text-pretty">
              Пожалуйста, добавьте имя и фотографию. Это имя отображается в списке контактов и
              комментариях.
            </div>
          </section>
          <section>
            <div class="px-3 py-1 text-base font-bold">О себе</div>
            <div class="bg-elevated flex items-center gap-2 rounded-md">
              <InputTextarea
                v-model="state.bio"
                :disabled="loading"
                :maxLength="70"
                placeholder="Немного о себе (необязательно)"
              />
            </div>
            <div class="text-muted px-3 pt-2 text-xs font-normal text-pretty">
              Расскажите немного о себе, например: возраст, род занятий или город. Пример: 23 года,
              дизайнер из Алматы(Казахстан).
            </div>
          </section>
          <section>
            <div class="px-3 py-1 text-base font-bold">Электронная почта</div>
            <div class="bg-elevated flex items-center gap-2 rounded-md px-3 py-2">
              <UInput
                class="w-full px-0 py-0"
                color="neutral"
                variant="none"
                size="xl"
                placeholder="Email"
                :value="auth.user.email"
                :ui="{ base: 'p-0 rounded-none' }"
                disabled
              />
            </div>
          </section>
          <section>
            <div class="bg-elevated rounded-md">
              <AccountBirthDate />
            </div>
          </section>
          <section>
            <div class="bg-elevated rounded-md">
              <UButton
                class="w-full justify-between"
                block
                size="xl"
                color="neutral"
                variant="ghost"
                label="Имя пользователя"
                :trailing="true"
                @click="overlay.create(AccountUsername).open()"
              >
                <template v-slot:trailing>
                  <div class="text-muted">@{{ auth.user.username }}</div>
                </template>
              </UButton>
              <USeparator />
              <UButton
                class="w-full justify-between"
                block
                size="xl"
                color="neutral"
                variant="ghost"
                label="Номер телефона"
                :trailing="true"
                disabled
              >
                <template v-slot:trailing>
                  <div class="text-muted">Указать</div>
                </template>
              </UButton>
            </div>
          </section>
        </UForm>
        <section>
          <div class="bg-elevated rounded-md">
            <UButton
              class="justify-start"
              block
              size="xl"
              color="error"
              variant="ghost"
              label="Выйти из аккаунта"
              icon="i-ph-sign-out-bold"
              @click="logout"
            />
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>
