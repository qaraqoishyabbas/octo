export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.client && to.fullPath === from.fullPath) {
    return;
  }

  const overlay = useOverlay();
  overlay.closeAll();
});
