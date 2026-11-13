# КТ6 — TaskFlow: финальный backend-проект

**Тема:** управление проектами и задачами. Стек: Node.js 22, Express, Prisma 6, PostgreSQL 16, Redis 7, JWT, bcrypt, Joi, Swagger UI, Jest + Supertest.

## Архитектура

- **User** владеет несколькими **Project**; каждый Project содержит несколько **Task** — три связанные модели, каскадное удаление.
- **USER** может читать и изменять только собственные проекты и их задачи; **ADMIN** имеет доступ ко всем проектам/задачам и может менять роли пользователей через `/admin/users/:id/role`.
- Access JWT (15 минут) отправляется как `Authorization: Bearer <token>`. Refresh JWT (7 дней) хранится в httpOnly-cookie, имеет SameSite=Strict, Secure в production, ротируется при обновлении и инвалидируется при выходе.
- Redis использован для ограничения `/auth/login`: максимум 10 попыток с IP в 15 минут; если Redis недоступен, вход отклоняется, а не обходится ограничение.
- Swagger UI: **`/api/docs/`**, OpenAPI JSON: `/api/openapi.json`.

## Запуск одной командой через Docker Compose

Установить Docker с Compose v2. Из папки `kt06`:

```bash
cp .env.example .env
```

В `.env` замените `POSTGRES_PASSWORD` на сильный пароль, а также **это же значение в обеих строках** `DATABASE_URL` и `TEST_DATABASE_URL`. Замените `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` на **два разных случайных секрета длиной 32+ символа**, например:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Запустить:
```bash
docker compose up --build -d
```

Приложение: **http://localhost:3006** · Health: `/health` · Swagger: **http://localhost:3006/api/docs/**.

Compose поднимает **app + db + redis**. App ждёт здоровые PostgreSQL и Redis, применяет Prisma migrations и начинает слушать порт. Данные PostgreSQL и Redis сохраняются в named volumes `postgres_data`, `redis_data`.

Если изменили переменные БД после первого запуска, старый volume Postgres сохраняет прежний пароль; для учебной чистой установки можно выполнить `docker compose down -v`, **это удалит все сохранённые данные**.

## Тесты

```bash
docker compose exec app npm test
```

Команда также работает локально через `npm install && npm test`, если `DATABASE_URL`, `TEST_DATABASE_URL` и `REDIS_URL` ведут к доступным PostgreSQL и Redis. Тестовый runner принудительно использует **отдельную базу PostgreSQL** `taskflow_test` и Redis **DB 15**. Тесты очищают только эти тестовые хранилища; не запускайте их, если DB 15 занята другими приложениями. Есть 17 сценариев Jest + Supertest: регистрация, дублирование email, логин, неверный пароль, refresh/logout, оба CRUD, права доступа, фильтры, пагинация, ошибки валидации, Swagger, Helmet и Redis limiter.

## Эндпоинты

| Метод | Путь | Доступ | Действие |
|---|---|---|---|
| GET | /health | Все | Проверка процесса |
| GET | /api/docs/ | Все | Swagger UI |
| GET | /api/openapi.json | Все | OpenAPI-спецификация |
| POST | /auth/register | Все | Регистрация (USER) |
| POST | /auth/login | Все | Логин и refresh-cookie |
| POST | /auth/refresh | Cookie | Обновление access-token |
| POST | /auth/logout | Cookie | Выход, отзыв refresh |
| GET | /auth/me | Токен | Текущий пользователь |
| GET | /api/projects | Токен | Фильтры, пагинация |
| GET | /api/projects/:id | Владелец / ADMIN | Один проект с задачами |
| POST | /api/projects | Токен | Создание своего проекта |
| PATCH | /api/projects/:id | Владелец / ADMIN | Редактирование проекта |
| DELETE | /api/projects/:id | Владелец / ADMIN | Удаление проекта и его задач |
| GET | /api/tasks | Токен | Фильтры, пагинация |
| GET | /api/tasks/:id | Владелец / ADMIN | Одна задача |
| POST | /api/tasks | Владелец проекта / ADMIN | Добавление задачи |
| PATCH | /api/tasks/:id | Владелец / ADMIN | Редактирование задачи |
| DELETE | /api/tasks/:id | Владелец / ADMIN | Удаление задачи |
| GET | /admin/users | ADMIN | Список пользователей |
| PATCH | /admin/users/:id/role | ADMIN | Смена роли USER/ADMIN |

**Параметры GET:** оба списка принимают `page` (по умолчанию 1), `limit` (10, максимум 100), `search` (регистронезависимый поиск через PostgreSQL `contains`). Проекты: `status=ACTIVE|ARCHIVED`, `ownerId` (учитывается для ADMIN). Задачи: `status=TODO|IN_PROGRESS|DONE`, `priority=LOW|MEDIUM|HIGH`, `projectId`. `USER` всегда видит только собственные ресурсы.

## Единый формат JSON

Успешный одиночный ресурс: `{"data": {...}}`; список: `{"data": [...], "meta": {"total": 0,"page": 1,"limit": 10,"pages": 0}}`; ошибка: `{"error": {"code":"VALIDATION_ERROR","message":"Invalid input","details":[...]}}`. DELETE возвращает HTTP 204 без тела. Типовые коды: 200, 201, 204, 400, 401, 403, 404, 409, 413, 429, 500, 503. Все входные JSON и query-параметры проверяются Joi, параметр `:id` — положительное целое.

## Быстрая ручная проверка

```bash
curl -X POST http://localhost:3006/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123"}'

curl -c cookies.txt -X POST http://localhost:3006/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"password123"}'
```

Возьмите `data.accessToken` из ответа логина. В Swagger нажмите **Authorize**, вставьте токен, затем создайте Project через `POST /api/projects` и Task через `POST /api/tasks`, указав `projectId`.

## Деплой на VPS

На VPS с Docker Compose скопируйте каталог `kt06`, настройте `.env`, выполните `docker compose up --build -d`. Порт 3006 откройте только при необходимости. Для публичного production развёртывания рекомендуется разместить Caddy/Nginx reverse-proxy с HTTPS на домене (особенно для Secure refresh-cookie), настроить firewall, резервные копии PostgreSQL и мониторинг. Redis и PostgreSQL наружу не публикуются.

**Статус:** проект подготовлен для деплоя, но сам по себе не является подтверждением работающего публичного URL; адрес продакшен-хоста появляется после фактического развёртывания.

## Что показать на защите

1. **Почему 3 модели:** User → Project → Task, PostgreSQL обеспечивает целостность внешними ключами.
2. **Почему Prisma:** типизированный доступ к данным, миграции и транзакции для пагинации.
3. **Разница 401/403:** 401 — не вошёл, 403 — вошёл, но чужой ресурс.
4. **Защита JWT:** bcrypt хранит хэш, access короткоживущий, refresh — в httpOnly-cookie и ротируется.
5. **Зачем Redis:** общая для процессов память о попытках входа и TTL.
6. **Зачем Docker Compose:** единый запуск app/db/redis, миграции, healthchecks и постоянные volumes.
7. **Как тестировать:** отдельная PostgreSQL-база и Redis DB 15, Jest + Supertest проверяют статусы и права.
