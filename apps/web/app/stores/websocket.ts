import { defineStore } from 'pinia';

type WebSocketStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

type PusherMessage = {
  event?: string;
  data?: string | Record<string, unknown>;
  channel?: string;
};

const DEFAULT_ACTIVITY_TIMEOUT_SECONDS = 30;
const PONG_TIMEOUT_MS = 10000;
const MAX_RECONNECT_DELAY_MS = 30000;

type PusherEventHandler = (data: Record<string, unknown>, message: PusherMessage) => void;
type ChannelSubscription = {
  channel: string;
  private: boolean;
  subscribed: boolean;
};

export const useWebSocketStore = defineStore('websocket', () => {
  const config = useRuntimeConfig();

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setTimeout> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let shouldReconnect = false;
  let activityTimeoutMs = DEFAULT_ACTIVITY_TIMEOUT_SECONDS * 1000;
  const subscriptions = new Map<string, ChannelSubscription>();
  const eventHandlers = new Map<string, Set<PusherEventHandler>>();

  const status = ref<WebSocketStatus>('idle');
  const socketId = ref<string | null>(null);
  const lastConnectedAt = ref<string | null>(null);
  const lastPongAt = ref<string | null>(null);
  const lastError = ref<string | null>(null);

  const isConfigured = computed(() => Boolean(config.public.reverbAppKey));
  const isConnecting = computed(() => ['connecting', 'reconnecting'].includes(status.value));
  const isConnected = computed(() => status.value === 'connected');

  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer) {
      clearTimeout(timer);
    }
  };

  const clearConnectionTimers = () => {
    clearTimer(pingTimer);
    clearTimer(pongTimer);
    pingTimer = null;
    pongTimer = null;
  };

  const websocketUrl = () => {
    const scheme = config.public.reverbScheme === 'https' ? 'wss' : 'ws';
    const host = String(config.public.reverbHost || window.location.hostname);
    const port = String(config.public.reverbPort || (scheme === 'wss' ? '443' : '80'));
    const key = encodeURIComponent(String(config.public.reverbAppKey));
    const url = new URL(`${scheme}://${host}:${port}/app/${key}`);

    url.searchParams.set('protocol', '7');
    url.searchParams.set('client', 'octo-nuxt');
    url.searchParams.set('version', '1.0.0');
    url.searchParams.set('flash', 'false');

    return url.toString();
  };

  const parseMessage = (event: MessageEvent<string>): PusherMessage | null => {
    try {
      return JSON.parse(event.data) as PusherMessage;
    } catch {
      return null;
    }
  };

  const parseData = (data: PusherMessage['data']) => {
    if (typeof data !== 'string') {
      return data ?? {};
    }

    try {
      return JSON.parse(data) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  const send = (message: PusherMessage) => {
    if (socket?.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(message));
    return true;
  };

  const normalizeEventName = (event: string) => (event.startsWith('.') ? event.slice(1) : event);

  const dispatchEvent = (message: PusherMessage) => {
    if (
      !message.event ||
      message.event.startsWith('pusher:') ||
      message.event.startsWith('pusher_internal:')
    ) {
      return;
    }

    const event = normalizeEventName(message.event);
    const data = parseData(message.data);
    const handlers = eventHandlers.get(event);

    if (!handlers) {
      return;
    }

    handlers.forEach((handler) => handler(data, message));
  };

  const authPrivateChannel = async (channel: string) => {
    const auth = useAuthStore();

    if (!socketId.value || !auth.token) {
      throw new Error('WebSocket private channel auth is not ready');
    }

    return await $fetch<{ auth: string; channel_data?: string }>(
      `${config.public.apiBase}/broadcasting/auth`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: {
          socket_id: socketId.value,
          channel_name: channel,
        },
      },
    );
  };

  const subscribeChannel = async (subscription: ChannelSubscription) => {
    if (!socketId.value || socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const data: Record<string, unknown> = {
        channel: subscription.channel,
      };

      if (subscription.private) {
        const auth = await authPrivateChannel(subscription.channel);
        data.auth = auth.auth;
        if (auth.channel_data) {
          data.channel_data = auth.channel_data;
        }
      }

      if (send({ event: 'pusher:subscribe', data })) {
        subscription.subscribed = true;
      }
    } catch (failure) {
      const error = failure as {
        data?: { message?: string };
        message?: string;
        status?: number;
        statusCode?: number;
      };
      subscription.subscribed = false;
      lastError.value = error?.data?.message ?? error?.message ?? 'WebSocket subscription failed';
      if (error?.status === 401 || error?.statusCode === 401) {
        useAuthStore().reset();
      }
    }
  };

  const subscribePendingChannels = () => {
    subscriptions.forEach((subscription) => {
      subscription.subscribed = false;
      void subscribeChannel(subscription);
    });
  };

  const schedulePing = () => {
    clearConnectionTimers();

    pingTimer = setTimeout(
      () => {
        if (!send({ event: 'pusher:ping', data: {} })) {
          reconnectNow();
          return;
        }

        pongTimer = setTimeout(reconnectNow, PONG_TIMEOUT_MS);
      },
      Math.max(5000, activityTimeoutMs - 5000),
    );
  };

  const scheduleReconnect = () => {
    if (!shouldReconnect || reconnectTimer) {
      return;
    }

    const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
    reconnectAttempt += 1;
    status.value = 'reconnecting';

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  function reconnectNow() {
    if (!shouldReconnect) {
      return;
    }

    closeSocket();
    scheduleReconnect();
  }

  function closeSocket() {
    clearConnectionTimers();

    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      socket.close();
    }

    socket = null;
    socketId.value = null;
    subscriptions.forEach((subscription) => {
      subscription.subscribed = false;
    });
  }

  function connect() {
    if (!import.meta.client || !isConfigured.value || !shouldReconnect) {
      status.value = isConfigured.value ? 'idle' : 'disconnected';
      return;
    }

    if (
      socket &&
      (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    closeSocket();
    status.value = reconnectAttempt > 0 ? 'reconnecting' : 'connecting';
    lastError.value = null;

    try {
      socket = new WebSocket(websocketUrl());
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'WebSocket connection failed';
      status.value = 'error';
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      status.value = 'connecting';
    };

    socket.onmessage = (event) => {
      const message = parseMessage(event);

      if (!message?.event) {
        return;
      }

      if (message.event !== 'pusher:pong') {
        schedulePing();
      }

      if (message.event === 'pusher:connection_established') {
        const data = parseData(message.data);
        const timeout = Number(data.activity_timeout ?? DEFAULT_ACTIVITY_TIMEOUT_SECONDS);

        socketId.value = typeof data.socket_id === 'string' ? data.socket_id : null;
        activityTimeoutMs = Number.isFinite(timeout)
          ? timeout * 1000
          : DEFAULT_ACTIVITY_TIMEOUT_SECONDS * 1000;
        reconnectAttempt = 0;
        status.value = 'connected';
        lastConnectedAt.value = new Date().toISOString();
        lastPongAt.value = lastConnectedAt.value;
        schedulePing();
        subscribePendingChannels();
        return;
      }

      if (message.event === 'pusher:ping') {
        send({ event: 'pusher:pong', data: {} });
        return;
      }

      if (message.event === 'pusher:pong') {
        clearTimer(pongTimer);
        pongTimer = null;
        lastPongAt.value = new Date().toISOString();
        schedulePing();
        return;
      }

      if (message.event === 'pusher:error') {
        lastError.value = JSON.stringify(parseData(message.data));
      }

      dispatchEvent(message);
    };

    socket.onerror = () => {
      lastError.value = 'WebSocket error';
      status.value = 'error';
    };

    socket.onclose = () => {
      clearConnectionTimers();
      socket = null;
      socketId.value = null;

      if (shouldReconnect) {
        scheduleReconnect();
      } else {
        status.value = 'disconnected';
      }
    };
  }

  function start() {
    if (!import.meta.client || !isConfigured.value) {
      status.value = isConfigured.value ? 'idle' : 'disconnected';
      return;
    }

    shouldReconnect = true;
    connect();
  }

  function stop() {
    shouldReconnect = false;
    clearTimer(reconnectTimer);
    reconnectTimer = null;
    reconnectAttempt = 0;
    closeSocket();
    status.value = 'disconnected';
  }

  function subscribePrivate(channel: string) {
    const normalizedChannel = channel.startsWith('private-') ? channel : `private-${channel}`;

    subscriptions.set(normalizedChannel, {
      channel: normalizedChannel,
      private: true,
      subscribed: false,
    });

    if (status.value === 'connected') {
      const subscription = subscriptions.get(normalizedChannel);
      if (subscription) {
        void subscribeChannel(subscription);
      }
    }
  }

  function unsubscribe(channel: string) {
    const normalizedChannel = channel.startsWith('private-') ? channel : `private-${channel}`;

    subscriptions.delete(normalizedChannel);
    send({
      event: 'pusher:unsubscribe',
      data: {
        channel: normalizedChannel,
      },
    });
  }

  function triggerPrivate(channel: string, event: string, data: Record<string, unknown> = {}) {
    const normalizedChannel = channel.startsWith('private-') ? channel : `private-${channel}`;
    const normalizedEvent = event.startsWith('client-') ? event : `client-${event}`;
    const subscription = subscriptions.get(normalizedChannel);

    if (!subscription?.subscribed) {
      return false;
    }

    return send({
      event: normalizedEvent,
      channel: normalizedChannel,
      data,
    });
  }

  function on(event: string, handler: PusherEventHandler) {
    const normalizedEvent = normalizeEventName(event);
    const handlers = eventHandlers.get(normalizedEvent) ?? new Set<PusherEventHandler>();

    handlers.add(handler);
    eventHandlers.set(normalizedEvent, handlers);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        eventHandlers.delete(normalizedEvent);
      }
    };
  }

  function $reset() {
    stop();
    lastConnectedAt.value = null;
    lastPongAt.value = null;
    lastError.value = null;
    subscriptions.clear();
  }

  return {
    status,
    socketId,
    lastConnectedAt,
    lastPongAt,
    lastError,
    isConfigured,
    isConnecting,
    isConnected,
    start,
    stop,
    send,
    triggerPrivate,
    subscribePrivate,
    unsubscribe,
    on,
    $reset,
  };
});
