<script setup lang="ts">
const folders = useChatFoldersStore();
const emit = defineEmits<{ close: [boolean] }>();
</script>

<template>
  <USlideover side="left" title="Папки с чатами" description="Выберите папки для главного экрана">
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            aria-label="Закрыть настройки папок"
            @click="emit('close', false)"
          />
        </template>
        <template #center>Папки с чатами</template>
      </AppBar>
      <div class="space-y-4 px-2.5 pb-4">
        <section>
          <div class="px-3 py-1 text-base font-bold">Папки с чатами</div>
          <div class="bg-elevated rounded-md">
            <div class="relative" v-for="folder in folders.folderOptions" :key="folder.value">
              <UButton
                class="justify-start pr-20"
                block
                size="xl"
                color="neutral"
                variant="soft"
                :label="folder.label"
                :aria-pressed="folders.visibleFilters.some((item) => item.value === folder.value)"
                @click="
                  folders.setFolder(
                    folder.value,
                    !folders.visibleFilters.some((item) => item.value === folder.value),
                  )
                "
              />
              <USwitch
                class="absolute top-1/2 right-3 -translate-y-1/2"
                :aria-label="folder.label"
                :model-value="folders.visibleFilters.some((item) => item.value === folder.value)"
                size="xl"
                checked-icon="i-ph-check-bold"
                unchecked-icon="i-ph-x-bold"
                @update:model-value="folders.setFolder(folder.value, $event)"
              />
            </div>
          </div>
        </section>
        <section>
          <div class="text-muted px-3 text-xs font-normal text-pretty">
            <div>Выберите папки, которые будут отображаться над списком чатов.</div>
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>
