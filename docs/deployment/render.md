# Размещение Octo на Render

Инструкция для текущего репозитория, проверена по документации Render 9 октября 2026 года. Сам деплой и сборка Docker-образа в рамках подготовки инструкции не выполнялись. Приведённые ниже файлы нужно добавить перед деплоем.

## 1. Как разместить этот проект

В репозитории два приложения: Laravel 13 в `apps/api` и Nuxt 4 в `apps/web`. Laravel также обслуживает Inertia-админку. В Nuxt отключён SSR, поэтому его можно разместить как статический сайт.

Предлагаемая схема для первого рабочего запуска:

| Компонент | Тип в Render | Назначение |
| --- | --- | --- |
| `octo-web` | Static Site | Nuxt, интерфейс мессенджера |
| `octo-api` | Web Service / Docker | API, админка, очередь и планировщик |
| `octo-reverb` | Web Service / Docker | WebSocket-соединения |
| `octo-db` | Postgres | Пользователи, сообщения, сессии, очередь |
| Диск у `octo-api` | Persistent Disk | Аватары, вложения и временные загрузки |

Очередь и планировщик здесь запускаются через Supervisor внутри API-контейнера. Это позволяет планировщику очищать временные файлы на том же диске. Начни с одного экземпляра API и одного Reverb. Для масштабирования потребуется общее файловое хранилище и настройка Reverb scaling через Redis.

