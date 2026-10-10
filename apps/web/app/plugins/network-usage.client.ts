export default defineNuxtPlugin((nuxtApp) => {
  if (typeof PerformanceObserver === 'undefined') return;
  const auth = useAuthStore();
  const usage = useNetworkUsageStore();
  void usage.state;
  const accounts = [{ start: performance.now(), id: String(auth.user.id ?? '') }];
  const stop = watch(
    () => String(auth.user.id ?? ''),
    (id) => {
      void usage.state;
      accounts.push({ start: performance.now(), id });
    },
    { flush: 'sync' },
  );
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
      // fetch/XHR are measured by the HTTP plugin; never add their bytes again.
      if (!['img', 'video', 'audio'].includes(entry.initiatorType) || !entry.transferSize) continue;
      const account = accounts.findLast((item) => item.start <= entry.startTime);
      if (account?.id) {
        usage.recordMedia(entry.transferSize, account.id, performance.timeOrigin + entry.startTime);
      }
    }
  });
  try {
    observer.observe({ type: 'resource' });
  } catch {
    stop();
    return;
  }
  nuxtApp.vueApp.onUnmount(() => {
    observer.disconnect();
    stop();
  });
});
