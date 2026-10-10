import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue';
import { useMessageListScroll } from '../app/composables/useMessageListScroll.ts';

const renderer = createRenderer({
  patchProp() {},
  insert() {},
  remove() {},
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  setText() {},
  setElementText() {},
  parentNode: () => null,
  nextSibling: () => null,
});

async function setup() {
  const previousWindow = globalThis.window;
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  Object.assign(globalThis, {
    window: {
      matchMedia: () => ({ matches: false }),
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        frames.set(++frameId, callback);
        return frameId;
      },
      cancelAnimationFrame: (id: number) => frames.delete(id),
    },
  });
  const calls: Array<{ top: number; behavior: string }> = [];
  const listeners = new Map<string, () => void>();
  const container = {
    scrollHeight: 2000,
    clientHeight: 500,
    scrollTop: 1500,
    getBoundingClientRect: () => ({ top: 0, bottom: 500, height: 500 }),
    querySelector: () => null,
    scrollTo(options: { top: number; behavior: string }) {
      calls.push(options);
      // Native smooth scrolling completes later; it does not move synchronously.
      if (options.behavior === 'auto') this.scrollTop = options.top;
    },
    addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  const target = {
    dataset: { messageId: 'original' },
    getBoundingClientRect: () => ({
      top: 600 - container.scrollTop,
      bottom: 700 - container.scrollTop,
      height: 100,
    }),
  };
  let scroll!: ReturnType<typeof useMessageListScroll>;
  const app = renderer.createApp(
    defineComponent({
      setup() {
        scroll = useMessageListScroll({
          container: ref(container as unknown as HTMLElement),
          content: ref({ querySelectorAll: () => [target] } as unknown as HTMLElement),
          onQueueReadCheck() {},
        });
        return () => h('div');
      },
    }),
  );
  app.mount({});
  await nextTick();
  return {
    scroll,
    calls,
    container,
    listeners,
    flushFrames() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(0);
    },
    dispose() {
      app.unmount();
      Object.assign(globalThis, { window: previousWindow });
    },
  };
}

for (const queuedBeforeJump of [false, true]) {
  test(`reply navigation survives resize ${queuedBeforeJump ? 'queued before' : 'during'} smooth scrolling`, async () => {
    const fixture = await setup();
    try {
      if (queuedBeforeJump) fixture.scroll.handleResize();
      const found = await fixture.scroll.scrollToIntent({
        messageId: 'original',
        highlight: true,
        block: 'center',
        behavior: 'smooth',
      });
      assert.equal(found, true);
      assert.deepEqual(fixture.calls, [{ top: 400, behavior: 'smooth' }]);
      if (!queuedBeforeJump) fixture.scroll.handleResize();
      fixture.flushFrames();
      assert.deepEqual(
        fixture.calls,
        [{ top: 400, behavior: 'smooth' }],
        'resize must not cancel the jump and restore the old viewport',
      );
      assert.equal(fixture.scroll.highlightedMessageId.value, 'original');

      fixture.container.scrollTop = 400;
      fixture.listeners.get('scrollend')!();
      fixture.scroll.handleResize();
      fixture.flushFrames();
      assert.equal(fixture.container.scrollTop, 400);
    } finally {
      fixture.dispose();
    }
  });
}
