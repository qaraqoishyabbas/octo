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
  <th
    :class="
      cn(
        'h-10 px-4 text-left align-middle font-medium text-muted-foreground',
        $props.class,
      )
    "
  >
    <slot />
  </th>
</template>
