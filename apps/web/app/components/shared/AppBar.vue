<script setup lang="ts"></script>

<template>
  <div class="sticky top-0 right-0 left-0 z-10">
    <div class="via-default/80 from-default bg-gradient-to-b to-transparent">
      <template v-if="!$slots.input">
        <div class="relative flex h-[60px] items-center justify-center gap-1.5">
          <div
            class="bg-elevated absolute left-4 flex rounded-md p-0.5 shadow-lg"
            v-if="$slots.left"
          >
            <slot name="left" />
          </div>

          <div class="truncate text-center text-xl font-semibold">
            <slot name="center" />
          </div>
          <div
            class="bg-elevated absolute right-4 flex rounded-md p-0.5 shadow-lg"
            v-if="$slots.right"
          >
            <slot name="right" />
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex justify-between gap-1.5 px-4 py-2">
          <div class="bg-elevated flex rounded-xl p-0.5 shadow-lg">
            <slot name="left" />
          </div>
          <div class="bg-elevated flex w-full rounded-md p-0.5 shadow-lg">
            <slot name="input" />
          </div>
        </div>
      </template>
      <slot name="bottom" />
    </div>
  </div>
</template>
