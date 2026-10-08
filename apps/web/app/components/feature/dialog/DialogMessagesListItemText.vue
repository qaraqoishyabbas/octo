<script setup lang="ts">
import { Profile } from '#components';
import type { MessageAttachment } from '~/types';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  message?: string;
  attachments?: MessageAttachment[];
  highlightQuery?: string;
}>();

const members = useDialogMembersStore();
const overlay = useOverlay();
const attrs = useAttrs();
const fallbackText = computed(() => {
  if (String(props.message ?? '').trim()) {
    return props.message;
  }

  const attachments = props.attachments ?? [];
  if (attachments.length === 0) {
    return '';
  }

  return attachments.some((file) => file.type === 'file') ? 'документ' : 'медиафайл';
});

const { renderedTextHtml } = useText(() => fallbackText.value, {
  mentionUsers: () => members.byId,
});

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightedTextHtml = computed(() => {
  const query = String(props.highlightQuery ?? '').trim();

  if (query.length < 2 || !renderedTextHtml.value) {
    return renderedTextHtml.value;
  }

  const matcher = new RegExp(`(${escapeRegExp(query)})`, 'gi');

  return renderedTextHtml.value
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (!part || part.startsWith('<')) {
        return part;
      }

      return part.replace(matcher, '<mark class="message-search-highlight">$1</mark>');
    })
    .join('');
});

const openMentionProfile = (event: MouseEvent | KeyboardEvent) => {
  if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) {
    return;
  }

  const mentionElement = (event.target as HTMLElement | null)?.closest?.(
    '[data-mention]',
  ) as HTMLElement | null;
  const userId = String(mentionElement?.dataset.mention ?? '').trim();

  if (!userId) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  overlay.create(Profile, { props: { target: `D-${userId}` } }).open();
};
</script>

<template>
  <div
    class="message-rich-text text-md max-w-full min-w-0 break-words wrap-anywhere"
    v-bind="attrs"
    v-html="highlightedTextHtml"
    @click="openMentionProfile"
    @keydown="openMentionProfile"
  />
</template>

<style scoped>
.message-rich-text {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.message-rich-text :deep(p) {
  margin: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.message-rich-text :deep(p + p) {
  margin-top: 0.25rem;
}

.message-rich-text :deep(p:empty)::before {
  content: '\00a0';
  white-space: pre;
}

.message-rich-text :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.message-rich-text :deep(.message-mention) {
  display: inline;
  border-radius: calc(var(--ui-radius) * 1);
  background: color-mix(in oklab, var(--ui-primary) 14%, transparent);
  color: var(--ui-primary);
  cursor: pointer;
  padding: 0 0.25rem;
  white-space: nowrap;
}

.message-rich-text :deep(.message-mention:focus-visible) {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.message-rich-text :deep(.message-search-highlight) {
  border-radius: 0.25rem;
  background: color-mix(in oklab, var(--ui-primary) 10%, transparent);
  color: var(--ui-primary);
}

.message-rich-text :deep(pre) {
  margin: 0.25rem 0 0;
  border-radius: calc(var(--ui-radius) * 1);
  background: color-mix(in oklab, var(--ui-primary) 10%, transparent);
  padding: 0.5rem 0.625rem;
  font-size: 0.85em;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre;
  border-color: var(--ui-color-primary-500);
  border-left-style: var(--tw-border-style);
  border-left-width: 4px;
}

.message-rich-text :deep(pre code) {
  color: inherit;
  padding: 0;
}
</style>
