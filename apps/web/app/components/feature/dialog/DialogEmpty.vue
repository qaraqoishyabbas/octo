<script setup lang="ts"></script>
<template>
  <div class="sticky top-0 right-0 left-0">
    <div class="via-default/50 from-default/70 bg-gradient-to-b to-transparent">
      <div class="flex justify-between gap-1.5 px-4 py-2">
        <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
          <UButton color="neutral" icon="i-ph-caret-left-bold" size="xl" variant="soft" to="/" />
        </div>
        <div class="bg-elevated flex w-full items-center gap-2 rounded-md p-0.5 shadow-lg"></div>
      </div>
    </div>
  </div>
  <div class="flex w-full flex-1 items-center justify-center">
    <UBadge color="neutral" variant="soft" size="lg" label="Диалог не найден" />
  </div>
  <div class="h-[76px]"></div>
</template>
