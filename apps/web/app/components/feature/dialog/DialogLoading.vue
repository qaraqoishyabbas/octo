<template>
  <div class="sticky top-0 right-0 left-0">
    <div class="via-default/50 from-default/70 bg-gradient-to-b to-transparent">
      <div class="flex justify-between gap-1.5 px-4 py-2">
        <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
          <UButton color="neutral" icon="i-ph-caret-left-bold" size="xl" variant="soft" to="/" />
        </div>
        <div class="bg-elevated flex items-center rounded-md p-0.5 shadow-lg">
          <div class="flex flex-col items-center px-4">
            <div class="flex space-x-1">
              <USkeleton class="bg-accented h-4 w-12" />
              <USkeleton class="bg-accented h-4 w-32" />
            </div>
            <div class="mt-1 flex space-x-1">
              <USkeleton class="bg-accented h-4 w-16" />
              <USkeleton class="bg-accented h-4 w-10" />
            </div>
          </div>
        </div>
        <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
          <USkeleton>
            <UAvatar class="bg-accented" size="xl" />
          </USkeleton>
        </div>
      </div>
    </div>
  </div>
  <div class="flex w-full flex-1 items-center justify-center">
    <UIcon class="h-8 w-8 animate-spin" name="i-ph-spinner-gap" />
  </div>
  <div class="h-[76px]"></div>
</template>
