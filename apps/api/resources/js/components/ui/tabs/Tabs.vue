<script setup>
import { provide } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  defaultValue: {
    type: String,
    default: undefined,
  },
  class: {
    type: null,
    default: undefined,
  },
});

provide("tabsDefaultValue", props.defaultValue);
</script>

<template>
  <div :class="cn('', $props.class)">
    <slot />
  </div>
</template>
