<template>
  <div class="mx-auto space-y-2 p-2">
    <div class="flex justify-center">
      <UBadge
        class="bg-elevated block"
        variant="soft"
        color="neutral"
        size="lg"
        label="3 декабря"
      />
    </div>
    <div
      class="bg-primary-100 dark:bg-primary-900 text-md ml-10 max-w-lg justify-self-end rounded-md px-2.5 py-1.5"
    >
      <div>Привет, как дела с отчетом? Ты успеваешь завершить его к обеду?</div>
      <div class="flex items-center justify-end space-x-1 text-[0.5rem]">
        <span>14:28</span>
      </div>
    </div>
    <div class="bg-elevated text-md mr-10 max-w-lg justify-self-start rounded-md px-2.5 py-1.5">
      <div>Привет! Почти, осталось пара пунктов.</div>
      <div class="flex items-center justify-end space-x-1 text-[0.5rem]">
        <span>14:31</span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts"></script>
