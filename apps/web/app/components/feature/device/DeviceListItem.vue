<script setup lang="ts">
import { DeviceItemModal } from '#components';
import type { DeviceSession } from '~/types/device';

const props = defineProps<{ item: DeviceSession }>();
const dayjs = useDayjs();
const overlay = useOverlay();

const openItemModal = (item: DeviceSession) => {
  overlay.create(DeviceItemModal, { props: { item } }).open();
};
</script>

<template>
  <Item @click="openItemModal(item)">
    <template v-slot:avatar>
      <UAvatar class="bg-accented" icon="i-ph-devices-bold" size="3xl" />
    </template>
    <template v-slot:heading>
      {{
        `${props.item.device.brand} ${props.item.os.name} ${props.item.os.version} - ${props.item.client.name}  ${props.item.client.version}`
      }}
    </template>
    <template v-slot:loadingTop>
      <span class="text-primary">
        <template v-if="props.item.is_current"> В сети </template>
        <template v-else>{{ dayjs(props.item.last_used_at as string).fromNow() }} </template>
      </span>
    </template>
    <template v-slot:description>
      {{ props.item.ip }}
    </template>
  </Item>
</template>
