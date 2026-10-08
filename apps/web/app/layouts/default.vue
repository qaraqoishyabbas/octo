<template>
  <div class="flex max-h-dvh w-screen overflow-hidden">
    <div class="h-dvh w-full lg:max-w-md">
      <div class="flex h-full w-full flex-col overflow-x-auto">
        <Sidebar />
      </div>
    </div>
    <slot />
  </div>
</template>
