<script setup lang="ts">
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import type { Editor } from '@tiptap/vue-3';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { BubbleMenu } from '@tiptap/vue-3/menus';
import type { User } from '~/types';

const props = withDefaults(
  defineProps<{
    editable?: boolean;
    placeholder?: string;
    sendOnEnter?: boolean;
    mentionUsers?: User[];
    canMention?: boolean;
    editorClass?: string;
    bubblePluginKey?: string;
  }>(),
  {
    editable: true,
    placeholder: 'Сообщение',
    sendOnEnter: true,
    mentionUsers: () => [],
    canMention: false,
    editorClass:
      'tiptap-editor w-full min-h-[2rem] max-h-40 overflow-y-auto px-3 py-2.5 text-base leading-5 outline-none',
    bubblePluginKey: 'dialog-text-editor-bubble-menu',
  },
);

const emit = defineEmits<{
  submit: [];
  mentionSearch: [];
  focus: [];
}>();

const html = defineModel<string>('html', { default: '' });
const text = defineModel<string>('text', { default: '' });

const mentionSuggestions = ref<User[]>([]);
const selectedMentionIndex = ref(0);
const mentionCommand = ref<((user: User) => void) | null>(null);

const canMentionUsers = computed(() => Boolean(props.canMention));
const showMentionSuggestions = computed(() => mentionSuggestions.value.length > 0);
const mentionSuggestionItems = computed(() =>
  mentionSuggestions.value.map((user) => ({
    id: user.id,
    name: user.name,
    label: user.name,
    description: `@${user.username}`,
    avatarUrl: user.avatar,
  })),
);
const selectedMentionId = computed(() => mentionSuggestions.value[selectedMentionIndex.value]?.id);

const findMentionUsers = (query: string) => {
  if (!canMentionUsers.value) {
    return [];
  }

  if (props.mentionUsers.length === 0) {
    emit('mentionSearch');
    return [];
  }

  const normalizedQuery = query.toLowerCase();

  return props.mentionUsers
    .filter((user) => {
      const username = String(user.username ?? '').trim();
      if (!username) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [username, user.name, user.first_name, user.last_name]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(normalizedQuery));
    })
    .slice(0, 6);
};

const closeMentionSuggestions = () => {
  mentionSuggestions.value = [];
  selectedMentionIndex.value = 0;
  mentionCommand.value = null;
};

const setMentionSuggestions = (items: User[], command: (user: User) => void) => {
  mentionSuggestions.value = items;
  selectedMentionIndex.value = 0;
  mentionCommand.value = command;
};

const selectMention = (user?: User) => {
  if (!user || !mentionCommand.value) {
    return;
  }

  mentionCommand.value(user);
  closeMentionSuggestions();
};

const selectMentionById = (id?: string) => {
  const user = mentionSuggestions.value.find((item) => item.id === id);
  selectMention(user);
};

const exitLinkOnSpace = (event: KeyboardEvent) => {
  if (event.key !== ' ' && event.key !== 'Spacebar') {
    return false;
  }

  const instance = editor.value;
  if (!instance || !instance.isActive('link')) {
    return false;
  }

  const { selection, schema } = instance.state;
  if (!selection.empty) {
    return false;
  }

  const linkType = schema.marks.link;
  const previousLinkMark = selection.$from.nodeBefore?.marks.find((mark) => mark.type === linkType);
  if (!linkType || !previousLinkMark) {
    return false;
  }

  const nextLinkMark = selection.$from.nodeAfter?.marks.find((mark) => mark.type === linkType);
  if (nextLinkMark?.eq(previousLinkMark)) {
    return false;
  }

  event.preventDefault();
  const transaction = instance.state.tr
    .removeStoredMark(linkType)
    .insertText(' ', selection.from)
    .setMeta('preventAutolink', true)
    .scrollIntoView();

  instance.view.dispatch(transaction);
  return true;
};

