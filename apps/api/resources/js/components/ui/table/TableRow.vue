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
  <tr :class="cn('border-b transition-colors hover:bg-muted/50', $props.class)">
    <slot />
  </tr>
</template>
