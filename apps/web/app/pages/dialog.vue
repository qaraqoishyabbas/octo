<template>
  <div class="bg-default fixed inset-0 z-100 overflow-y-auto lg:relative lg:flex-1">
    <div class="mx-auto flex w-full flex-col lg:max-w-4xl">
      <div class="sticky top-0 right-0 left-0">
        <div class="via-default/50 from-default/70 bg-gradient-to-b to-transparent">
          <div class="flex justify-between gap-1.5 px-4 py-2">
            <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
              <UButton color="neutral" icon="i-ph-x-bold" size="xl" variant="soft" to="/" />
            </div>
            <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
              <div
                class="hover:bg-accented/75 cursor-pointer rounded-md px-4 text-center"
                @click="openProfile"
              >
                <div class="text-md line-clamp-1 truncate font-semibold">Abbas Qaraqoishy</div>
                <div class="text-muted line-clamp-1 truncate text-xs font-normal">
                  был(а) в 14:19
                </div>
              </div>
            </div>
            <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
              <UAvatar size="xl" />
            </div>
          </div>
          <div class="px-4 pb-2.5">
            <div class="bg-elevated flex rounded-md shadow-lg">
              <div class="hover:bg-accented/75 w-full cursor-pointer rounded-md px-4">
                <div class="flex items-center justify-between gap-1.5">
                  <div>
                    <div class="text-md line-clamp-1 truncate font-semibold">
                      Закрепленное сообщение
                    </div>
                    <div class="text-muted line-clamp-1 text-xs font-normal">
                      Тестовое сообщение
                    </div>
                  </div>
                  <UIcon class="size-6 shrink-0" name="i-ph-list-star-bold" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="w-full flex-1">
        <div class="space-y-1.5">
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
          <div class="bg-elevated h-16 rounded-md"></div>
        </div>
      </div>
      <div class="sticky right-0 bottom-0 left-0">
        <div class="via-default/50 to-default/70 bg-gradient-to-b from-transparent">
          <div class="flex items-end gap-1.5 px-6 py-4">
            <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
              <UButton color="neutral" icon="i-ph-paperclip-bold" size="xl" variant="soft" />
            </div>
            <div class="bg-elevated flex w-full flex-col rounded-md p-0.5 shadow-lg">
              <div class="flex w-full items-end gap-1.5">
                <UTextarea
                  class="w-full"
                  variant="none"
                  placeholder="Сообщение"
                  autoresize
                  size="xl"
                  :ui="{ base: 'rounded-none resize-none' }"
                  :rows="1"
                  :maxrows="14"
                />
                <UButton color="neutral" icon="i-ph-smiley-bold" size="xl" variant="soft" />
                <UButton
                  class="text-white"
                  color="primary"
                  icon="i-ph-paper-plane-tilt-bold"
                  size="xl"
                  variant="solid"
                />
              </div>
            </div>
            <div class="bg-elevated flex rounded-md p-0.5 shadow-lg">
              <UButton color="neutral" icon="i-ph-microphone-bold" size="xl" variant="soft" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { Profile } from '#components';
const overlay = useOverlay();
const openProfile = () => overlay.create(Profile).open();
</script>
