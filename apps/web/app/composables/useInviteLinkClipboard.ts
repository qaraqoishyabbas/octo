import { copyToClipboard } from '~/utils/copy-to-clipboard';

export const useInviteLinkClipboard = () => {
  const requestUrl = useRequestURL();
  const toast = useToast();
  const invites = useInviteLinksStore().createScope();
  const copying = ref(false);
  const loading = computed(() => invites.state.loading || copying.value);
  onScopeDispose(invites.dispose);

  const copyInviteLink = async (target?: string | null) => {
    const normalizedTarget = String(target ?? '').trim();

    if (!normalizedTarget || loading.value) {
      return;
    }

    try {
      const token = await invites.fetchData(normalizedTarget);
      if (!token) return;
      copying.value = true;

      await copyToClipboard(`${requestUrl.origin}/+${token}`);
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
    } finally {
      copying.value = false;
    }
  };

  return {
    copyInviteLink,
    inviteLinkLoading: loading,
  };
};
