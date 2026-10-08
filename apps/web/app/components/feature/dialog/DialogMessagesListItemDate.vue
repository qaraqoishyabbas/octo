<script setup lang="ts">
const props = defineProps<{
  createdAt?: string;
  edited?: boolean;
}>();

const dayjs = useDayjs();

const formattedTime = computed(() => {
  const value = props.createdAt;
  if (!value) return '';

  const parsed = dayjs(value);
  if (!parsed.isValid()) return '';

  return parsed.format('HH:mm');
});
</script>

<template>
  <UBadge class="py-0.5" v-if="props.edited" label="изм." size="sm" variant="soft" />
  <UBadge class="py-0.5" v-if="formattedTime" :label="formattedTime" size="sm" variant="soft" />
</template>
