<script setup lang="ts">
const { locale, locales, setLocale, t } = useI18n();
useSeoMeta({ title: () => t('setting.language.title') });
const emit = defineEmits<{ close: [boolean] }>();
type LocaleItem = {
  code: string;
  label: string;
  description: string;
};

type LocaleCode = Parameters<typeof setLocale>[0];

const items = computed<LocaleItem[]>(() =>
  (locales.value ?? []).map((l) => {
    if (typeof l === 'string') {
      return { code: l, label: l, description: l };
    }

    const code = l.code;
    const label = (l.name || l.code) as string;
    const description = (l.description || l.name) as string;
    return { code, label, description };
  }),
);

const selected = computed<LocaleCode>({
  get: () => locale.value as LocaleCode,
  set: (code) => {
    if (code && code !== locale.value) setLocale(code);
  },
});
</script>

<template>
  <USlideover
    side="left"
    :title="$t('setting.language.title')"
    :description="$t('setting.language.description')"
  >
    <template v-slot:content>
      <AppBar>
        <template v-slot:left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="soft"
            @click="emit('close', false)"
          />
        </template>
        <template v-slot:center>{{ $t('setting.language.title') }}</template>
      </AppBar>
      <div class="space-y-4 px-2.5 pb-4">
        <section>
          <div class="px-3 py-1 text-base font-bold">{{ $t('setting.language.interface') }}</div>
          <div class="bg-elevated rounded-md">
            <URadioGroup
              v-model="selected"
              size="xl"
              variant="table"
              value-key="code"
              :items="items"
              indicator="end"
              :ui="{ item: 'first-of-type:rounded-t-md last-of-type:rounded-b-md' }"
            />
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>
