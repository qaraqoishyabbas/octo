<script setup lang="ts">
defineProps<{ noHover?: boolean; noCursor?: boolean }>();
</script>
<template>
  <div
    class="rounded-md"
    :class="{
      'hover:bg-accented/75 active:bg-accented/75 outline-inverted/25 focus-visible:outline-3':
        !noHover,
    }"
  >
    <div class="flex items-center gap-1.5 px-3 py-1.5" :class="{ 'cursor-pointer': !noCursor }">
      <slot name="avatar" />
      <div class="flex h-full w-full flex-col items-center justify-center">
        <div class="flex w-full items-center">
          <div class="flex flex-1">
            <div
              class="line-clamp-1 space-x-0.5 truncate text-lg font-semibold wrap-anywhere whitespace-pre-line"
            >
              <slot name="heading" />
            </div>
          </div>
          <div class="text-muted line-clamp-1 flex-none text-xs" v-if="$slots.loadingTop">
            <slot name="loadingTop" />
          </div>
        </div>
        <div class="flex w-full items-center">
          <div class="flex-1">
            <div
              class="text-muted line-clamp-1 text-sm font-normal wrap-anywhere whitespace-pre-line"
            >
              <slot name="description" />
            </div>
          </div>
          <div class="flex flex-none items-center gap-0.5" v-if="$slots.loadingBottom">
            <slot name="loadingBottom" />
          </div>
        </div>
      </div>
      <slot name="action" />
    </div>
  </div>
</template>
