<script setup lang="ts">
useSeoMeta({ title: 'Roadmap' });

type RoadmapStatus = 'backlog' | 'in_progress' | 'review' | 'done';
type RoadmapStage = 'R0' | 'R1' | 'R2' | 'R3' | 'later';

interface RoadmapTask {
  id: string;
  stage: RoadmapStage;
  priority: 'P0' | 'P1' | 'P2';
  dependency?: string;
  title: string;
  description: string;
  status: RoadmapStatus;
}

const emit = defineEmits<{ close: [boolean] }>();

const statusConfig: Record<RoadmapStatus, { title: string; icon: string; iconClass: string }> = {
  backlog: {
    title: 'Запланировано',
    icon: 'i-ph-circle-bold',
    iconClass: 'text-blue-500',
  },
  in_progress: {
    title: 'В работе',
    icon: 'i-ph-circle-dashed-bold',
    iconClass: 'text-warning-500',
  },
  review: {
    title: 'На проверке',
    icon: 'i-ph-magnifying-glass-bold',
    iconClass: 'text-warning-500',
  },
  done: {
    title: 'Принято',
    icon: 'i-ph-check-circle-bold',
    iconClass: 'text-success-500',
  },
};

const stages: { id: RoadmapStage; title: string; description: string }[] = [
  {
    id: 'R0',
    title: 'Доступ и приватность',
    description: 'Безопасный доступ к админке и вложениям, изоляция аккаунтов и проверки.',
  },
  {
    id: 'R1',
    title: 'Надёжность сообщений',
    description: 'Отправка без дубликатов, восстановление истории и устойчивые загрузки.',
  },
  {
    id: 'R2',
    title: 'Пользовательская приёмка',
    description: 'Проверка сценариев на телефонах и компьютерах, доступности и уведомлений.',
  },
  {
    id: 'R3',
    title: 'Запуск и пилот',
    description: 'Развёртывание, резервные копии, мониторинг и первые пользователи.',
  },
  {
    id: 'later',
    title: 'После первого релиза',
    description: 'Развитие функций по обратной связи пилота.',
  },
];

