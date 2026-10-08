export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useAuthStore();

  if (!auth.logged) {
    return navigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    });
  }
});
