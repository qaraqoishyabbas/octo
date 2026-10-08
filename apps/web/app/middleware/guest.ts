export default defineNuxtRouteMiddleware((to, from) => {
  const auth = useAuthStore();

  if (auth.logged) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '';
    const redirectPath =
      redirect.startsWith('/') && !redirect.startsWith('//') && redirect !== '/login'
        ? redirect
        : '/';

    return navigateTo(redirectPath);
  }
});
