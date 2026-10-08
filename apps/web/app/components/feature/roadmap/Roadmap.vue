<script setup lang="ts">
useSeoMeta({ title: 'Roadmap' });

type RoadmapStatus = 'backlog' | 'in_progress' | 'done';

interface RoadmapTask {
  id: number;
  title: string;
  description: string;
  status: RoadmapStatus;
}

const emit = defineEmits<{ close: [boolean] }>();

const statusConfig: Record<RoadmapStatus, { title: string; icon: string; iconClass: string }> = {
  backlog: {
    title: 'Бэклог',
    icon: 'i-ph-circle-bold',
    iconClass: 'text-blue-500',
  },
  in_progress: {
    title: 'В работе',
    icon: 'i-ph-circle-dashed-bold',
    iconClass: 'text-warning-500',
  },
  done: {
    title: 'Выполнено',
    icon: 'i-ph-check-circle-bold',
    iconClass: 'text-success-500',
  },
};

const tasks = ref<RoadmapTask[]>([
  {
    id: 1,
    title: 'База мессенджера',
    description:
      'Личные диалоги, группы, каналы, список пользователей, создание чатов и базовые профили уже реализованы.',
    status: 'done',
  },
  {
    id: 2,
    title: 'Сообщения как в Telegram',
    description:
      'Отправка текста, ответы, редактирование, удаление, закрепление, курсорная пагинация и переход к конкретному сообщению уже работают.',
    status: 'done',
  },
  {
    id: 3,
    title: 'Медиа, файлы и ссылки',
    description:
      'Есть загрузка вложений, превью медиа, скачивание файлов, список медиа/файлов/ссылок в профиле диалога.',
    status: 'done',
  },
  {
    id: 4,
    title: 'Realtime-слой',
    description:
      'WebSocket, события новых/измененных/удаленных сообщений, typing indicator, heartbeat и онлайн-статусы уже подключены.',
    status: 'done',
  },
  {
    id: 5,
    title: 'Непрочитанные и упоминания',
    description:
      'Счетчики непрочитанных, первая непрочитанная позиция, отметка прочтения и напоминания по @mentions покрыты API и фронтом.',
    status: 'done',
  },
  {
    id: 6,
    title: 'Настройки диалогов',
    description:
      'Закрепление диалогов, выключение уведомлений, invite-link, роли owner/admin/member и выход из диалога уже заложены.',
    status: 'done',
  },
  {
    id: 7,
    title: 'Поиск внутри чата',
    description:
      'Поиск сообщений есть, но его нужно довести: подсветка совпадений, поиск по всем чатам, фильтры по автору, дате, медиа и файлам.',
    status: 'done',
  },
  {
    id: 8,
    title: 'Права групп и каналов',
    description:
      'Роли уже есть, дальше нужны точные Telegram-права: писать, закреплять, удалять чужие сообщения, менять профиль, приглашать участников.',
    status: 'done',
  },
  {
    id: 9,
    title: 'Уведомления',
    description:
      'Laravel-сервис приложений, credentials и токенов; окно управления в админке; Web Push, FCM, APNs, очередь, настройки звука и badge, mute/упоминания и тихие сообщения реализованы. Для внешней доставки нужны рабочие ключи провайдеров.',
    status: 'done',
  },
  {
    id: 10,
    title: 'Мобильная эргономика',
    description:
      'Проверить все основные сценарии на телефоне: свайпы, длинные сообщения, клавиатуру, скролл, меню сообщений и область ввода.',
    status: 'backlog',
  },
  {
    id: 11,
    title: 'Стабильность загрузок',
    description:
      'Upload-пайплайн стабилизирован: прогресс, отмена, повтор, лимиты размера и количества файлов, очистка временных файлов и единая загрузка аватаров.',
    status: 'done',
  },
  {
    id: 12,
    title: 'Forward и share',
    description:
      'Добавить пересылку сообщений, шаринг сообщений/файлов в другие чаты, copy link to message и выбор нескольких получателей.',
    status: 'backlog',
  },
  {
    id: 13,
    title: 'Реакции',
    description:
      'Добавить emoji-реакции к сообщениям, быстрые реакции, список пользователей по реакции и realtime-обновления.',
    status: 'backlog',
  },
  {
    id: 14,
    title: 'Голосовые и видео-сообщения',
    description:
      'Запись голосовых, waveform, длительность, воспроизведение в пузыре, отправка коротких видео и корректное хранение метаданных.',
    status: 'backlog',
  },
  {
    id: 15,
    title: 'Звонки',
    description:
      'Личные и групповые audio/video calls: WebRTC-сигналинг, экран звонка, входящие вызовы, статусы занято/пропущено.',
    status: 'backlog',
  },
  {
    id: 16,
    title: 'Папки и архив',
    description:
      'Добавить папки чатов, архив, фильтры unread/personal/groups/channels, закрепы внутри папок и быстрые переключатели.',
    status: 'done',
  },
  {
    id: 17,
    title: 'Черновики и scheduled messages',
    description:
      'Черновики уже есть на фронте, но нужны серверная синхронизация, отложенная отправка и напоминания по сообщениям.',
    status: 'backlog',
  },
  {
    id: 18,
    title: 'Стикеры, GIF и emoji-панель',
    description:
      'Сделать Telegram-like composer: emoji picker, стикерпаки, GIF-поиск, recent items и предпросмотр перед отправкой.',
    status: 'backlog',
  },
  {
    id: 19,
    title: 'Боты и команды',
    description:
      'Подготовить bot API: токены ботов, slash-команды, inline-кнопки, webhook/events и системные сообщения.',
    status: 'backlog',
  },
  {
    id: 20,
    title: 'Безопасность и приватность',
    description:
      'Двухфакторная защита, активные сессии с гео/IP, настройки видимости username/last seen/avatar и audit log для админ-действий.',
    status: 'backlog',
  },
  {
    id: 21,
    title: 'Модерация',
    description:
      'Жалобы, bans/kicks, slow mode, ограничения новых участников, журнал действий и инструменты владельца канала/группы.',
    status: 'backlog',
  },
  {
    id: 22,
    title: 'Производительность',
    description:
      'Индексы под большие чаты, оптимизация поиска, lazy media, CDN/storage strategy, нагрузочные тесты WebSocket и API.',
    status: 'backlog',
  },
  {
    id: 23,
    title: 'Онлайн встречи',
    description:
      'Сервис для онлайн встреч. Человек может создать онлайн встречу. Аудио-видео звонки. админ может создавать ссылку на вход на встречу. Так же может приглашать пользователей на встречу. Функционал как Teams онлайн звонки.',
    status: 'done',
  },
]);

