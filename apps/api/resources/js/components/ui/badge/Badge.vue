<script setup>
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps({
  variant: {
    type: String,
    default: "default",
  },
  class: {
    type: null,
    default: undefined,
  },
});

const variants = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
  outline: "text-foreground",
};

const badgeClass = computed(() =>
  cn(
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
    variants[props.variant],
    props.class,
  ),
);
</script>

<template>
  <div :class="badgeClass">
    <slot />
  </div>
</template>
