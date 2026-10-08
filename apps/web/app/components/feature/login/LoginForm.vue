<script setup lang="ts">
import type { Form } from '#ui/types';
import type { LoginCredentials } from '~/stores/auth';

const emit = defineEmits<{ success: [] }>();
const props = defineProps<{ redirecting?: boolean }>();
const auth = useAuthStore();
const form = useTemplateRef<Form<LoginCredentials>>('form');
const showPassword = ref(false);
const state = reactive<LoginCredentials>({ username: '', password: '', remember: false });
const loading = computed(() => auth.loginStatus === 'pending' || Boolean(props.redirecting));

async function onSubmit() {
  if (await auth.authenticate(state)) {
    emit('success');
  } else if (auth.formErrors.length) {
    form.value?.setErrors(auth.formErrors);
  }
}
</script>

<template>
  <UForm class="space-y-3" ref="form" :state="state" @submit="onSubmit">
    <UFormField label="Логин" name="username">
      <UInput
        class="w-full"
        v-model="state.username"
        type="text"
        placeholder="Логин"
        size="xl"
        required
        autofocus
        :disabled="loading"
      />
    </UFormField>

    <UFormField label="Пароль" name="password">
      <UInput
        class="w-full"
        v-model="state.password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="*********"
        required
        size="xl"
        :disabled="loading"
      >
        <template v-slot:trailing>
          <UButton
            :icon="showPassword ? 'i-ph-eye-slash-bold' : 'i-ph-eye-bold'"
            color="neutral"
            variant="link"
            size="md"
            :disabled="loading"
            @click="showPassword = !showPassword"
          />
        </template>
      </UInput>
    </UFormField>
    <UTooltip :delay-duration="0" text="на 1 месяц" :content="{ side: 'right', align: 'center' }">
      <div class="inline-flex">
        <UCheckbox class="inline-flex" v-model="state.remember" label="Запомнить меня" />
      </div>
    </UTooltip>
    <UButton
      type="submit"
      size="xl"
      block
      color="primary"
      label="Авторизоваться"
      :loading="loading"
      :disabled="loading"
    />
  </UForm>
</template>
