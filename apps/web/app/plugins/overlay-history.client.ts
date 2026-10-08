import type { Component } from 'vue';

type OverlayInstance = {
  id: symbol;
  isOpen: boolean;
  open: (props?: unknown) => unknown;
  close: (value?: unknown) => void;
  patch: (props: unknown) => void;
};

type OverlayController = ReturnType<typeof useOverlay> & {
  __historyPatched?: boolean;
};

type OverlayStackEntry = {
  id: symbol;
  props?: unknown;
};

const OVERLAY_HISTORY_KEY = '__octo_overlay';
const OVERLAY_HISTORY_DEPTH_KEY = '__octo_overlay_depth';

export default defineNuxtPlugin(() => {
  const overlay = useOverlay() as OverlayController;

  if (overlay.__historyPatched) {
    return;
  }

  overlay.__historyPatched = true;

  const rawCreate = overlay.create.bind(overlay);
  const rawOpen = overlay.open.bind(overlay);
  const rawClose = overlay.close.bind(overlay);
  const rawCloseAll = overlay.closeAll.bind(overlay);
  const rawIsOpen = overlay.isOpen.bind(overlay);
  const historyStack: OverlayStackEntry[] = [];
  let activeDepth = 0;
  let ignoreNextPopState = false;
  let skipHistorySync = false;

  const isOverlayHistoryState = () => Boolean(window.history.state?.[OVERLAY_HISTORY_KEY]);
  const overlayHistoryDepth = () => {
    const depth = Number(window.history.state?.[OVERLAY_HISTORY_DEPTH_KEY] ?? 0);

    return Number.isFinite(depth) && depth > 0 ? depth : 0;
  };

  const pushOverlayHistoryEntry = () => {
    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        [OVERLAY_HISTORY_KEY]: true,
        [OVERLAY_HISTORY_DEPTH_KEY]: activeDepth,
      },
      '',
      window.location.href,
    );
  };

  const removeCurrentOverlayHistoryEntry = () => {
    if (!isOverlayHistoryState()) {
      return;
    }

    ignoreNextPopState = true;
    window.history.back();
  };

  const closeToDepth = (targetDepth: number) => {
    skipHistorySync = true;

    try {
      for (let depth = activeDepth; depth > targetDepth; depth -= 1) {
        const entry = historyStack[depth - 1];

        if (entry?.id && rawIsOpen(entry.id)) {
          rawClose(entry.id, false);
        }
      }

      activeDepth = targetDepth;
    } finally {
      skipHistorySync = false;
    }
  };

  const openToDepth = (targetDepth: number) => {
    skipHistorySync = true;

    try {
      for (let depth = activeDepth; depth < targetDepth; depth += 1) {
        const entry = historyStack[depth];

        if (entry?.id && !rawIsOpen(entry.id)) {
          rawOpen(entry.id, entry.props as never);
        }
      }

      activeDepth = targetDepth;
    } finally {
      skipHistorySync = false;
    }
  };

  const trackedOpen = (id: symbol, props?: unknown) => {
    const wasOpen = rawIsOpen(id);
    const result = rawOpen(id, props as never);

    if (!wasOpen && !skipHistorySync) {
      historyStack.splice(activeDepth);
      historyStack.push({ id, props });
      activeDepth = historyStack.length;
      pushOverlayHistoryEntry();
    }

    return result;
  };

  const trackedClose = (id: symbol, value?: unknown) => {
    const wasOpen = rawIsOpen(id);

    rawClose(id, value);

    if (!wasOpen || skipHistorySync) {
      return;
    }

    const topEntry = historyStack[activeDepth - 1];

    if (topEntry?.id === id) {
      activeDepth -= 1;
      removeCurrentOverlayHistoryEntry();
    }
  };

  overlay.open = trackedOpen as typeof overlay.open;
  overlay.close = trackedClose as typeof overlay.close;
  overlay.closeAll = () => {
    skipHistorySync = true;

    try {
      rawCloseAll();
      historyStack.splice(0);
      activeDepth = 0;
    } finally {
      skipHistorySync = false;
    }
  };
  overlay.create = ((component: Component, options?: unknown) => {
    const instance = rawCreate(component, options as never) as OverlayInstance;

    instance.open = (props?: unknown) => trackedOpen(instance.id, props);
    instance.close = (value?: unknown) => trackedClose(instance.id, value);

    if (instance.isOpen && !historyStack.some((entry) => entry.id === instance.id)) {
      historyStack.splice(activeDepth);
      historyStack.push({ id: instance.id });
      activeDepth = historyStack.length;
      pushOverlayHistoryEntry();
    }

    return instance;
  }) as typeof overlay.create;

  window.addEventListener('popstate', () => {
    if (ignoreNextPopState) {
      ignoreNextPopState = false;
      return;
    }

    const targetDepth = overlayHistoryDepth();

    if (targetDepth === activeDepth) {
      return;
    }

    if (targetDepth < activeDepth) {
      closeToDepth(targetDepth);
      return;
    }

    openToDepth(Math.min(targetDepth, historyStack.length));
  });
});
