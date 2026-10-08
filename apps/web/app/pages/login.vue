<script lang="ts" setup>
definePageMeta({ layout: 'empty', middleware: ['guest'] });
useSeoMeta({ title: 'Авторизация' });

const router = useRouter();
const route = useRoute();
const toast = useToast();
const redirecting = ref(false);

const redirectPath = computed(() => {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '';

  if (!redirect.startsWith('/') || redirect.startsWith('//') || redirect === '/login') {
    return '/';
  }

  return redirect;
});

async function handleSuccess() {
  redirecting.value = true;
  try {
    await router.push(redirectPath.value);
  } finally {
    redirecting.value = false;
  }
}

function handleMessage(event: MessageEvent<unknown>): void {
  if (
    event.data &&
    typeof event.data === 'object' &&
    'message' in event.data &&
    typeof event.data.message === 'string' &&
    event.data.message
  ) {
    toast.add({
      icon: 'i-heroicons-exclamation-circle-solid',
      color: 'error',
      title: event.data.message,
    });
  }
}

onMounted(() => window.addEventListener('message', handleMessage));
onBeforeUnmount(() => window.removeEventListener('message', handleMessage));
</script>

<template>
  <div class="mx-auto w-full max-w-xl">
    <div class="flex h-dvh w-full flex-col justify-center space-y-6 px-4">
      <div class="flex flex-col">
        <div class="text-highlighted text-2xl font-semibold text-pretty">
          Войдите в свою учетную запись <span class="text-primary font-black">Octo</span>
        </div>
        <div class="text-muted mt-1 text-base text-pretty">
          Ваше рабочее пространство с искусственным интеллектом.
        </div>
      </div>
      <div class="flex flex-col space-y-4">
        <LoginForm :redirecting="redirecting" @success="handleSuccess" />
      </div>
      <div class="text-muted text-center text-sm text-balance">
        Продолжая, вы подтверждаете, что понимаете и соглашаетесь с Условиями использования и
        Политикой конфиденциальности.
      </div>
    </div>
  </div>
</template>
