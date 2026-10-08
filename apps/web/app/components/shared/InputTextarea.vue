<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    placeholder?: string;
    maxLength?: number;
  }>(),
  { maxLength: 100, disabled: false, placeholder: '' },
);
const safeValue = computed(() => modelValue.value ?? '');
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const { modelValue, maxLength, disabled, placeholder } = toRefs(props);
const textareaRef = ref<{ $el?: Element } | null>(null);
const cursorPos = ref<number>(0);

const seg: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('ru', { granularity: 'grapheme' })
    : null;

type Seg = { segment: string; index: number };

const segments = (s: string): Seg[] =>
  seg
    ? (Array.from(seg.segment(s)) as unknown as Seg[])
    : Array.from(s).map((ch, i) => ({ segment: ch, index: i }));

const graphemes = (s: string): string[] => segments(s).map((x) => x.segment);
const countGraphemes = (s: string): number => graphemes(s).length;
const sliceGraphemes = (s: string, n: number): string => graphemes(s).slice(0, n).join('');

const currentLen = computed(() => countGraphemes(modelValue.value || ''));
const remaining = computed(() => maxLength.value - currentLen.value);

const getTextareaElement = (): HTMLTextAreaElement | null =>
  textareaRef.value?.$el?.querySelector('textarea') ?? null;

const saveCursor = (): void => {
  const el = getTextareaElement();
  if (el) cursorPos.value = el.selectionStart;
};

function onInput(value: string) {
  const limited = sliceGraphemes(value || '', maxLength.value);
  emit('update:modelValue', limited);
}

function onBeforeInput(e: InputEvent) {
  const el = getTextareaElement();
  const isInsert = e.inputType.startsWith('insert');
  const hasSelection = el ? el.selectionStart !== el.selectionEnd : false;

  if (isInsert && remaining.value <= 0 && !hasSelection) {
    e.preventDefault();
  }
}

function onKeydown(e: KeyboardEvent) {
  if (remaining.value > 0) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const printable = e.key.length === 1 || e.key === 'Enter';
  if (printable) e.preventDefault();
}
</script>

<template>
  <div class="flex w-full space-x-2">
    <UTextarea
      class="w-full"
      ref="textareaRef"
      :model-value="safeValue"
      variant="none"
      size="xl"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="1"
      :autoresize="true"
      :ui="{ base: 'resize-none', trailing: 'inset-y-0 items-end' }"
      @beforeinput="onBeforeInput"
      @keydown="onKeydown"
      @update:modelValue="onInput"
      @click="saveCursor"
      @keyup="saveCursor"
      @focus="saveCursor"
      @keydown.enter.prevent
    >
      <template v-slot:trailing>
        <div class="flex space-x-1">
          <div class="text-muted text-xs tabular-nums" v-if="currentLen > 12">
            {{ remaining }}
          </div>
        </div>
      </template>
    </UTextarea>
  </div>
</template>