PHP размещается на Render через Docker: [официальный пример Laravel](https://render.com/docs/deploy-php-laravel-docker). Статическая сборка Nuxt описана в [документации Nuxt](https://nuxt.com/docs/4.x/getting-started/deployment).

Для постоянной работы выбирай платные Web Services и Postgres. Бесплатные Web Services засыпают после 15 минут без входящего трафика и не поддерживают постоянный диск; бесплатная Postgres истекает через 30 дней. Frontend можно оставить Static Site. См. [ограничения Free](https://render.com/docs/free). Стоимость выбранных ресурсов проверь в Dashboard до создания.

## 2. Подготовить репозиторий

1. Загрузи проект в GitHub, GitLab или Bitbucket и подключи этот аккаунт к Render.
2. Убедись, что в Git есть `apps/api/composer.lock`, `apps/api/package-lock.json` и `apps/web/package-lock.json`.
3. Не добавляй `.env`, приватные ключи и production-пароли в Git. Переменные production будут в Render → Environment.
4. Добавь файлы из следующих пунктов и отправь изменения в ветку, которую будешь деплоить.

Ниже имена `octo-api.onrender.com`, `octo-web.onrender.com` и `octo-reverb.onrender.com` — примеры. Подставляй фактические адреса, назначенные Render.

### Dockerfile для Laravel

Создай `apps/api/Dockerfile`:

```dockerfile
FROM node:22-bookworm-slim AS assets
WORKDIR /build
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM php:8.4-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip supervisor libpq-dev libzip-dev libicu-dev libonig-dev \
    libpng-dev libjpeg62-turbo-dev libfreetype6-dev libwebp-dev libgmp-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
       pdo_pgsql mbstring intl zip gd exif bcmath gmp pcntl opcache \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY . .
RUN mkdir -p storage/framework/cache/data storage/framework/sessions \
    storage/framework/views storage/logs storage/app/public bootstrap/cache \
    && composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
COPY --from=assets /build/public/build ./public/build
COPY deploy/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/supervisord.conf /etc/supervisor/supervisord.conf
COPY deploy/start.sh /usr/local/bin/octo-start
RUN chmod +x /usr/local/bin/octo-start \
    && chown -R www-data:www-data storage bootstrap/cache \
    && printf 'upload_max_filesize=100M\npost_max_size=1100M\nmax_file_uploads=10\nmemory_limit=256M\n' \
       > /usr/local/etc/php/conf.d/uploads.ini

EXPOSE 10000
ENTRYPOINT ["/usr/local/bin/octo-start"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
```

Используется PHP 8.4: в текущем `composer.lock` есть зависимости с требованием `>=8.4`, хотя сам `composer.json` разрешает 8.3. GD нужен для преобразования изображений. Отдельная Node-стадия собирает ассеты Laravel-админки.

### Исключить локальные файлы из образа

Создай `apps/api/.dockerignore`:

```text
.env
.env.*
!.env.example
.git
node_modules
vendor
public/hot
public/storage
public/build
storage/**
bootstrap/cache/*.php
database/*.sqlite*
```

### Apache

Создай `apps/api/deploy/apache.conf`:

```apache
<VirtualHost *:10000>
    DocumentRoot /var/www/html/public
    <Directory /var/www/html/public>
        AllowOverride All
        Require all granted
    </Directory>
    ErrorLog /proc/self/fd/2
    CustomLog /proc/self/fd/1 combined
    LimitRequestBody 1153433600
</VirtualHost>
```

### Запуск контейнера

Создай `apps/api/deploy/start.sh`:

```sh
#!/bin/sh
set -eu
cd /var/www/html

mkdir -p storage/app/public storage/app/private storage/app/geoip \
    storage/framework/cache/data storage/framework/sessions \
    storage/framework/views storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

sed -i "s/^Listen .*/Listen ${PORT:-10000}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:[0-9]*>/<VirtualHost *:${PORT:-10000}>/" \
    /etc/apache2/sites-available/000-default.conf

php artisan config:cache
php artisan storage:link

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
    php artisan migrate --force
fi

if [ "${RUN_SEEDERS:-0}" = "1" ]; then
    php artisan db:seed --force
fi

exec "$@"
```

Диск подключается только при запуске, поэтому каталоги создаются здесь. Миграции выполняются только у API, а не у Reverb. Для этой схемы с одним API и диском их можно выполнять при старте; при расширении инфраструктуры вынеси их в единственный отдельный шаг деплоя. Не выполняй `migrate:fresh` на рабочей базе.

### Очередь и планировщик

Создай `apps/api/deploy/supervisord.conf`:

```ini
[supervisord]
nodaemon=true
user=root
logfile=/dev/null
pidfile=/tmp/supervisord.pid

[program:apache]
command=/usr/local/bin/apache2-foreground
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stopasgroup=true
killasgroup=true

[program:queue]
directory=/var/www/html
command=php artisan queue:work --sleep=3 --tries=3 --timeout=60
user=www-data
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stopasgroup=true
killasgroup=true
stopwaitsecs=70

[program:scheduler]
directory=/var/www/html
command=php artisan schedule:work
user=www-data
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
stopasgroup=true
killasgroup=true
```

Планировщик нужен для уже существующих `temporary:clear` и `auth:clear-resets`. В этой схеме отдельный Render Cron Job или Background Worker создавать не нужно.

### CORS и HTTPS

Для публичных файлов `/storage/` CORS задаётся отдельно в `apps/api/deploy/apache.conf`,
а модуль Apache `headers` включается в Dockerfile. Эти файлы Apache отдаёт напрямую,
минуя Laravel. Без этих заголовков фото отображаются, но их кэш имеет скрытое тело
(`opaque`), и браузер не позволяет измерить размер. После изменения нужен повторный
деплой API; обновлённый frontend заменяет такие записи читаемыми при автозагрузке медиа.

В `apps/api/config/cors.php` замени:

```php
'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:3000')],
```

Сейчас в проекте стоит `['*']`, поэтому одного изменения `FRONTEND_URL` недостаточно. Nuxt использует Bearer-токены и `credentials: 'omit'`; настройка cookie-домена между frontend и API ему не требуется. Админка использует сессии на собственном домене API.

Render завершает TLS на своём прокси. В `apps/api/app/Providers/AppServiceProvider.php` добавь в существующий метод `boot()`:

```php
if ($this->app->environment('production')) {
    \Illuminate\Support\Facades\URL::forceScheme('https');
}
```

Это обеспечит HTTPS в генерируемых ссылках. В проекте уже настроены доверенные прокси для приватных подсетей. Если после запуска Laravel неправильно определяет HTTPS или IP, проверь заголовки и доверие к прокси в `bootstrap/app.php`. См. [сетевое поведение Render](https://render.com/docs/web-services).

## 3. Создать PostgreSQL

В Render нажми **New → Postgres**, задай имя `octo-db` и выбери регион. API, Reverb и база должны находиться в одном регионе.

Сохрани **Internal Database URL**. В этом проекте переменная называется **`DB_URL`**, поскольку `config/database.php` читает `env('DB_URL')`. Переменная `DATABASE_URL` из некоторых примеров Render сама по себе здесь не подключит базу.

Новая база будет пустой. Миграции создадут структуру, но не перенесут пользователей и сообщения из локальной SQLite. Если нужны текущие данные, сначала подготовь отдельный перенос с сохранением UUID и связей. [Подключение Postgres](https://render.com/docs/postgresql-creating-connecting).

## 4. Создать Laravel API

Нажми **New → Web Service**, выбери репозиторий:

| Поле | Значение |
| --- | --- |
| Name | `octo-api` |
| Branch | Ветка с файлами деплоя |
| Region | Как у базы |
| Root Directory | `apps/api` |
| Runtime / Language | Docker |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context, если поле доступно | `.` |
| Docker Command | Оставить пустым, используется CMD |
| Health Check Path | `/health` |
| Instance | Платный, один экземпляр |

При указанном Root Directory пути относятся к `apps/api`. См. [монорепозитории Render](https://render.com/docs/monorepo-support).

Добавь диск с Mount Path **`/var/www/html/storage`**. Начни с размера, достаточного для вложений. Без диска файлы будут теряться при перезапуске. Диск ограничивает горизонтальное масштабирование и приводит к перерыву при деплое: [Persistent Disks](https://render.com/docs/disks).

В **Environment** добавь:

```dotenv
APP_NAME=Octo
APP_ENV=production
APP_DEBUG=false
APP_KEY=<сгенерированный ключ>
APP_URL=https://octo-api.onrender.com
ASSET_URL=https://octo-api.onrender.com
APP_TIMEZONE=Asia/Almaty
FRONTEND_URL=https://octo-web.onrender.com

DB_CONNECTION=pgsql
DB_URL=<Internal Database URL>

LOG_CHANNEL=stderr
LOG_LEVEL=info
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
CACHE_STORE=database
QUEUE_CONNECTION=database
FILESYSTEM_DISK=public
RUN_MIGRATIONS=1

BROADCAST_CONNECTION=reverb
REVERB_APP_ID=octo
REVERB_APP_KEY=<случайный публичный ключ>
REVERB_APP_SECRET=<случайный секрет>
REVERB_HOST=octo-reverb.onrender.com
REVERB_PORT=443
REVERB_SCHEME=https

UPLOAD_AVATAR_MAX_MB=5
UPLOAD_MESSAGE_MAX_MB=100
UPLOAD_MESSAGE_MAX_FILES=10
MAIL_MAILER=log
```

Заполняй значения в интерфейсе без угловых скобок. Не задавай `SESSION_DOMAIN`, пока не нужен специальный cookie-домен. `MAIL_MAILER=log` позволяет запуститься, но для реальной отправки писем нужно подключить почтового провайдера.

Сгенерировать `APP_KEY` можно локально из `apps/api`, если установлены Composer-зависимости:

```bash
php artisan key:generate --show
```

Для Reverb сгенерируй два разных значения:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Первое используй как `REVERB_APP_KEY`, второе как `REVERB_APP_SECRET`. Сохраняй `APP_KEY` между деплоями: он используется для шифрования, в том числе credentials уведомлений.

Нажми **Deploy**. Если реальные адреса отличаются от примеров, обнови переменные. После запуска открой `https://<API-домен>/health`: ожидается HTTP 200 с JSON `status: success`. Этот маршрут проверяет доступность приложения, но отдельно нужно проверить операции с базой.

## 5. Создать Reverb

Создай ещё один **Web Service / Docker** из того же репозитория:

- Name: `octo-reverb`.
- Root Directory: `apps/api`.
- Dockerfile Path: `./Dockerfile`.
- Регион: тот же.
- Один платный экземпляр, без диска.
- **Docker Command**: `php artisan reverb:start --host=0.0.0.0 --port=10000`.
- Environment: `PORT=10000`, `RUN_MIGRATIONS=0`.

Скопируй из API `APP_ENV`, `APP_DEBUG`, `APP_KEY`, `APP_URL`, `FRONTEND_URL`, `DB_CONNECTION`, `DB_URL`, `LOG_CHANNEL`, `LOG_LEVEL`, `CACHE_STORE`, `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`, `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME`.

Добавь `REVERB_SERVER_HOST=0.0.0.0` и `REVERB_SERVER_PORT=10000`. Здесь Docker Command заменяет CMD, поэтому Supervisor, очередь и планировщик в Reverb-контейнере не запускаются.

Внутри контейнера Reverb слушает HTTP на `10000`, а frontend и Laravel обращаются к публичному адресу через HTTPS/WSS на `443`. Не ставь `10000` в клиентский `REVERB_PORT`. Не используй API-маршрут `/health` как проверку Reverb; для начала оставь проверку открытого порта по умолчанию.

В `apps/api/config/reverb.php` замени `allowed_origins` внутри `apps.apps` на список реальных frontend-хостов, например `['octo-web.onrender.com']`; при собственном домене добавь его тоже. Здесь Reverb ожидает хосты, а CORS выше — полные origin с `https://`.

Render поддерживает публичные WebSocket-соединения. Подробнее: [WebSockets на Render](https://render.com/docs/websocket), [настройки Laravel Reverb](https://laravel.com/framework/docs/reverb).

## 6. Создать Nuxt frontend

Нажми **New → Static Site**, выбери тот же репозиторий:

| Поле | Значение |
| --- | --- |
| Name | `octo-web` |
| Root Directory | `apps/web` |
| Build Command | `npm ci --include=dev && npm run generate` |
| Publish Directory | `.output/public` |

В Environment:

```dotenv
NODE_VERSION=22
APP_URL=https://octo-api.onrender.com
APP_TIMEZONE=Asia/Almaty
APP_SECURITY_ENABLED=false
REVERB_APP_KEY=<тот же публичный ключ, что у API и Reverb>
REVERB_HOST=octo-reverb.onrender.com
REVERB_PORT=443
REVERB_SCHEME=https
NUXT_PUBLIC_UPLOAD_AVATAR_MAX_MB=5
NUXT_PUBLIC_UPLOAD_MESSAGE_MAX_MB=100
NUXT_PUBLIC_UPLOAD_MESSAGE_MAX_FILES=10
```

`APP_URL` у frontend означает адрес **Laravel API**, без `/api/v1` и без завершающего `/`. Префикс уже задан в `nuxt.config.ts`. `REVERB_HOST` указывай без `https://`.

`APP_SECURITY_ENABLED=false` соответствует текущему `.env.example`; включение `nuxt-security` проверяй отдельно, его серверные механизмы нельзя автоматически считать работающими на статическом хостинге.

Не добавляй в frontend `APP_KEY`, `DB_URL`, `REVERB_APP_SECRET` или приватные push-ключи. Frontend-переменные используются при сборке и могут попасть в браузер.

В **Redirects/Rewrites** добавь правило:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | Rewrite |

Это нужно для прямого открытия внутренних страниц. Используй **Rewrite**, чтобы браузер сохранил URL страницы. [Статические сайты Render](https://render.com/docs/static-sites).

После первого деплоя обнови `FRONTEND_URL` у API и список разрешённых origin у Reverb фактическим адресом frontend. Изменения переменных статического frontend требуют новой сборки.

## 7. Уведомления и дополнительные настройки

1. Открой админку на `https://<API-домен>/login`. Она собирается вместе с API.
2. Для первого аккаунта без Render Shell добавь у **API** переменную `RUN_SEEDERS=1` и передеплой сервис. После миграций `DatabaseSeeder` создаст одного пользователя: логин `admin`, пароль `password`, случайный email. Открой `/login` у API и войди по логину. Повторный запуск сидера не меняет существующего `admin` и не создаёт демо-данных.
3. Для Web Push следуй [инструкции проекта](../notifications/README.md): создай web-приложение в `/notification-apps` и сохрани VAPID credentials.
4. Добавь полученный UUID в `NUXT_PUBLIC_NOTIFICATION_APP_ID` у Static Site и пересобери frontend.
5. Проверь разрешение на уведомления в браузере и доставку при закрытом или скрытом окне чата.

После первого входа поменяй пароль `admin` в **Users → Edit user** и установи `RUN_SEEDERS=0`. У Reverb оставь `RUN_SEEDERS=0` (или не задавай переменную). Переменную нужно задавать только в backend; Nuxt она не нужна.

Для остальных пользователей открой **Users → Регистрация пользователя** (`/users/create`). Введи логин, пароль и подтверждение. Email создаётся автоматически; в админку и мессенджер можно входить по логину.

Пароль должен содержать минимум 8 символов. Email вида `UUID@example.invalid` служит техническим идентификатором: это не действующий почтовый ящик, письма на него не доставляются. Для отправки писем задай реальный email через админку.

Геолокация устройств использует файл `GeoLite2-City.mmdb`. Если эта функция нужна, размести полученный у MaxMind файл на диске в `storage/app/geoip/GeoLite2-City.mmdb`; не включай его приватные лицензии и ключи в Git.

## 8. Проверить запуск

- `/health` API возвращает HTTP 200.
- Вход под созданными аккаунтами работает; сообщения сохраняются в PostgreSQL.
- Два разных аккаунта в двух браузерах получают сообщения без обновления страницы. В DevTools → Network → WS виден успешный WebSocket handshake (`101`).
- Аватар и вложение загружаются и доступны по HTTPS через `/storage/...`.
- После **Restart service** API вложение остаётся доступным.
- Прямое открытие и обновление внутреннего URL frontend работают.
- `/login` админки открывается со стилями и JavaScript.
- В логах API запущены `apache`, `queue` и `scheduler`; нет постоянных ошибок очереди.
- Push доставляется после настройки credentials.

До использования с реальными данными настрой резервное копирование PostgreSQL и вложений. Текущие маршруты админки проверяют авторизацию, но не отдельную роль администратора: любой подходящий пользователь может получить к ней доступ. Перед публичным запуском с реальными пользователями добавь ограничение доступа к админке.

## 9. Частые проблемы

| Симптом | Что проверить |
| --- | --- |
| Render не находит порт | Apache слушает `PORT`; Reverb запускается на `0.0.0.0:10000` и имеет `PORT=10000` |
| Composer сообщает несовместимую PHP | Используется PHP 8.4, установлен нужный extension; не обходи проверку через `--ignore-platform-reqs` |
| Ошибка подключения к базе | `DB_CONNECTION=pgsql`, именно `DB_URL`, Internal URL, одинаковый регион |
| API возвращает 500 | Logs: `APP_KEY`, миграции, права `storage`/`bootstrap/cache`, доступность базы |
| CORS блокирует запросы | Точный `FRONTEND_URL` и `allowed_origins` в `config/cors.php`, затем перезапуск с новым config cache |
| WebSocket не подключается | Reverb-домен, порт `443`, схема `https`, одинаковый `REVERB_APP_KEY` во всех компонентах и разрешённый frontend-хост |
| Сообщения есть после обновления, но не появляются сразу | Логи `queue:work`, failed jobs, адрес Reverb у API и frontend |
| Файлы пропадают | Диск подключён именно к `/var/www/html/storage` у API |
| Админка без стилей | Node-стадия выполнила `npm run build`, есть `public/build/manifest.json`, нет `public/hot` |
| В frontend остался localhost | Исправь `APP_URL` и REVERB-переменные у Static Site и выполни новую сборку |

Для следующих обновлений отправляй изменения в подключённую ветку и используй Auto Deploy либо **Manual Deploy → Deploy latest commit**. С диском ожидай краткую недоступность API. Если изменились миграции, сделай backup базы перед обновлением. Откат кода не откатывает миграции автоматически.
