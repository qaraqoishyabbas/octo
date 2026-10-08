# API уведомлений

Все маршруты начинаются с `/api/v1` и требуют пользовательский Sanctum Bearer token. Список приложений и отправка доступны только владельцу приложения. Токен устройства привязывается к авторизованному пользователю и к конкретному приложению. Во всех ответах используется оболочка `{ "ok": true, "data": ... }`.

## Приложения

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/notification-apps` | Свои приложения |
| POST | `/notification-apps` | Создать приложение |
| GET | `/notification-apps/{id}` | Свое приложение и список провайдеров |
| PATCH | `/notification-apps/{id}` | Изменить `name` и/или `enabled` |
| DELETE | `/notification-apps/{id}` | Удалить приложение и связанные данные |
| PUT | `/notification-apps/{id}/credentials` | Создать или заменить credentials |
| DELETE | `/notification-apps/{id}/credentials/{provider}` | Удалить credentials |
| GET | `/notification-apps/{id}/public-config` | Публичный VAPID-ключ для клиента |
| POST | `/notification-apps/{id}/notifications` | Поставить доставку в очередь |
| GET | `/notification-apps/{id}/deliveries` | Последние 30 доставок, с пагинацией |

Создание приложения:

```json
{"name":"Octo Web","platform":"web"}
```

`platform`: `web`, `android`, `ios`, `desktopapp`. Допустимые провайдеры: `web` и `desktopapp` → `webpush`; `android` → `fcm`; `ios` → `apns` или `fcm`.

Credentials хранятся зашифрованными средствами Laravel и не возвращаются в GET-ответах. Замена выполняется полным `PUT`:

```json
{"provider":"webpush","credentials":{"subject":"mailto:admin@example.com","public_key":"...","private_key":"..."}}
```

```json
{"provider":"fcm","credentials":{"project_id":"firebase-project-id","client_email":"firebase-adminsdk@example.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"}}
```

```json
{"provider":"apns","credentials":{"team_id":"TEAMID","key_id":"KEYID","bundle_id":"com.example.app","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","sandbox":false}}
```

Для APNs `sandbox: true` направляет запрос на sandbox endpoint. Для FCM требуется service account с правом отправки через Firebase Cloud Messaging API v1.

## Push-токены

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/push-tokens` | Свои регистрации без секретов |
| POST | `/push-tokens` | Создать или обновить регистрацию |
| DELETE | `/push-tokens/{id}` | Удалить свою регистрацию |

Для APNs/FCM `token` — строка провайдера. У iOS с FCM передайте `"provider":"fcm"`; по умолчанию iOS использует APNs:

```json
{"app_id":"<UUID>","provider":"fcm","token":"<device-token>","metadata":{"device":"phone"}}
```

Для Web Push `token` — JSON-строка результата `JSON.stringify(subscription.toJSON())`, содержащая `endpoint` и `keys.p256dh/auth`. Доверенные endpoint hosts: Firebase, Mozilla, Apple и Windows Push. Повторная регистрация одного токена возвращает тот же ID. Токен удаляется также при удалении связанной сессии входа.

## Отправка

```json
{"user_ids":["<UUID пользователя>"],"title":"Привет","body":"Текст уведомления","data":{"url":"/@D-..."}}
```

Ответ `201`: `{"ok":true,"data":{"queued":1}}`. `queued` — число доставок, принятых очередью. Если у адресатов нет токенов в этом приложении, значение равно нулю. При синхронной очереди ошибка провайдера сразу помечает доставку как `failed` и не прерывает отправку сообщения. Не передавайте в `data` секреты: эти данные доставляются клиенту.

## Настройки и сообщения

`GET/PATCH /notification-preferences` остаётся доступным для нативных клиентов и возвращает булевы поля `enabled`, `sound`, `badge`, `mentions_in_muted`, `show_text`, `show_names`. Веб-клиент этот endpoint не вызывает: его настройки хранятся локально и применяются service worker при получении push. При `show_text: false` текст скрывается, при `show_names: false` заголовок заменяется на «Новое уведомление». У `POST /messages` есть необязательное поле `silent: true` для тихой отправки.
