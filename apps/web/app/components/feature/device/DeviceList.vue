<script setup lang="ts">
const devices = useDevicesStore();
const { confirm } = useConfirm();

const disconnectOthers = () => {
  confirm({
    title: 'Завершить сеансы',
    description: 'Вы точно хотите завершить все сеансы, кроме текущего?',
    confirmButtonText: 'Завершить',
    cancelButtonText: 'Отмена',
    confirmButtonColor: 'error',
    onConfirm: async () => {
      await devices.disconnectOthers();
    },
  });
};
</script>

<template>
  <DeviceListLoading v-if="devices.loading && !devices.list.length" />
  <DeviceListError v-else-if="devices.error" @retry="devices.fetchData" />
  <DeviceListEmpty v-else-if="!devices.list.length" />
  <div class="space-y-4 px-2.5 pb-4" v-else>
    <section>
      <div class="text-muted px-3 text-xs font-normal text-pretty">
        <div>
          Здесь перечислены все устройства, на которых выполнен вход в вашу учетную запись. Вы
          можете выйти из учетной записи на каждом из них по отдельности или на всех устройствах
          сразу.
        </div>
        <br />
        <div>
          Если вы обнаружили в списке незнакомое устройство, немедленно выполните выход на этом
          устройстве и смените пароль от вашей учетной записи.
        </div>
      </div>
    </section>
    <section v-if="devices.currentDevice">
      <div class="px-3 py-1 text-base font-bold">Текущее устройство</div>
      <div class="bg-elevated rounded-md">
        <DeviceItem :item="devices.currentDevice" />
        <UButton
          class="justify-start"
          v-if="devices.otherDevices.length"
          block
          size="xl"
          color="error"
          variant="ghost"
          label="Завершить все другие сеансы"
          icon="i-ph-minus-circle-bold"
          :loading="devices.disconnecting"
          :disabled="devices.disconnecting"
          @click="disconnectOthers"
        />
      </div>
    </section>
    <section v-if="devices.otherDevices.length">
      <div class="text-muted px-3 text-xs font-normal text-pretty">
        Выйти на всех устройствах, кроме этого. Вам придется повторно войти в учетную запись на всех
        устройствах, где вы выполняли вход.
      </div>
    </section>
    <section v-if="devices.otherDevices.length">
      <div class="px-3 py-1 text-base font-bold">Активные сеансы</div>
      <div class="bg-elevated rounded-md">
        <DeviceItem v-for="item in devices.otherDevices" :key="item.key" :item="item" />
      </div>
    </section>
    <div class="text-error px-3 text-sm" v-if="devices.disconnectError">
      Не удалось завершить сеанс
    </div>
  </div>
</template>