const groupedTasks = computed(() => {
  return (Object.keys(statusConfig) as RoadmapStatus[]).map((status) => ({
    status,
    ...statusConfig[status],
    tasks: tasks.value.filter((task) => task.status === status),
  }));
});
</script>

<template>
  <UModal
    title="Roadmap"
    description="План задач по продукту"
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
            @click="emit('close', false)"
          />
        </template>
        <template #center>Roadmap</template>
      </AppBar>
      <div
        class="min-h-0 flex-1 snap-x snap-mandatory scroll-px-2 overflow-x-auto overflow-y-auto scroll-smooth [-webkit-overflow-scrolling:touch]"
      >
        <div class="grid min-w-[64rem] grid-cols-3 gap-2 p-2">
          <section
            class="bg-elevated/50 flex snap-center snap-always flex-col gap-2 rounded-md p-2"
            v-for="group in groupedTasks"
            :key="group.status"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon :name="group.icon" :class="['size-4', group.iconClass]" />
                <h3 class="text-sm font-semibold">{{ group.title }}</h3>
              </div>
            </div>

            <div class="space-y-1">
              <article class="bg-default rounded-md p-2" v-for="task in group.tasks" :key="task.id">
                <div class="mb-2 flex items-start justify-between gap-2">
                  <h4 class="text-sm leading-tight font-semibold">
                    {{ task.title }}
                  </h4>
                </div>

                <p class="text-muted text-xs leading-relaxed">
                  {{ task.description }}
                </p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </template>
  </UModal>
</template>
