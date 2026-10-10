const securityEnabled = import.meta.env.APP_SECURITY_ENABLED === 'true';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-19',
  components: { dirs: [{ path: '~/components', pathPrefix: false }] },
  typescript: { strict: false },
  telemetry: false,
  ssr: false,
  vite: { server: { allowedHosts: ['localhost', '127.0.0.1'] } },
  $development: { ssr: false, devtools: { enabled: false } },
  $production: { ssr: false },
  experimental: { viteEnvironmentApi: true },
  app: {
    head: {
      title: 'Главная',
      titleTemplate: '%s | Octo',
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover',
        },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },
  modules: [
    '@vite-pwa/nuxt',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    'dayjs-nuxt',
    ...(securityEnabled ? ['nuxt-security'] : []),
  ],

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Octo',
      short_name: 'Octo',
      description: 'Octo messenger',
      theme_color: '#7c3aed',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      lang: 'ru',
      icons: [
        {
          src: '/pwa-icon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        },
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,webp,woff2}'],
      runtimeCaching: [
        {
          urlPattern: /^https?:\/\/.+\/api\/v1\/.*$/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24,
            },
            networkTimeoutSeconds: 5,
          },
        },
        {
          urlPattern: /^https?:\/\/.+\/storage\/avatars\/.*$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'avatars-cache',
            cacheableResponse: { statuses: [0, 200] },
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        },
        {
          urlPattern: /^https?:\/\/.+\/storage\/(?!avatars\/).*$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'storage-cache',
            // Run before RangeRequestsPlugin: opaque bodies cannot be inspected or sliced.
            plugins: [
              {
                cachedResponseWillBeUsed: async ({ request, cachedResponse }) => {
                  if (
                    cachedResponse?.type === 'opaque' &&
                    (request.mode === 'cors' ||
                      request.headers.has('range') ||
                      request.destination === 'video')
                  )
                    return null;
                  return cachedResponse;
                },
                cacheWillUpdate: async ({ request, response }) => {
                  if (
                    response.type === 'opaque' &&
                    (request.headers.has('range') || request.destination === 'video')
                  )
                    return null;
                  return response;
                },
              },
            ],
            cacheableResponse: { statuses: [0, 200] },
            rangeRequests: true,
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  },

  image: {
    // In Docker Nuxt runs in a separate container, so IPX cannot reliably fetch
    // localhost resources from Laravel. Use direct image URLs instead.
    provider: 'none',
    domains: [import.meta.env.APP_URL || 'http://127.0.0.1:8000'],
    alias: {
      api: import.meta.env.APP_URL || 'http://127.0.0.1:8000',
    },
  },

  ...(securityEnabled
    ? {
        security: {
          headers: {
            crossOriginEmbedderPolicy: 'unsafe-none',
            crossOriginOpenerPolicy: 'same-origin-allow-popups',
            contentSecurityPolicy: {
              'img-src': [
                "'self'",
                'data:',
                'https://*',
                import.meta.env.APP_URL || 'http://127.0.0.1:8000',
              ],
            },
          },
        },
      }
    : {}),
  css: ['~/assets/css/main.css'],
  icon: { clientBundle: { scan: true }, serverBundle: 'local' },

  dayjs: {
    locales: ['kk', 'ru', 'en'],
    defaultLocale: 'ru',
    defaultTimezone: import.meta.env.APP_TIMEZONE,
    plugins: [
      'advancedFormat',
      'customParseFormat',
      'localizedFormat',
      'relativeTime',
      'timezone',
      'utc',
    ],
  },

  i18n: {
    locales: [
      {
        code: 'kk',
        dir: 'ltr',
        iso: 'kk-KK',
        name: 'Қазақша',
        description: 'Казахский',
        file: 'kk.json',
      },
      {
        code: 'ru',
        dir: 'ltr',
        iso: 'ru-RU',
        name: 'Русский',
        description: 'Русский',
        file: 'ru.json',
      },
      {
        code: 'en',
        dir: 'ltr',
        iso: 'en-US',
        name: 'English',
        description: 'Английский',
        file: 'en.json',
      },
    ],
    defaultLocale: 'ru',
    strategy: 'no_prefix',
    langDir: '../lang',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n-locale',
      alwaysRedirect: false,
      fallbackLocale: 'ru',
    },
  },
  runtimeConfig: {
    apiLocal: import.meta.env.APP_URL,
    public: {
      apiBase: import.meta.env.APP_URL,
      apiPrefix: '/api/v1',
      notificationAppId: import.meta.env.NUXT_PUBLIC_NOTIFICATION_APP_ID || '',
      storageBase: import.meta.env.APP_URL + '/storage/',
      uploadAvatarMaxMb: Number(import.meta.env.NUXT_PUBLIC_UPLOAD_AVATAR_MAX_MB || 5),
      uploadMessageMaxMb: Number(import.meta.env.NUXT_PUBLIC_UPLOAD_MESSAGE_MAX_MB || 100),
      uploadMessageMaxFiles: Number(import.meta.env.NUXT_PUBLIC_UPLOAD_MESSAGE_MAX_FILES || 10),
      reverbAppKey: import.meta.env.REVERB_APP_KEY,
      reverbHost: import.meta.env.REVERB_HOST,
      reverbPort: import.meta.env.REVERB_PORT,
      reverbScheme: import.meta.env.REVERB_SCHEME,
    },
  },
});
