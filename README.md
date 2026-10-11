# Octo

Octo — веб-мессенджер на Laravel и Nuxt: личные диалоги, группы, каналы, вложения, realtime и push-уведомления. В репозитории также есть Laravel-админка и WebRTC-комнаты встреч.

Ближайшая цель — **стабильный первый релиз веб-мессенджера**.

## Документация

Анализ от **12 октября 2026**, исходный commit `13fad8a`:

- [Описание проекта и результаты анализа](docs/project/overview.md).
- [Текущая и целевая архитектура](docs/project/architecture.md).
- [Дизайн первого релиза: UX/UI и технические решения](docs/project/design.md).
- [Новый roadmap с приоритетами и критериями готовности](docs/project/roadmap.md).

Предложения в этих документах ещё не реализованы. Проверенные возможности и ограничения указаны отдельно; наличие кода не означает подтверждённую работу на production.

## Структура

| Путь | Назначение |
| --- | --- |
| `apps/api` | Laravel REST API, админка Inertia/Vue, очередь и Reverb |
| `apps/web` | Nuxt SPA/PWA, Pinia, service workers |
| `docs/notifications` | Существующее описание сервиса уведомлений |
| `docs/deployment/render.md` | Существующая инструкция развёртывания на Render |

## Локальная разработка

После установки зависимостей и настройки окружения `make dev` запускает API, Reverb, Vite админки и Nuxt. `make lan LAN_IP=<адрес>` запускает их для проверки с устройств в локальной сети. См. `apps/api/.env.example` и `apps/web/.env.example`.

Эти Makefile-команды не запускают push queue worker. Для обработки очереди нужен отдельный `php artisan queue:work` из `apps/api`; для фоновой очистки — `php artisan schedule:work`. Web Push и камера требуют подходящего защищённого контекста браузера; успешный LAN-запуск сам по себе их не проверяет.

## Проверки

Из `apps/api`:

```bash
php vendor/bin/phpunit
npm run build
```

Из `apps/web`:

```bash
node --test test/*.ts
npm run build
```

Правила frontend-кода: [apps/web/README.md](apps/web/README.md). Результаты запусков и границы проверки: [overview.md](docs/project/overview.md#проверки-12-октября-2026).