// Согласовано с docs/project/roadmap.md, 12 октября 2026.
const tasks = ref<RoadmapTask[]>([
  {
    id: 'R0.1',
    stage: 'R0',
    priority: 'P0',
    title: 'Ограничить админку отдельной ролью платформы',
    description:
      'Обычный пользователь не открывает и не выполняет admin routes; владелец группы не становится platform admin; назначение роли контролируемо',
    status: 'backlog',
  },
  {
    id: 'R0.2',
    stage: 'R0',
    priority: 'P0',
    title: 'Закрыть private attachments и previews',
    description:
      'Для direct/group нет обхода проверки через /storage; права одинаковы для preview/download/original/range; существующие файлы перенесены с проверкой сохранности',
    status: 'backlog',
  },
  {
    id: 'R0.3',
    stage: 'R0',
    priority: 'P0',
    title: 'Определить и реализовать cache/session lifecycle',
    description:
      'Legacy API cache удаляется; A → logout → B → offline не показывает содержимое A; pending operations и push state изолированы',
    status: 'backlog',
  },
  {
    id: 'R0.4',
    stage: 'R0',
    priority: 'P1',
    title: 'Исправить взаимодействие notification rows',
    description:
      'Один click/Space меняет значение один раз; DOM доступен; текущий failing test и browser check проходят',
    status: 'backlog',
  },
  {
    id: 'R0.5',
    stage: 'R0',
    priority: 'P1',
    title: 'Настроить единый quality gate',
    description:
      'PHP tests, web tests, admin/web builds и frontend generate воспроизводимы; проверки запускаются в CI; известные build warnings оценены',
    status: 'backlog',
  },
  {
    id: 'R1.1',
    stage: 'R1',
    priority: 'P1',
    title: 'Идемпотентная отправка',
    description:
      'Потерян ответ после commit → retry с тем же key → одно сообщение и один набор attachments; другой payload с тем же key отклоняется; конкурентные запросы проверены',
    dependency: 'R0.5; backend + frontend contract',
    status: 'backlog',
  },
  {
    id: 'R1.2',
    stage: 'R1',
    priority: 'P1',
    title: 'Reconnect reconciliation',
    description:
      'Создание/изменение/удаление/pin во время offline сходятся в открытой истории, preview и unread после reconnect; scroll anchor сохраняется',
    dependency: 'R1.1 и versioned response contract',
    status: 'backlog',
  },
  {
    id: 'R1.3',
    stage: 'R1',
    priority: 'P1',
    title: 'Устойчивый file lifecycle',
    description:
      'Ошибка move/thumbnail/DB rollback имеет определённый результат; orphan/missing files диагностируются; retry не теряет attachment',
    dependency: 'R0.2, R1.1',
    status: 'backlog',
  },
  {
    id: 'R1.4',
    stage: 'R1',
    priority: 'P1',
    title: 'Изолировать побочные эффекты отправки',
    description:
      'Failure link sync/broadcast/push после commit не приводит к ложному провалу и дубликату; retries побочных задач безопасны',
    dependency: 'R1.1, application service design',
    status: 'backlog',
  },
  {
    id: 'R1.5',
    stage: 'R1',
    priority: 'P1',
    title: 'Границы истечения/отзыва сессии',
    description:
      '401, отзыв устройства и смена пользователя прекращают запросы/подписки, очищают приватный state и ведут к понятному входу',
    dependency: 'R0.3',
    status: 'backlog',
  },
  {
    id: 'R2.1',
    stage: 'R2',
    priority: 'P1',
    title: 'Mobile keyboard, scroll, overlays',
    description:
      'При soft keyboard composer доступен; history anchor стабилен; Back закрывает нужный overlay; safe areas и orientation приняты',
    status: 'backlog',
  },
  {
    id: 'R2.2',
    stage: 'R2',
    priority: 'P1',
    title: 'Единые состояния операций',
    description:
      'Loading/empty/error/retry/offline/unknown send различимы; устаревший ответ не заменяет текущий screen; сообщение не теряется при закрытии upload UI',
    status: 'backlog',
  },
  {
    id: 'R2.3',
    stage: 'R2',
    priority: 'P1',
    title: 'Доступность и локализация основных экранов',
    description:
      'Масштабирование доступно; focus/labels/keyboard корректны; нет двойных интерактивных контролов; login/chat/settings на ru/kk/en проверены',
    status: 'backlog',
  },
  {
    id: 'R2.4',
    stage: 'R2',
    priority: 'P1',
    title: 'Реальная доставка Web Push',
    description:
      'Настроенный provider доставляет фоновые push; mute/mentions/silent/names/text/badge проверены; denied/unsupported состояния понятны; Safari принят отдельно либо ограничение явно зафиксировано',
    status: 'backlog',
  },
  {
    id: 'R2.5',
    stage: 'R2',
    priority: 'P1',
    title: 'Сквозные browser regression tests',
    description:
      'Воспроизводимые сценарии login → chat → send → receive → reply/edit/delete/pin → search → attachment; есть account switch/reconnect/revoked permission проверки',
    status: 'backlog',
  },
  {
    id: 'R2.6',
    stage: 'R2',
    priority: 'P1',
    title: 'Согласовать продуктовые обещания',
    description:
      'Интерфейс roadmap отражает новый план; папки описаны как фильтры; disabled services и экспериментальные встречи не выглядят как готовые обязательные функции',
    status: 'backlog',
  },
  {
    id: 'R3.1',
    stage: 'R3',
    priority: 'P0',
    title: 'Репетиция deployment',
    description:
      'PostgreSQL migrations, HTTPS, CORS, Reverb origins, private storage, admin assets, PWA generation и queue/scheduler проверены на staging; тестового default admin password нет',
    status: 'backlog',
  },
  {
    id: 'R3.2',
    stage: 'R3',
    priority: 'P0',
    title: 'Backup и восстановление',
    description:
      'БД, вложения и необходимые ключи восстановлены в отдельном окружении; количество/связи данных и чтение файлов проверены; согласованы RPO/RTO',
    status: 'backlog',
  },
  {
    id: 'R3.3',
    stage: 'R3',
    priority: 'P1',
    title: 'Наблюдаемость',
    description:
      'Видны API errors/latency, queue failures, Reverb disconnects и storage errors; нет secrets/message bodies в logs; назначен оператор и путь реакции',
    status: 'backlog',
  },
  {
    id: 'R3.4',
    stage: 'R3',
    priority: 'P1',
    title: 'Измеренный baseline нагрузки',
    description:
      'Сценарий соответствует согласованному размеру пилота; записаны latency p50/p95, errors, message delivery lag, query count, CPU/RAM, file throughput; цели согласованы до измерения',
    status: 'backlog',
  },
  {
    id: 'R3.5',
    stage: 'R3',
    priority: 'P1',
    title: 'Релизный runbook и rollback',
    description:
      'Есть smoke checklist, порядок migrations/deploy, клиентское обновление SW, действия при failed jobs и стратегия отката с совместимостью данных',
    status: 'backlog',
  },
  {
    id: 'R3.6',
    stage: 'R3',
    priority: 'P1',
    title: 'Закрытый пилот',
    description:
      'Назначены участники/срок наблюдения; собрано feedback; нет открытых P0/P1; ограничения и поддержка понятны пользователям',
    status: 'backlog',
  },
  {
    id: 'P2.1',
    stage: 'later',
    priority: 'P2',
    title: 'Пересылка/share',
    description: 'Forward с происхождением, выбор получателей, разрешённые ссылки на сообщения',
    dependency: 'Права доступа и семантика private/public content',
    status: 'backlog',
  },
  {
    id: 'P2.2',
    stage: 'later',
    priority: 'P2',
    title: 'Реакции',
    description: 'Идемпотентные реакции, агрегаты, пользователи, realtime',
    dependency: 'Конкурентные изменения и versioned event contract',
    status: 'backlog',
  },
  {
    id: 'P2.3',
    stage: 'later',
    priority: 'P2',
    title: 'Голосовые',
    description: 'Recording, duration/waveform, playback, interruption recovery',
    dependency: 'Private media lifecycle и browser permissions',
    status: 'backlog',
  },
  {
    id: 'P2.4',
    stage: 'later',
    priority: 'P2',
    title: 'Поиск',
    description: 'Подсветка, author/date/media filters; затем глобальный поиск',
    dependency: 'Query measurements и фильтрация доступа',
    status: 'backlog',
  },
  {
    id: 'P2.5',
    stage: 'later',
    priority: 'P2',
    title: 'Черновики/папки',
    description: 'Cross-device drafts и пользовательские server folders',
    dependency: 'Conflict policy, schema/API и account isolation',
    status: 'backlog',
  },
  {
    id: 'P2.6',
    stage: 'later',
    priority: 'P2',
    title: 'Встречи',
    description: 'Закрытые room permissions, TURN, incoming calls/missed states',
    dependency:
      'Отдельный design и network QA; масштаб групп — отдельное решение по media topology',
    status: 'backlog',
  },
  {
    id: 'P2.7',
    stage: 'later',
    priority: 'P2',
    title: 'Модерация',
    description: 'Reports, bans, audit, slow mode',
    dependency: 'Принятая модель ролей и журнал административных действий',
    status: 'backlog',
  },
  {
    id: 'P2.8',
    stage: 'later',
    priority: 'P2',
    title: 'Доступ и recovery',
    description: '2FA, восстановление и при необходимости открытая регистрация',
    dependency: 'Реальная identity/email policy и abuse handling',
    status: 'backlog',
  },
  {
    id: 'P2.9',
    stage: 'later',
    priority: 'P2',
    title: 'Масштабирование',
    description: 'Object storage, отдельные workers, Redis/search по измерениям',
    dependency: 'Baseline R3.4 и реальные bottlenecks',
    status: 'backlog',
  },
  {
    id: 'P2.10',
    stage: 'later',
    priority: 'P2',
    title: 'Стикеры/GIF/боты',
    description: 'Отдельные продукты и интеграции',
    dependency: 'Потребность пилота, лицензирование источников, scope',
    status: 'backlog',
  },
]);