const editor = useEditor({
  editable: props.editable,
  extensions: [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      code: false,
      horizontalRule: false,
      link: {
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
        },
      },
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
      emptyEditorClass: 'is-editor-empty',
    }),
    Mention.configure({
      HTMLAttributes: {
        class: 'message-mention',
        'data-type': 'mention',
      },
      renderText({ node }) {
        return node.attrs.label ? `@${node.attrs.label}` : '@Пользователь';
      },
      renderHTML({ options, node }) {
        return [
          'span',
          {
            ...options.HTMLAttributes,
            'data-id': node.attrs.id,
            'data-label': node.attrs.label,
          },
          node.attrs.label || `@${node.attrs.id}`,
        ];
      },
      suggestion: {
        char: '@',
        allowedPrefixes: null,
        allow: ({ editor }) => canMentionUsers.value && !editor.isActive('codeBlock'),
        items: ({ query }) => findMentionUsers(query),
        command: ({ editor, range, props }) => {
          const user = props as User;
          editor
            .chain()
            .focus()
            .insertContentAt(
              range,
              [
                {
                  type: 'mention',
                  attrs: {
                    id: user.id,
                    label: user.name || user.username,
                  },
                },
                {
                  type: 'text',
                  text: ' ',
                },
              ],
              { updateSelection: true },
            )
            .run();
        },
        render: () => ({
          onStart: (props) =>
            setMentionSuggestions(props.items as User[], props.command as (user: User) => void),
          onUpdate: (props) =>
            setMentionSuggestions(props.items as User[], props.command as (user: User) => void),
          onExit: closeMentionSuggestions,
          onKeyDown: ({ event }) => {
            if (!showMentionSuggestions.value) {
              return false;
            }

            if (event.key === 'ArrowDown') {
              selectedMentionIndex.value =
                (selectedMentionIndex.value + 1) % mentionSuggestions.value.length;
              return true;
            }

            if (event.key === 'ArrowUp') {
              selectedMentionIndex.value =
                (selectedMentionIndex.value + mentionSuggestions.value.length - 1) %
                mentionSuggestions.value.length;
              return true;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
              selectMention(mentionSuggestions.value[selectedMentionIndex.value]);
              return true;
            }

            if (event.key === 'Escape') {
              closeMentionSuggestions();
              return false;
            }

            return false;
          },
        }),
      },
    }),
  ],
  content: html.value || '',
  editorProps: {
    attributes: {
      class: props.editorClass,
    },
    handleClick: (_view, _pos, event) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a');

      if (!anchor) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      return true;
    },
    handleKeyDown: (_view, event) => {
      if (showMentionSuggestions.value && (event.key === 'Enter' || event.key === 'Tab')) {
        event.preventDefault();
        selectMention(mentionSuggestions.value[selectedMentionIndex.value]);
        return true;
      }

      if (exitLinkOnSpace(event)) return true;
      if (editor.value?.isActive('codeBlock')) return false;
      if (event.key !== 'Enter') return false;

      if (!props.sendOnEnter) {
        if (event.shiftKey) {
          event.preventDefault();
          emit('submit');
        } else {
          event.preventDefault();
          editor.value?.chain().focus().setHardBreak().run();
        }

        return true;
      }

      if (event.shiftKey) return false;

      event.preventDefault();
      emit('submit');
      return true;
    },
  },
  onFocus: () => emit('focus'),
  onUpdate: ({ editor }) => {
    html.value = editor.getHTML();
    text.value = editor.getText();
  },
});

const isMarkActive = (mark: 'bold' | 'italic' | 'underline' | 'strike' | 'codeBlock') => {
  return editor.value?.isActive(mark) ?? false;
};

const applyCodeBlockToSelection = () => {
  const instance = editor.value;
  if (!instance) {
    return;
  }

  const { selection, doc } = instance.state;
  const { from, to, empty, $from, $to } = selection;

  if (empty || instance.isActive('codeBlock')) {
    instance.chain().focus().toggleCodeBlock().run();
    return;
  }

  const selectedText = doc.textBetween(from, to, '\n', '\n');
  if (!selectedText) {
    return;
  }

  const fromDepth = $from.parent.isTextblock ? $from.depth : 0;
  const toDepth = $to.parent.isTextblock ? $to.depth : 0;
  const replaceFrom = fromDepth > 0 ? $from.before(fromDepth) : from;
  const replaceTo = toDepth > 0 ? $to.after(toDepth) : to;
  const beforeText = fromDepth > 0 ? doc.textBetween($from.start(fromDepth), from, '\n', '\n') : '';
  const afterText = toDepth > 0 ? doc.textBetween(to, $to.end(toDepth), '\n', '\n') : '';
  const replacementContent: Array<
    | { type: 'paragraph'; content: Array<{ type: 'text'; text: string }> }
    | { type: 'codeBlock'; content: Array<{ type: 'text'; text: string }> }
  > = [];

  if (beforeText.length > 0) {
    replacementContent.push({
      type: 'paragraph',
      content: [{ type: 'text', text: beforeText }],
    });
  }

  replacementContent.push({
    type: 'codeBlock',
    content: [{ type: 'text', text: selectedText }],
  });

  if (afterText.length > 0) {
    replacementContent.push({
      type: 'paragraph',
      content: [{ type: 'text', text: afterText }],
    });
  }

  if (replacementContent.length === 0) {
    return;
  }

  instance
    .chain()
    .focus()
    .insertContentAt(
      {
        from: replaceFrom,
        to: replaceTo,
      },
      replacementContent,
      { updateSelection: true },
    )
    .run();
};

