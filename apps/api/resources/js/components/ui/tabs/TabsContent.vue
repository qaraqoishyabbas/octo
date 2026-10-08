<script setup>
import { inject, computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  value: {
    type: String,
    required: true,
  },
  class: {
    type: null,
    default: undefined,
  },
});

const defaultValue = inject("tabsDefaultValue", undefined);
const visible = computed(() => !defaultValue || props.value === defaultValue);
</script>

<template>
  <div v-if="visible" :class="cn('mt-2', $props.class)">
    <slot />
  </div>
</template>
