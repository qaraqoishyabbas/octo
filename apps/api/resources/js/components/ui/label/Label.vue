<script setup>
import { cn } from "@/lib/utils";

defineProps({
  class: {
    type: null,
    default: undefined,
  },
});
</script>

<template>
  <label :class="cn('text-sm font-medium leading-none', $props.class)">
    <slot />
  </label>
</template>
