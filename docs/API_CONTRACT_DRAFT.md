# Черновик API-контракта для backend

Документ фиксирует ожидаемые endpoints. Пока frontend работает на mock-данных, но названия методов и сущности нужно держать близкими к будущему API.

## Общий формат ответа

```ts
interface ApiResponse<T> {
  data: T;
  message?: string;
}
```

Для ошибок backend должен возвращать понятное сообщение для frontend, но технические детали не должны показываться пользователю напрямую.

## Услуги

```http
GET /api/services
GET /api/services/{id}
POST /api/services
PATCH /api/services/{id}
DELETE /api/services/{id}
POST /api/services/reorder
```

Нужно согласовать:

- является ли цена строкой или числом;
- где хранится длительность: только `durationMinutes` или также текстовое поле;
- можно ли скрывать услугу без удаления;
- как связать услугу с лошадьми и правилами.

## Заявки и бронирования

```http
GET /api/bookings
GET /api/bookings/{id}
POST /api/bookings
PATCH /api/bookings/{id}
PATCH /api/bookings/{id}/status
PATCH /api/bookings/{id}/assign-horses
PATCH /api/bookings/{id}/assign-trainer
PATCH /api/bookings/{id}/trainer-status
DELETE /api/bookings/{id}
```

Критично:

- `POST /api/bookings` должен повторно проверять доступность на сервере.
- Статус новой заявки по умолчанию: `pending`.
- Frontend не должен считать слот окончательно забронированным без ответа backend.

## Доступность

```http
GET /api/availability?serviceId=...&date=...
POST /api/availability/check
```

`GET /api/availability` возвращает слоты дня:

```ts
interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reasons: string[];
  availableHorseIds: string[];
  availableTrainerIds?: string[];
}
```

`POST /api/availability/check` проверяет конкретную заявку с участниками.

Критично для backend:

- проверка доступности должна учитывать не только лошадей, но и тренеров;
- слот недоступен, если нет активного тренера для услуги, тренер не работает в этот день/час или уже назначен на пересекающуюся заявку;
- причины недоступности должны возвращаться в человеко-понятном виде, без технических деталей.

## Лошади

```http
GET /api/horses
GET /api/horses/{id}
POST /api/horses
PATCH /api/horses/{id}
DELETE /api/horses/{id}
```

Нужно согласовать:

- можно ли удалить лошадь, если она уже назначена в заявках;
- какие статусы блокируют запись;
- хранить ли историю лечения/отдыха отдельно от текущего статуса;
- нужен ли публичный вывод лошадей на сайте.

## Тренеры

```http
GET /api/trainers
GET /api/trainers/{id}
POST /api/trainers
PATCH /api/trainers/{id}
DELETE /api/trainers/{id}
```

Минимальные поля тренера:

- `id`;
- `fullName`;
- `phone`;
- `email`;
- `description`;
- `allowedServiceIds`;
- `status` (`active`, `unavailable`, `vacation`, `sick_leave`);
- `isActive`;
- `workingDays`;
- `workStartTime`;
- `workEndTime`;
- `notes`.

Нужно согласовать:

- мягкое или жесткое удаление тренера при наличии назначенных заявок;
- кто и как может менять статус тренера;
- хранится ли история изменений расписания тренера;
- нужен ли отдельный ресурс для отпусков/исключений, или хватает полей тренера.

## Кабинет тренера

```http
GET /api/trainer/me
GET /api/trainer/bookings
GET /api/trainer/bookings/{id}
PATCH /api/bookings/{id}/trainer-status
```

Ожидаемая логика:

- тренер видит только заявки, где `assignedTrainerId` совпадает с его аккаунтом;
- в деталях заявки тренер может менять только trainer-статус (`seen`, `accepted`, `needs_clarification`, `completed`);
- тренер не должен редактировать услуги, контент сайта, лошадей и глобальные правила записи.

## Уведомления

