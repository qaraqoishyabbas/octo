import { defineStore } from 'pinia';
import type { DeviceSession } from '~/types/device';

type DevicesResponse = { ok: boolean; devices: DeviceSession[] };

export const useDevicesStore = defineStore('devices', () => {
  const list = ref<DeviceSession[]>([]);
  const loading = ref(false);
  const error = ref(false);
  const disconnecting = ref(false);
  const disconnectError = ref(false);
  const currentDevice = computed(() => list.value.find((item) => item.is_current));
  const otherDevices = computed(() => list.value.filter((item) => !item.is_current));
  let requestSequence = 0;
  let generation = 0;

  const fetchData = async () => {
    const requestId = ++requestSequence;
    loading.value = true;
    error.value = false;
    try {
      const response = await $http<DevicesResponse>('devices');
      if (requestId !== requestSequence) return;
      if (!response.ok) throw new Error('Devices unavailable');
      list.value = response.devices ?? [];
    } catch {
      if (requestId === requestSequence) error.value = true;
    } finally {
      if (requestId === requestSequence) loading.value = false;
    }
  };

  const disconnect = async (key?: string) => {
    if (disconnecting.value) return false;
    const operationGeneration = generation;
    disconnecting.value = true;
    disconnectError.value = false;
    try {
      const response = await $http<{ ok: boolean }>(
        key ? `devices/${encodeURIComponent(key)}` : 'devices',
        { method: 'DELETE' },
      );
      if (operationGeneration !== generation) return false;
      if (!response.ok) throw new Error('Device disconnect failed');
      list.value = key
        ? list.value.filter((item) => item.key !== key)
        : list.value.filter((item) => item.is_current);
      await fetchData();
      return operationGeneration === generation;
    } catch {
      if (operationGeneration === generation) disconnectError.value = true;
      return false;
    } finally {
      if (operationGeneration === generation) disconnecting.value = false;
    }
  };

  const disconnectOthers = () => disconnect();

  function $reset() {
    generation += 1;
    requestSequence += 1;
    list.value = [];
    loading.value = false;
    error.value = false;
    disconnecting.value = false;
    disconnectError.value = false;
  }

  return {
    list,
    loading,
    error,
    disconnecting,
    disconnectError,
    currentDevice,
    otherDevices,
    fetchData,
    disconnect,
    disconnectOthers,
    $reset,
  };
});
