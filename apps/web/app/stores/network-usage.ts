import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { estimatePayloadBytes, nonnegativeCounter } from '../utils/network-usage.ts';

export type NetworkUsageState = {
  sentBytes: number;
  receivedBytes: number;
  mediaBytes: number;
  successfulRequests: number;
  failedRequests: number;
  since: number;
};
export type NetworkAttempt = { userId: string; generation: number; finished: boolean };

const emptyState = (): NetworkUsageState => ({
  sentBytes: 0,
  receivedBytes: 0,
  mediaBytes: 0,
  successfulRequests: 0,
  failedRequests: 0,
  since: Date.now(),
});
const keyFor = (userId: string) => `octo:network-usage:v1:${userId}`;

export const useNetworkUsageStore = defineStore('network-usage', () => {
  const auth = useAuthStore();
  const accounts = ref<Record<string, NetworkUsageState>>({});
  const loaded = new Set<string>();
  const generations = new Map<string, number>();
  const userId = computed(() => String(auth.user.id ?? ''));
  const anonymous = emptyState();

  function ensure(id: string) {
    if (!id) return anonymous;
    if (!loaded.has(id)) {
      let value = emptyState();
      try {
        if (typeof window !== 'undefined') {
          const saved = JSON.parse(window.localStorage.getItem(keyFor(id)) ?? 'null');
          if (saved && typeof saved === 'object') {
            for (const key of [
              'sentBytes',
              'receivedBytes',
              'mediaBytes',
              'successfulRequests',
              'failedRequests',
            ] as const) {
              value[key] = nonnegativeCounter(saved[key]);
            }
            value.since = nonnegativeCounter(saved.since) || value.since;
          }
        }
      } catch {
        /* Keep working when browser storage is unavailable. */
      }
      accounts.value[id] = value;
      loaded.add(id);
    }
    return accounts.value[id]!;
  }

  function persist(id: string) {
    try {
      if (typeof window !== 'undefined' && id) {
        window.localStorage.setItem(keyFor(id), JSON.stringify(accounts.value[id]));
      }
    } catch {
      /* Session counters remain usable without persistence. */
    }
  }

  const state = computed(() => ensure(userId.value));
  const totalBytes = computed(
    () => state.value.sentBytes + state.value.receivedBytes + state.value.mediaBytes,
  );

  function beginAttempt(body: unknown): NetworkAttempt | null {
    const id = userId.value;
    if (!id) return null;
    ensure(id).sentBytes += estimatePayloadBytes(body);
    persist(id);
    return { userId: id, generation: generations.get(id) ?? 0, finished: false };
  }

  function finishAttempt(
    attempt: NetworkAttempt | null | undefined,
    body: unknown,
    success: boolean,
  ) {
    if (!attempt || attempt.finished) return;
    attempt.finished = true;
    if ((generations.get(attempt.userId) ?? 0) !== attempt.generation) return;
    const usage = ensure(attempt.userId);
    usage.receivedBytes += estimatePayloadBytes(body);
    usage[success ? 'successfulRequests' : 'failedRequests']++;
    persist(attempt.userId);
  }

  function recordMedia(bytes: number, id: string, startedAt: number) {
    if (!id) return;
    const usage = ensure(id);
    if (startedAt < usage.since) return;
    usage.mediaBytes += nonnegativeCounter(bytes);
    persist(id);
  }

  function reset() {
    const id = userId.value;
    if (!id) return;
    ensure(id);
    generations.set(id, (generations.get(id) ?? 0) + 1);
    accounts.value[id] = emptyState();
    persist(id);
  }

  return { state, totalBytes, beginAttempt, finishAttempt, recordMedia, reset };
});