```http
GET /api/notifications
GET /api/notifications/unread-count
PATCH /api/notifications/{id}/read
PATCH /api/notifications/read-all
POST /api/notifications/test
```

Рекомендуемые query-параметры:

- `recipientRole=admin|trainer`;
- `recipientId=...`;
- `type=...`;
- `isRead=true|false`;
- `limit`, `offset`.

События, которые уже опираются на frontend-сценарий:

- `trainer_assigned`: при назначении тренера на заявку;
- `trainer_response_required`: при изменении trainer-статуса;
- `booking_time_changed`: при изменении даты/времени заявки;
- `booking_cancelled`: при отмене заявки;
- `booking_reminder_24h`, `booking_reminder_2h`: напоминания тренеру.

Нужно согласовать:

- кто является источником истины для создания уведомлений (рекомендуется backend);
- какие уведомления дублируются админу, тренеру и клиенту;
- TTL/архивация уведомлений;
- нужна ли строгая идемпотентность для повторных событий.

## Правила записи

```http
GET /api/booking-rules
POST /api/booking-rules
PATCH /api/booking-rules/{id}
DELETE /api/booking-rules/{id}
```

Поддерживаемые типы:

- `horse_rest_after_lesson`;
- `working_hours`;
- `closed_date`;
- `horse_unavailable`;
- `max_weight`;
- `service_duration`;
- `custom_exception`.

Для реального backend желательно хранить не произвольный `Record<string, unknown>`, а валидируемые DTO под каждый тип правила.

## Контент страниц

```http
GET /api/pages
GET /api/pages/{pageKey}
GET /api/pages/{pageKey}/content
PATCH /api/pages/{pageKey}
POST /api/content-blocks
PATCH /api/content-blocks/{id}
DELETE /api/content-blocks/{id}
POST /api/content-blocks/reorder
```

Нужно поддержать:

- черновики;
- публикацию;
- порядок блоков;
- скрытие блока;
- SEO-поля страницы.

## Медиа

```http
GET /api/media
GET /api/media/{id}
POST /api/media
PATCH /api/media/{id}
DELETE /api/media/{id}
GET /api/media-folders
POST /api/media-folders
PATCH /api/media-folders/{id}
DELETE /api/media-folders/{id}
```

`POST /api/media` должен принимать `multipart/form-data`.

Поля медиа:

- `id`;
- `fileName`;
- `title`;
- `altText`;
- `url`;
- `folderId`;
- `mimeType`;
- `sizeBytes`;
- `width`;
- `height`;
- `createdAt`.

## Галерея

```http
GET /api/gallery/albums
POST /api/gallery/albums
PATCH /api/gallery/albums/{id}
DELETE /api/gallery/albums/{id}
POST /api/gallery/albums/reorder
GET /api/gallery/items
POST /api/gallery/items
PATCH /api/gallery/items/{id}
DELETE /api/gallery/items/{id}
POST /api/gallery/items/reorder
```

Нужно согласовать:

- альбомы являются отдельной сущностью или это папки медиатеки;
- может ли одно фото быть в нескольких альбомах;
- нужна ли обложка альбома вручную.

## Контакты, отзывы, правила безопасности

```http
GET /api/contacts
PATCH /api/contacts

GET /api/reviews
POST /api/reviews
PATCH /api/reviews/{id}
DELETE /api/reviews/{id}

GET /api/info/rules
PATCH /api/info/rules
```

Для отзывов нужно согласовать модерацию:

- показывать ли отзыв сразу;
- кто может добавлять отзыв;
- нужен ли статус `draft`, `published`, `hidden`.

## Нерешенные вопросы интеграции

- единый формат времени и таймзоны (`Asia/Novosibirsk`, UTC, offset);
- стратегия конкурентных изменений заявок (optimistic locking, version field);
- набор backend-валидаций, которые не зависят от frontend;
- правила доступа по ролям (`admin`, `trainer`) и контракт ошибок `403/401`;
- источник идентификаторов пользователей для `recipientId` в уведомлениях.
