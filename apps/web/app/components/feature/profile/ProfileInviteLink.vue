<script setup lang="ts">
import { copyToClipboard } from '~/utils/copy-to-clipboard';

const emit = defineEmits<{
  close: [boolean];
}>();

const props = defineProps<{
  target?: string | null;
}>();

const requestUrl = useRequestURL();
const toast = useToast();
const invites = useInviteLinksStore().createScope();
const { loading } = toRefs(invites.state);
const inviteUrl = computed(() =>
  invites.state.token ? `${requestUrl.origin}/+${invites.state.token}` : '',
);
onUnmounted(invites.dispose);
const normalizedTarget = computed(() => String(props.target ?? '').trim());

const copyText = async (value?: string | null) => {
  const text = String(value ?? '').trim();

  if (!text) {
    return;
  }

  try {
    await copyToClipboard(text);
    toast.add({
      title: 'Ссылка приглашения скопирована',
      color: 'success',
      icon: 'i-ph-check-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  } catch {
    toast.add({
      title: 'Не удалось скопировать ссылку приглашения',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

const createInviteLink = async () => {
  if (!normalizedTarget.value || loading.value) {
    return;
  }

  try {
    await invites.fetchData(normalizedTarget.value);
  } catch {
    toast.add({
      title: 'Не удалось получить ссылку приглашения',
      color: 'error',
      icon: 'i-ph-warning-circle-fill',
      progress: false,
      duration: 2000,
      close: false,
    });
  }
};

watch(normalizedTarget, () => {
  invites.$reset();
  void createInviteLink();
});
onMounted(createInviteLink);
</script>

<template>
  <USlideover side="right" title="Ссылка приглашения" description="Управление ссылкой приглашения">
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            icon="i-ph-caret-left-bold"
            size="xl"
            variant="ghost"
            color="neutral"
            @click="emit('close', false)"
          />
        </template>

        <template #center>Пригласительная ссылка</template>
      </AppBar>

      <div class="h-[calc(100%-3.5rem)] space-y-2 overflow-y-auto p-4">
        <section>
          <div class="text-muted px-3 text-xs font-normal text-pretty">
            Любой пользователь сможет присоединиться к группе или каналу при помощи этой ссылки.
          </div>
        </section>
        <section>
          <div class="px-3 py-1 text-base font-bold">Ссылка-приглашение</div>
          <div class="bg-elevated space-y-2 rounded-md p-2">
            <UButton
              class="justify-start"
              block
              size="xl"
              color="neutral"
              variant="soft"
              :label="loading ? 'Получаем ссылку' : inviteUrl || 'Ссылка еще не создана'"
              :loading="loading"
              :disabled="!inviteUrl"
              @click="copyText(inviteUrl)"
            />
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>
