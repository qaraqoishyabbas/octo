<script setup>
import { inject, computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  value: {
    type: String,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  class: {
    type: null,
    default: undefined,
  },
});

const defaultValue = inject("tabsDefaultValue", undefined);
const active = computed(() => props.value === defaultValue);
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :class="
      cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50',
        active && 'bg-background text-foreground shadow',
        $props.class,
      )
    "
  >
    <slot />
  </button>
</template>
