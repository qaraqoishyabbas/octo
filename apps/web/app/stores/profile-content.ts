import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import type { DialogPreview, MessageAttachment, MessageLink } from '~/types';

type Content = {
  media: MessageAttachment;
  files: MessageAttachment;
  links: MessageLink;
  groups: DialogPreview;
};
type Scope<K extends keyof Content> = {
  list: Content[K][];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  page: number;
  loadedTarget: string;
  sequence: number;
};

export const useProfileContentStore = defineStore('profile-content', () => {
  const scopes = ref<Record<string, Scope<keyof Content>>>({});
  let nextScope = 0;
  const createScope = <K extends keyof Content>(kind: K) => {
    const key = String(++nextScope);
    const state = reactive({
      list: [],
      loading: false,
      loadingMore: false,
      error: false,
      hasMore: true,
      page: 1,
      loadedTarget: '',
      sequence: 0,
    }) as Scope<K>;
    scopes.value[key] = state;
    const $reset = () => {
      state.sequence++;
      Object.assign(state, {
        list: [],
        loading: false,
        loadingMore: false,
        error: false,
        hasMore: true,
        page: 1,
        loadedTarget: '',
      });
    };
    const fetchData = async (target: string, options?: { force?: boolean }) => {
      target = target.trim();
      if (!target) {
        $reset();
        return;
      }
      if (options?.force || (state.loadedTarget && state.loadedTarget !== target)) $reset();
      if (state.loading || state.loadingMore || !state.hasMore) return;
      state.loadedTarget = target;
      const sequence = ++state.sequence;
      state.loading = state.list.length === 0;
      state.loadingMore = !state.loading;
      state.error = false;
      try {
        const response = await $http<{
          attachments?: MessageAttachment[];
          links?: MessageLink[];
          groups?: DialogPreview[];
          has_more?: boolean;
        }>(
          `dialogs/${encodeURIComponent(target)}/${kind === 'media' || kind === 'files' ? 'attachments' : kind}`,
          {
            query:
              kind === 'groups'
                ? undefined
                : {
                    page: state.page,
                    per_page: kind === 'media' ? 36 : 30,
                    ...(kind === 'media' || kind === 'files' ? { type: kind } : {}),
                  },
          },
        );
        if (sequence !== state.sequence) return;
        const items =
          (kind === 'links'
            ? response.links
            : kind === 'groups'
              ? response.groups
              : response.attachments) ?? [];
        const id = (item: Content[keyof Content]) => (kind === 'groups' ? item.dialog_id : item.id);
        const seen = new Set(state.list.map(id));
        for (const item of items) {
          if (!seen.has(id(item))) {
            state.list.push(item as Content[K]);
            seen.add(id(item));
          }
        }
        state.hasMore = kind !== 'groups' && Boolean(response.has_more);
        state.page++;
      } catch {
        if (sequence === state.sequence) state.error = true;
      } finally {
        if (sequence === state.sequence) {
          state.loading = false;
          state.loadingMore = false;
        }
      }
    };
    const dispose = () => {
      $reset();
      delete scopes.value[key];
    };
    return { state, fetchData, $reset, dispose };
  };
  const $reset = () => {
    Object.values(scopes.value).forEach((state) => {
      state.sequence++;
      Object.assign(state, {
        list: [],
        loading: false,
        loadingMore: false,
        error: false,
        hasMore: true,
        page: 1,
        loadedTarget: '',
      });
    });
  };
  return { scopes, createScope, $reset };
});
