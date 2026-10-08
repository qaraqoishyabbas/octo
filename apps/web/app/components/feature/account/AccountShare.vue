<script setup lang="ts">
import QrCodeStyling from 'qr-code-styling';
import { copyToClipboard } from '~/utils/copy-to-clipboard';

const emit = defineEmits<{ close: [boolean] }>();
useSeoMeta({ title: 'Поделиться профилем' });

const auth = useAuthStore();
const requestUrl = useRequestURL();
const toast = useToast();
const qrCodeContainer = ref<HTMLElement | null>(null);
const qrCode = ref<QrCodeStyling | null>(null);

const qrData = computed(() => {
  const username = auth.user.username;
  const fallback = auth.user.id ? String(auth.user.id) : '';

  return `${requestUrl.origin}/@${username || fallback}`;
});

async function shareProfile() {
  const shareData = {
    title: auth.user.name,
    text: `${auth.user.name} - @${auth.user.username}`,
    url: qrData.value,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await copyToClipboard(qrData.value);

    toast.add({
      title: 'Ссылка скопирована',
      color: 'success',
      icon: 'i-ph-check-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    toast.add({
      title: 'Не удалось поделиться ссылкой',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
}

onMounted(async () => {
  await nextTick();

  if (!qrCodeContainer.value) {
    return;
  }

  qrCode.value = new QrCodeStyling({
    width: 280,
    height: 280,
    type: 'svg',
    data: qrData.value,
    backgroundOptions: {
      color: 'transparent',
    },
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 10,
    },
    dotsOptions: {
      type: 'extra-rounded',
      color: 'var(--ui-primary)',
    },
    cornersSquareOptions: {
      type: 'extra-rounded',
    },
  });

  qrCode.value.append(qrCodeContainer.value);
});

watch(qrData, (data) => {
  qrCode.value?.update({ data });
});
</script>

<template>
  <USlideover side="left" title="Поделиться профилем" description="QR-код профиля">
    <template v-slot:content>
      <div class="h-full w-full overflow-y-scroll">
        <div class="flex h-full w-full flex-col space-y-4 p-4">
          <div class="flex flex-1 items-center">
            <div class="bg-elevated mx-auto w-fit rounded-md">
              <div class="flex flex-col items-center space-y-4 px-8 py-4">
                <UAvatar
                  class="size-28 rounded-full text-4xl uppercase"
                  :src="$storage(auth.user.avatar)"
                  :alt="auth.user.name"
                  img-class="object-cover"
                />
                <div ref="qrCodeContainer" />
                <div class="text-primary text-2xl font-bold">@{{ auth.user.username }}</div>
              </div>
            </div>
          </div>
          <section class="bg-elevated rounded-md px-2 pb-2">
            <div class="flex h-14 min-h-14 items-center space-x-2">
              <UButton
                size="xl"
                color="neutral"
                variant="soft"
                icon="i-ph-x-bold"
                @click="emit('close', false)"
              />
              <div class="w-full text-2xl font-bold">QR-код</div>
            </div>
            <UButton
              block
              size="xl"
              label="Поделиться"
              color="primary"
              icon="i-ph-share-network-bold"
              @click="shareProfile"
            />
          </section>
        </div>
      </div>
    </template>
  </USlideover>
</template>
