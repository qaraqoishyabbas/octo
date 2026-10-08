<script setup lang="ts">
const props = defineProps<{
  createdAt: string;
}>();

const dayjs = useDayjs();

function formatSmartDate(input: string | number | Date) {
  const d = dayjs(input);
  const now = dayjs();

  // 1) Сегодня → HH:mm
  if (d.isSame(now, 'day')) return d.format('HH:mm');

  // 2) Вчера, эта неделя (кроме сегодня) или прошлая неделя → dd
  const nativeNow = now.toDate();
  const dowMon0 = (nativeNow.getDay() + 6) % 7; // понедельник=0
  const startThisWeek = new Date(nativeNow);
  startThisWeek.setDate(nativeNow.getDate() - dowMon0);
  startThisWeek.setHours(0, 0, 0, 0);

  const startLastWeek = new Date(startThisWeek);
  startLastWeek.setDate(startThisWeek.getDate() - 7);

  const dDate = d.toDate();
  const isYesterday = d.isSame(now.subtract(1, 'day'), 'day');
  const inThisWeekPast = dDate >= startThisWeek && d.isBefore(now, 'day');
  const inLastWeek = dDate >= startLastWeek && dDate < startThisWeek;

  if (isYesterday || inThisWeekPast || inLastWeek) {
    return d.format('dd'); // двухбуквенный день недели (пн, вт, ...)
  }

  // 3) Текущий год → DD MMM
  if (d.isSame(now, 'year')) return d.format('DD MMM');

  // 4) Всё остальное → DD.MM.YYYY
  return d.format('DD.MM.YYYY');
}
</script>

<template>
  <span>{{ formatSmartDate(props.createdAt) }}</span>
</template>