const toggleMark = (mark: 'bold' | 'italic' | 'underline' | 'strike' | 'codeBlock') => {
  const chain = editor.value?.chain().focus();
  if (!chain) {
    return;
  }

  if (mark === 'bold') {
    chain.toggleBold().run();
    return;
  }

  if (mark === 'italic') {
    chain.toggleItalic().run();
    return;
  }

  if (mark === 'underline') {
    chain.toggleUnderline().run();
    return;
  }

  if (mark === 'strike') {
    chain.toggleStrike().run();
    return;
  }

  if (mark === 'codeBlock') {
    applyCodeBlockToSelection();
  }
};

const shouldShowBubbleMenu = ({
  editor,
  from,
  to,
}: {
  editor: Pick<Editor, 'isEditable' | 'isActive'>;
  from: number;
  to: number;
}) => {
  if (!editor?.isEditable) return false;
  if (from === to) return false;
  if (editor.isActive('codeBlock')) return false;
  return true;
};

const focusEnd = () => {
  editor.value?.commands.focus('end');
};

const focus = () => {
  editor.value?.commands.focus();
};
const insertText = (value: string, restoreFocus = true) => {
  if (!value || !editor.value?.isEditable) return false;
  const chain = editor.value.chain();
  if (restoreFocus) chain.focus();
  return chain.insertContent({ type: 'text', text: value }).run();
};

const setContent = (value: string, emitUpdate = false) => {
  editor.value?.commands.setContent(value, { emitUpdate });
  html.value = editor.value?.getHTML() ?? value;
  text.value = editor.value?.getText() ?? '';
};

const clearContent = (emitUpdate = true) => {
  editor.value?.commands.clearContent(emitUpdate);
  if (!emitUpdate) {
    html.value = '';
    text.value = '';
  }
};

watch(
  () => props.editable,
  (editable) => {
    editor.value?.setEditable(editable);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});

defineExpose({
  focusEnd,
  focus,
  insertText,
  setContent,
  clearContent,
  closeMentionSuggestions,
  showMentionSuggestions,
  mentionSuggestionItems,
  selectedMentionId,
  selectMentionById,
});
</script>

<template>
  <div>
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :plugin-key="bubblePluginKey"
      :should-show="shouldShowBubbleMenu"
      :tippy-options="{ placement: 'top', duration: 120, maxWidth: 'none' }"
    >
      <div
        class="bg-default/95 ring-default flex items-center gap-1 rounded-md p-1 shadow-md ring-1 backdrop-blur"
      >
        <UButton
          type="button"
          size="xs"
          color="neutral"
          :variant="isMarkActive('bold') ? 'soft' : 'ghost'"
          icon="i-ph-text-b-bold"
          @mousedown.prevent
          @click="toggleMark('bold')"
        />
        <UButton
          type="button"
          size="xs"
          color="neutral"
          :variant="isMarkActive('italic') ? 'soft' : 'ghost'"
          icon="i-ph-text-italic-bold"
          @mousedown.prevent
          @click="toggleMark('italic')"
        />
        <UButton
          type="button"
          size="xs"
          color="neutral"
          :variant="isMarkActive('underline') ? 'soft' : 'ghost'"
          icon="i-ph-text-underline-bold"
          @mousedown.prevent
          @click="toggleMark('underline')"
        />
        <UButton
          type="button"
          size="xs"
          color="neutral"
          :variant="isMarkActive('strike') ? 'soft' : 'ghost'"
          icon="i-ph-text-strikethrough-bold"
          @mousedown.prevent
          @click="toggleMark('strike')"
        />
        <UButton
          type="button"
          size="xs"
          color="neutral"
          :variant="isMarkActive('codeBlock') ? 'soft' : 'ghost'"
          icon="i-ph-brackets-curly-bold"
          @mousedown.prevent
          @click="toggleMark('codeBlock')"
        />
      </div>
    </BubbleMenu>

    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
:deep(.tiptap-editor p) {
  margin: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

:deep(.tiptap-editor) {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

:deep(.tiptap-editor .is-editor-empty:first-child::before),
:deep(.tiptap-editor p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  pointer-events: none;
  float: left;
  height: 0;
  color: var(--ui-text-dimmed);
}

:deep(.tiptap-editor a) {
  color: var(--ui-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

:deep(.tiptap-editor .message-mention) {
  border-radius: calc(var(--ui-radius) * 1);
  background: color-mix(in oklab, var(--ui-primary) 14%, transparent);
  color: var(--ui-primary);
  padding: 0 0.25rem;
  white-space: nowrap;
}

:deep(.tiptap-editor pre) {
  margin: 0;
  border-radius: calc(var(--ui-radius) * 1.5);
  background: color-mix(in oklab, var(--ui-primary) 10%, transparent);
  padding: 0.5rem 0.625rem;
  font-size: 0.85em;
  line-height: 1.4;
  overflow-x: auto;
  border-color: var(--ui-color-primary-500);
  border-left-style: var(--tw-border-style);
  border-left-width: 4px;
}

:deep(.tiptap-editor pre code) {
  color: inherit;
  padding: 0;
}
</style>
