<script setup lang="ts">
import type { Picker } from 'emoji-mart';
import { createReusableTemplate, useMediaQuery } from '@vueuse/core';

const props = withDefaults(
  defineProps<{
    align?: 'start' | 'center' | 'end';
    side?: 'top' | 'right' | 'bottom' | 'left';
    disabled?: boolean;
    mobileContainer?: HTMLElement | null;
  }>(),
  { align: 'start', side: 'top', disabled: false },
);

const emit = defineEmits<{
  (e: 'select', emoji: string, focus: boolean): void;
  (e: 'keyboard'): void;
}>();

const colorMode = useColorMode();
const isMobile = useMediaQuery('(max-width: 767px), (max-width: 1023px) and (pointer: coarse)');
const [DefinePickerContent, ReusePickerContent] = createReusableTemplate();

// Emoji Mart renders inside a shadow root; inherit Nuxt UI tokens there.
const pickerStyles = `
  :host {
    --border-radius: var(--radius-md);
    --font-family: var(--font-sans);
    --font-size: 14px;
    --shadow: none;
    height: var(--emoji-picker-height, min(435px, calc(100dvh - 6rem)));
    min-height: min(230px, 35dvh);
  }
  #root {
    --color-a: var(--ui-text);
    --color-b: var(--ui-text-muted);
    --color-c: var(--ui-text-dimmed);
    --em-color-border: var(--ui-border);
    --em-color-border-over: var(--ui-border-accented);
    background-color: var(--ui-bg-elevated);
  }
  :host, #root, input, button { color: var(--ui-text); }
  .sticky, .menu { background-color: var(--ui-bg-elevated); }
  .search input[type="search"] {
    background-color: var(--ui-bg);
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--ui-border);
  }
  .search input[type="search"]:focus {
    background-color: var(--ui-bg);
    box-shadow: inset 0 0 0 2px var(--ui-primary);
  }
  .search input[type="search"]::placeholder {
    color: var(--ui-text-muted);
    opacity: 1;
  }
  .search .icon { color: var(--ui-text-muted); }
  a, #nav button[aria-selected] { color: var(--ui-primary); }
  #nav .bar { background-color: var(--ui-primary); }
  .category button .background { background-color: var(--ui-bg-accented); }
  .scroll::-webkit-scrollbar-thumb { border-color: var(--ui-bg-elevated); }
  .menu, .option { border-radius: var(--radius-md); }
  .menu input[type="radio"]:checked + .option { box-shadow: 0 0 0 2px var(--ui-primary); }
  .option:hover {
    color: var(--ui-text-inverted);
    background-color: var(--ui-primary);
  }
`;

const el = ref<HTMLElement | null>(null);
const picker = shallowRef<(Picker & HTMLElement) | null>(null);
const openPicker = ref(false);
const isLoading = ref(false);
const loadError = ref(false);
let requestId = 0;
let disposed = false;

const openEmojiPicker = async () => {
  if (
    disposed ||
    props.disabled ||
    !openPicker.value ||
    !el.value ||
    picker.value ||
    isLoading.value
  )
    return;
  const id = ++requestId;
  isLoading.value = true;
  loadError.value = false;
  try {
    const [{ Picker, init }, { default: data }, { default: i18n }] = await Promise.all([
      import('emoji-mart'),
      import('@emoji-mart/data'),
      import('@emoji-mart/data/i18n/ru.json'),
    ]);
    await init({ data, i18n });
    if (disposed || id !== requestId || !openPicker.value || !el.value || props.disabled) return;
    const instance = new Picker({
      data,
      i18n,
      set: 'native',
      theme: colorMode.value,
      locale: 'ru',
      skin: 1,
      perLine: 8,
      dynamicWidth: true,
      emojiButtonRadius: 'var(--radius-md)',
      previewPosition: 'none',
      skinTonePosition: 'none',
      searchPosition: isMobile.value ? 'none' : 'sticky',
      onEmojiSelect({ native }: { native?: string }) {
        if (!native || props.disabled || disposed || id !== requestId) return;
        if (!isMobile.value) openPicker.value = false;
        emit('select', native, !isMobile.value);
      },
    }) as Picker & HTMLElement;
    instance.style.width = '100%';
    instance.injectStyles(pickerStyles);
    // injectStyles prepends; place our overrides after the library stylesheet.
    const themeStyle = instance.shadowRoot?.firstChild;
    if (themeStyle) instance.shadowRoot?.appendChild(themeStyle);
    picker.value = instance;
    el.value.replaceChildren(instance);
  } catch {
    if (id === requestId && !disposed) loadError.value = true;
  } finally {
    if (id === requestId) isLoading.value = false;
  }
};

