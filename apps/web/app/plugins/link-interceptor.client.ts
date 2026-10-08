export default defineNuxtPlugin(() => {
  document.addEventListener(
    'click',
    (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
        return;
      if (anchor.hasAttribute('download')) return;

      let linkUrl: URL;
      try {
        linkUrl = new URL(href, window.location.href);
      } catch {
        return;
      }

      const sameOrigin =
        linkUrl.protocol === window.location.protocol &&
        linkUrl.hostname === window.location.hostname &&
        (linkUrl.port || '') === (window.location.port || '');

      if (sameOrigin) {
        const t = (anchor.getAttribute('target') || '').toLowerCase();
        if (t && t !== '_self') {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === 'function')
            event.stopImmediatePropagation();
          window.location.assign(linkUrl.href);
          return;
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      const { confirm } = useConfirm();
      confirm({
        title: 'Открыть ссылку',
        description: `Перейти по ссылке <span class="text-primary break-all">${linkUrl.href}</span>?`,
        confirmButtonText: 'Открыть',
        cancelButtonText: 'Отмена',
        onConfirm: () => {
          const tgt = (anchor.getAttribute('target') || '_blank').toLowerCase();
          if (tgt === '_self') {
            window.location.assign(linkUrl.href);
          } else {
            window.open(linkUrl.href, tgt, 'noopener,noreferrer');
          }
        },
      });
    },
    { capture: true },
  );
});
