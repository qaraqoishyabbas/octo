<script setup lang="ts">
const auth = useAuthStore();
const account = useAccountStore();
const dayjs = useDayjs();

const state = reactive({
  birth_date: auth.user.birth_date,
});

const open = ref(false);
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;
const currentDay = today.getDate();

const selectedDay = ref('');
const selectedMonth = ref('');
const selectedYear = ref('');

const months = [
  { value: '1', label: 'Январь' },
  { value: '2', label: 'Февраль' },
  { value: '3', label: 'Март' },
  { value: '4', label: 'Апрель' },
  { value: '5', label: 'Май' },
  { value: '6', label: 'Июнь' },
  { value: '7', label: 'Июль' },
  { value: '8', label: 'Август' },
  { value: '9', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' },
  { value: '11', label: 'Ноябрь' },
  { value: '12', label: 'Декабрь' },
];

const selectUi = {
  viewport: 'max-h-64',
};

const dayOptions = computed(() => {
  const year = Number(selectedYear.value);
  const month = Number(selectedMonth.value);
  let total = daysInSelectedMonth.value;

  if (year === currentYear && month === currentMonth) {
    total = Math.min(total, currentDay);
  }

  return Array.from({ length: total }, (_, index) => {
    const value = String(index + 1);
    return { value, label: value };
  });
});

const yearOptions = computed(() =>
  Array.from({ length: currentYear - 1900 + 1 }, (_, index) => {
    const value = String(currentYear - index);
    return { value, label: value };
  }),
);

const monthOptions = computed(() => {
  const year = Number(selectedYear.value);

  if (year === currentYear) {
    return months.filter((month) => Number(month.value) <= currentMonth);
  }

  return months;
});

const daysInSelectedMonth = computed(() => {
  const year = Number(selectedYear.value || currentYear);
  const month = Number(selectedMonth.value || 1);

  return dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
});

const canSubmit = computed(() =>
  Boolean(selectedDay.value && selectedMonth.value && selectedYear.value),
);
const selectedBirthDate = computed(() => {
  if (!canSubmit.value) {
    return null;
  }

  const year = selectedYear.value;
  const month = selectedMonth.value.padStart(2, '0');
  const day = selectedDay.value.padStart(2, '0');

  return `${year}-${month}-${day}`;
});

async function onSubmit() {
  if (await account.updateBirthDate(state.birth_date)) {
    open.value = false;
  }
}

const loading = computed(() => account.status.birthDate === 'pending');
const birthDateLabel = computed(() => {
  if (!auth.user.birth_date) return 'Указать';

  return dayjs(auth.user.birth_date).format('D MMMM YYYY');
});

function syncDraftFromUser() {
  state.birth_date = auth.user.birth_date;

  if (!auth.user.birth_date) {
    selectedDay.value = '';
    selectedMonth.value = '';
    selectedYear.value = '';
    return;
  }

  const parsed = dayjs(auth.user.birth_date);

  if (!parsed.isValid()) {
    return;
  }

  selectedDay.value = String(parsed.date());
  selectedMonth.value = String(parsed.month() + 1);
  selectedYear.value = String(parsed.year());
}

function clampSelectedDay() {
  const maxDay = Number(dayOptions.value[dayOptions.value.length - 1]?.value ?? 31);

  if (Number(selectedDay.value) > maxDay) {
    selectedDay.value = String(maxDay);
  }
}

async function handleSave() {
  if (!selectedBirthDate.value) {
    return;
  }

  state.birth_date = selectedBirthDate.value;
  await onSubmit();
}

function handleClear() {
  state.birth_date = null;
  selectedDay.value = '';
  selectedMonth.value = '';
  selectedYear.value = '';
  onSubmit();
}

watch(open, (isOpen) => {
  if (isOpen) {
    syncDraftFromUser();
  }
});

watch([selectedMonth, selectedYear], clampSelectedDay);
</script>

<template>
  <UModal v-model:open="open" title="День рождения" description="Укажите дату рождения">
    <UButton
      class="w-full justify-between"
      block
      size="xl"
      color="neutral"
      variant="ghost"
      label="День рождения"
      :trailing="true"
      :loading="loading"
      :disabled="loading"
    >
      <template v-slot:trailing>
        <div class="text-muted">{{ birthDateLabel }}</div>
      </template>
    </UButton>
    <template v-slot:content>
      <AppBar>
        <template v-slot:left>
          <UButton
            icon="i-ph-x-bold"
            size="xl"
            color="neutral"
            variant="ghost"
            @click="open = false"
          />
        </template>

        <template v-slot:center>День рождения</template>
      </AppBar>
      <div class="space-y-2 p-2">
        <div class="grid grid-cols-[1fr_1.35fr_1fr] gap-2">
          <USelect
            class="min-w-0"
            v-model="selectedDay"
            value-key="value"
            size="xl"
            color="neutral"
            variant="soft"
            placeholder="День"
            :items="dayOptions"
            :disabled="loading"
            :ui="selectUi"
          />
          <USelect
            class="min-w-0"
            v-model="selectedMonth"
            value-key="value"
            size="xl"
            color="neutral"
            variant="soft"
            placeholder="Месяц"
            :items="monthOptions"
            :disabled="loading"
            :ui="selectUi"
          />
          <USelect
            class="min-w-0"
            v-model="selectedYear"
            value-key="value"
            size="xl"
            color="neutral"
            variant="soft"
            placeholder="Год"
            :items="yearOptions"
            :disabled="loading"
            :ui="selectUi"
          />
        </div>

        <div class="flex flex-col gap-2">
          <UButton
            block
            size="xl"
            color="primary"
            variant="soft"
            label="Сохранить"
            :loading="loading"
            :disabled="loading || !canSubmit"
            @click="handleSave"
          />
          <UButton
            v-if="auth.user.birth_date"
            block
            size="xl"
            color="error"
            variant="ghost"
            label="Удалить"
            :loading="loading"
            :disabled="loading"
            @click="handleClear"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