const hideEmojiPicker = () => {
  requestId++;
  picker.value?.remove();
  picker.value = null;
  isLoading.value = false;
};

const closePicker = () => {
  openPicker.value = false;
};
const toggleMobilePicker = () => {
  if (props.disabled) return;
  if (openPicker.value) {
    closePicker();
    emit('keyboard');
  } else {
    openPicker.value = true;
  }
};

watch(
  openPicker,
  (open) => {
    if (open && isMobile.value) {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    }
  },
  { flush: 'sync' },
);
watch(isMobile, closePicker);

watch(
  () => colorMode.value,
  (v) => picker.value?.update({ theme: v }),
);

watch(
  [openPicker, el],
  ([open, container]) => {
    if (open && container) void openEmojiPicker();
    else hideEmojiPicker();
  },
  { flush: 'post' },
);
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) openPicker.value = false;
  },
);

onBeforeUnmount(() => {
  disposed = true;
  hideEmojiPicker();
});
defineExpose({ close: closePicker });
</script>

<template>
  <ClientOnly>
    <DefinePickerContent>
      <div class="emoji-picker-body bg-elevated overflow-hidden rounded-md">
        <div ref="el" />
        <div class="flex h-64 items-center justify-center" v-if="isLoading">
          <UBadge color="neutral" variant="soft">
            <UIcon class="animate-spin" name="i-ph-spinner-gap" />
            Загрузка...
          </UBadge>
        </div>
        <div
          class="flex min-h-32 flex-col items-center justify-center gap-3 p-4"
          v-else-if="loadError"
        >
          <p class="text-muted text-sm">Не удалось загрузить эмодзи</p>
          <UButton
            label="Повторить"
            icon="i-ph-arrow-clockwise-bold"
            color="neutral"
            variant="soft"
            @click="openEmojiPicker"
          />
        </div>
      </div>
    </DefinePickerContent>
    <template v-if="isMobile">
      <UButton
        :icon="openPicker ? 'i-ph-keyboard-bold' : 'i-ph-smiley-bold'"
        type="button"
        variant="soft"
        :disabled="disabled"
        :aria-label="openPicker ? 'Открыть клавиатуру' : 'Открыть выбор эмодзи'"
        :aria-expanded="openPicker"
        size="xl"
        color="neutral"
        @pointerdown.prevent
        @click="toggleMobilePicker"
      />
      <Teleport v-if="openPicker" :to="mobileContainer || 'body'">
        <section
          class="emoji-picker--mobile bg-elevated border-default w-full border-t"
          :class="{ 'fixed inset-x-0 bottom-0 z-50': !mobileContainer }"
          aria-label="Выбор эмодзи"
          @keydown.esc.stop.prevent="closePicker"
        >
          <div class="flex min-h-11 items-center justify-between gap-3 px-3">
            <span class="text-muted text-sm font-medium">Эмодзи</span>
            <UButton
              icon="i-ph-x-bold"
              size="xl"
              color="neutral"
              variant="ghost"
              aria-label="Закрыть эмодзи"
              @click="closePicker"
            />
          </div>
          <ReusePickerContent />
        </section>
      </Teleport>
    </template>
    <UPopover
      v-else
      v-model:open="openPicker"
      :content="{ align, side, sideOffset: 12 }"
      :ui="{ content: 'bg-elevated rounded-md' }"
      :modal="false"
    >
      <UButton
        icon="i-ph-smiley-bold"
        type="button"
        variant="soft"
        :disabled="disabled"
        aria-label="Открыть выбор эмодзи"
        size="xl"
        color="neutral"
      />

      <template #content>
        <div class="w-76 max-w-[calc(100vw-2rem)]"><ReusePickerContent /></div>
      </template>
    </UPopover>
  </ClientOnly>
</template>

<style scoped>
.emoji-picker--mobile {
  --emoji-picker-height: min(320px, 45dvh);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.emoji-picker--mobile :deep(.emoji-picker-body) {
  height: var(--emoji-picker-height);
}
</style>
