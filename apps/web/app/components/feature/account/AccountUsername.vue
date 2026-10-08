<script setup lang="ts">
import type { Form } from '#ui/types';

const emit = defineEmits<{ close: [boolean] }>();
useSeoMeta({ title: 'Имя пользователя' });

const auth = useAuthStore();
const account = useAccountStore();
const form = useTemplateRef<Form<Record<string, unknown>>>('form');

const state = reactive({
  username: auth.user.username,
});

const usernameError = ref('');

const loading = computed(() => account.status.username === 'pending');

async function handleSubmit() {
  usernameError.value = '';
  if (await account.updateUsername(state.username)) {
    state.username = auth.user.username;
    emit('close', false);
  } else {
    usernameError.value =
      account.formErrors.username.find((error) => error.name === 'username')?.message ?? '';
  }
}

watch(
  () => state.username,
  () => {
    usernameError.value = '';
  },
);
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
            icon="i-ph-caret-left-bold"
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
      <UForm class="space-y-4 px-2.5 pb-4" ref="form" :state="state" @submit.prevent="handleSubmit">
        <section>
          <div class="bg-elevated rounded-md px-3 py-2">
            <UFormField name="username">
              <UInput
                class="w-full px-0 py-0"
                v-model="state.username"
                :disabled="loading"
                color="neutral"
                variant="none"
                size="xl"
                placeholder="Имя пользователя"
                maxlength="30"
                :ui="{ base: 'p-0 rounded-none' }"
              />
            </UFormField>
          </div>
          <div class="px-3 pt-2 text-xs font-normal text-pretty text-red-500" v-if="usernameError">
            {{ usernameError }}
          </div>
        </section>
        <section>
          <div class="text-muted px-3 text-xs font-normal text-pretty">
            <div>
              Вы можете выбрать публичное имя пользователя. В этом случае другие люди смогут найти
              Вас по такому имени и связаться, не зная Вашего телефона.
            </div>
            <br />
            <div>
              Можно использовать символы a-z, 0-9, точку, дефис и подчёркивание. Минимальная длина
              имени - 3 символа.
            </div>
          </div>
        </section>
      </UForm>
    </template>
  </USlideover>
</template>