const groupedTasks = computed(() =>
  stages.map((stage) => ({
    ...stage,
    tasks: tasks.value.filter((task) => task.stage === stage.id),
  })),
);
</script>

<template>
  <UModal
    title="Roadmap"
    description="План стабильного первого релиза Octo"
    :ui="{ content: 'max-w-5xl h-[85dvh] max-h-[85dvh] flex flex-col overflow-hidden' }"
  >
    <template #content>
      <AppBar>
        <template #left>
          <UButton
            color="neutral"
            icon="i-ph-x-bold"
            size="xl"
            variant="ghost"
            aria-label="Закрыть roadmap"
            @click="emit('close', false)"
          />
        </template>
        <template #center>Roadmap</template>
      </AppBar>
      <div class="space-y-1 px-3 py-2">
        <p class="text-sm font-semibold">Цель — стабильный первый релиз</p>
        <p class="text-muted text-xs leading-relaxed">
          Порядок этапов: R0 → R1 → R2 → R3. Сроки пока не назначены. Задача принимается после
          проверки результата.
        </p>
        <p class="text-muted text-xs leading-relaxed">
          P0 — условия допуска к пилоту · P1 — качество первого релиза · P2 — развитие после релиза.
        </p>
      </div>
      <div
        class="min-h-0 flex-1 snap-x snap-mandatory scroll-px-2 overflow-x-auto overflow-y-auto scroll-smooth [-webkit-overflow-scrolling:touch]"
      >
        <div class="flex w-max gap-2 p-2">
          <section
            class="bg-elevated/50 flex w-80 snap-center snap-always flex-col gap-2 rounded-md p-2"
            v-for="group in groupedTasks"
            :key="group.id"
          >
            <div class="space-y-1 p-1">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">
                  <span v-if="group.id !== 'later'">{{ group.id }} · </span>{{ group.title }}
                </h3>
                <span class="text-muted text-xs">{{ group.tasks.length }}</span>
              </div>
              <p class="text-muted text-xs leading-relaxed">{{ group.description }}</p>
            </div>

            <div class="space-y-1">
              <article class="bg-default rounded-md p-2" v-for="task in group.tasks" :key="task.id">
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span class="text-muted">{{ task.id }} · {{ task.priority }}</span>
                  <span class="flex items-center gap-1">
                    <UIcon
                      :name="statusConfig[task.status].icon"
                      :class="['size-3', statusConfig[task.status].iconClass]"
                    />
                    {{ statusConfig[task.status].title }}
                  </span>
                </div>
                <div class="mb-2 flex items-start justify-between gap-2">
                  <h4 class="text-sm leading-tight font-semibold">
                    {{ task.title }}
                  </h4>
                </div>

                <p class="text-muted text-xs leading-relaxed">
                  <span class="text-default font-medium">{{
                    task.stage === 'later' ? 'Результат:' : 'Готово, когда:'
                  }}</span>
                  {{ task.description }}
                </p>
                <p class="text-muted mt-2 text-xs leading-relaxed" v-if="task.dependency">
                  <span class="text-default font-medium">Предпосылка:</span>
                  {{ task.dependency }}
                </p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </template>
  </UModal>
</template>
