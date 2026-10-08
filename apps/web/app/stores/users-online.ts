import { defineStore } from 'pinia';

type LastSeenValue = string | Date | null;
type LastSeenSource = 'backend' | 'websocket';
type LastSeenRecord = {
  value: string | null;
  source: LastSeenSource;
};

const ONLINE_THRESHOLD_MS = 60 * 1000;
const ONLINE_TEXT_TICK_MS = 5 * 60 * 1000;

const normalizeUserId = (value?: string | number | null) => String(value ?? '').trim();
const toIso = (value: LastSeenValue) => {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getDate = (value?: string | null) => {
  if (value === null) {
    return null;
  }

  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date);

export const useUsersOnlineStore = defineStore('users-online', () => {
  const { withCount } = useInflection();
  const lastSeenByUserId = ref<Record<string, LastSeenRecord>>({});
  const now = ref(Date.now());
  let lastHeartbeatSentAt = 0;
  let heartbeatGeneration = 0;

  const sendHeartbeat = async () => {
    const auth = useAuthStore();
    if (!auth.token || !useWebSocketStore().isConnected) return;
    const timestamp = Date.now();
    if (timestamp - lastHeartbeatSentAt < 25000) return;
    const generation = heartbeatGeneration;
    const userId = auth.user?.id;
    lastHeartbeatSentAt = timestamp;
    try {
      const response = await $http<{ ok: boolean; last_seen_at?: string | null }>(
        'realtime/heartbeat',
        { method: 'PATCH' },
      );
      if (generation === heartbeatGeneration && response?.last_seen_at && userId) {
        setWebSocketLastSeen(userId, response.last_seen_at);
      }
    } catch {
      if (generation === heartbeatGeneration) lastHeartbeatSentAt = 0;
    }
  };
  let ticker: ReturnType<typeof window.setInterval> | null = null;

  const startTicker = () => {
    if (!import.meta.client || ticker) {
      return;
    }

    ticker = window.setInterval(() => {
      now.value = Date.now();
    }, ONLINE_TEXT_TICK_MS);
  };

  const setLastSeen = (
    userId?: string | number | null,
    lastSeenAt: LastSeenValue = null,
    source: LastSeenSource = 'websocket',
  ) => {
    const safeUserId = normalizeUserId(userId);

    if (!safeUserId) {
      return;
    }

    lastSeenByUserId.value[safeUserId] = {
      value: toIso(lastSeenAt),
      source,
    };
    now.value = Date.now();
  };

  const setBackendLastSeen = (
    userId?: string | number | null,
    lastSeenAt: LastSeenValue = null,
  ) => {
    const safeUserId = normalizeUserId(userId);

    if (!safeUserId || lastSeenByUserId.value[safeUserId]?.source === 'websocket') {
      return;
    }

    setLastSeen(safeUserId, lastSeenAt, 'backend');
  };

  const setWebSocketLastSeen = (
    userId?: string | number | null,
    lastSeenAt: LastSeenValue = null,
  ) => {
    setLastSeen(userId, lastSeenAt, 'websocket');
  };

  const getOnlineText = (userId?: string | number | null, fallback = 'был(-а) давно') => {
    const safeUserId = normalizeUserId(userId);

    if (!safeUserId) {
      return fallback;
    }

    const lastSeenAt = getDate(lastSeenByUserId.value[safeUserId]?.value);

    if (lastSeenAt === null) {
      return fallback;
    }

    if (!lastSeenAt) {
      return fallback;
    }

    const currentDate = new Date(now.value);
    const diffMs = now.value - lastSeenAt.getTime();

    if (diffMs <= ONLINE_THRESHOLD_MS) {
      return 'online';
    }

    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    if (diffMinutes < 60) {
      return `был(-а) ${withCount(diffMinutes, ['минуту', 'минуты', 'минут'])} назад`;
    }

    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

    if (diffHours < 12) {
      return `был(-а) ${withCount(diffHours, ['час', 'часа', 'часов'])} назад`;
    }

    if (sameDay(currentDate, lastSeenAt)) {
      return `был(-а) сегодня в ${formatTime(lastSeenAt)}`;
    }

    const yesterday = new Date(currentDate);
    yesterday.setDate(currentDate.getDate() - 1);

    if (sameDay(yesterday, lastSeenAt)) {
      return `был(-а) вчера в ${formatTime(lastSeenAt)}`;
    }

    return `был(-а) ${formatDate(lastSeenAt)}`;
  };

  const isOnline = (userId?: string | number | null) => {
    const safeUserId = normalizeUserId(userId);

    if (!safeUserId) {
      return false;
    }

    const lastSeenAt = getDate(lastSeenByUserId.value[safeUserId]?.value);

    if (!lastSeenAt) {
      return false;
    }

    return now.value - lastSeenAt.getTime() <= ONLINE_THRESHOLD_MS;
  };

  function $reset() {
    heartbeatGeneration += 1;
    lastHeartbeatSentAt = 0;
    lastSeenByUserId.value = {};
    now.value = Date.now();
  }

  startTicker();

  return {
    lastSeenByUserId,
    sendHeartbeat,
    setLastSeen,
    setBackendLastSeen,
    setWebSocketLastSeen,
    getOnlineText,
    isOnline,
    $reset,
  };
});
