# КТ4 — Безопасное REST API блог-платформы

Продолжение КТ3, отдельный проект на **Node.js 18+, Express, Prisma 6, SQLite**. Модели User, Post, Tag и CRUD сохранены; добавлены bcrypt, JWT, cookie, RBAC, Helmet, rate limiting и тесты.

## Запуск

```bash
cd kt04
npm install
cp .env.example .env
```

**Обязательно замените** `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` в `.env` на два разных случайных секрета (32+ символов каждый). Например, сгенерируйте каждый через `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

```bash
npx prisma migrate deploy
npx prisma generate
npm start
```

Базовый URL: `http://localhost:3004`.

## Аутентификация

| Метод | URL | Что делает |
|---|---|---|
| POST | /auth/register | `{email,name,password}`: bcrypt 12 rounds |
| POST | /auth/login | `{email,password}`: accessToken в JSON, refreshToken в httpOnly cookie |
| POST | /auth/refresh | Новый accessToken и ротация refresh cookie |
| POST | /auth/logout | Инвалидирует refresh и очищает cookie |
| GET | /auth/me | Пользователь по Bearer accessToken |

Access JWT действует 15 минут; refresh JWT — 7 дней. Cookie имеет `httpOnly`, `SameSite=Strict`, в production — `Secure`, путь `/auth`. Refresh-токены инвалидируются при выходе/обновлении через `tokenVersion` пользователя. Access-токен остаётся действительным до истечения своих 15 минут. Токены не содержат пароль или хэш.

Пример:
```bash
curl -i -X POST http://localhost:3004/auth/register -H 'Content-Type: application/json' -d '{"email":"alice@example.com","name":"Alice","password":"secret123"}'
curl -i -c cookies.txt -X POST http://localhost:3004/auth/login -H 'Content-Type: application/json' -d '{"email":"alice@example.com","password":"secret123"}'
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3004/auth/refresh
```

Защищённые маршруты принимают заголовок `Authorization: Bearer <accessToken>`. `POST /api/posts` назначает автором текущего пользователя; поле `authorId` другого пользователя возвращает 403 (самостоятельное назначение автора запрещено).

## Роли и права

| Маршрут | USER | MODERATOR | ADMIN |
|---|---|---|---|
| GET /api/posts | ✓ | ✓ | ✓ |
| POST /api/posts | ✓ | ✓ | ✓ |
| PATCH /api/posts/:id | только свои | любые | любые |
| DELETE /api/posts/:id | только свои | любые | любые |
| GET /api/users | ✗ | ✓ | ✓ |
| PATCH /admin/users/:id/role | ✗ | ✗ | ✓ |

В целях безопасности регистрация создаёт **только USER**. Назначение MODERATOR/ADMIN разрешено лишь ADMIN. Для демонстрации в локальной учебной БД первоначальную роль можно задать в Prisma Studio (`npx prisma studio`). Пользователю доступен собственный профиль `GET/PATCH /api/users/:id`; модератор может просматривать чужие профили, админ — менять их. Удаление своего аккаунта разрешено пользователю; админ может удалить любой. Поля `passwordHash` и `tokenVersion` исключены из HTTP-ответов.

## Маршруты КТ3

- `GET /api/posts`: `search`, `published`, `authorId`, `page`, `limit`; ответ `{data,meta:{total,page,limit,pages}}`.
- `GET /api/posts/:id`: пост с автором и тегами.
- `POST /api/posts`: `title, content, published, tags` (теги через `connectOrCreate`).
- `PATCH/DELETE /api/posts/:id`: проверка владельца или MODERATOR/ADMIN.
- `GET /api/users`: только MODERATOR/ADMIN, пагинация.
- `GET /api/users/:id`: пользователь с постами по убыванию `createdAt`.

## Безопасность и ошибки

- Helmet выставляет X-Frame-Options и X-Content-Type-Options.
- Ограничение `POST /auth/login`: максимум **10 запросов за 15 минут с одного IP**, затем 429.
- Максимальный размер JSON-тела: **10 KB** (413).
- Joi: 400 с массивом `details`, несуществующая запись: 404, нет токена: 401, недостаточно прав: 403, повтор email: 409.
- Stack trace не раскрывается клиенту, в production возвращается только общее сообщение.

## Тесты (Jest + Supertest)

```bash
npm test
```

Тестовый запуск использует **отдельную SQLite-базу** `prisma/test.db` и самостоятельно применяет миграции. Для запуска требуется предварительно выполнить `npm install` и `npx prisma generate`. Тесты покрывают регистрацию, повторный email, логин, неверный пароль, авторизацию, refresh/logout, rate limit, ownership, MODERATOR/ADMIN, теги, пагинацию, Helmet и unit-проверку RBAC.

**Примечание:** SQLite `contains` нечувствителен к регистру только для ASCII/латиницы. Полноценный Unicode case-insensitive поиск потребует PostgreSQL с `mode: 'insensitive'`.

Для KT4 создана отдельная база: прямое подключение к старой `kt03/dev.db` невозможно без отдельной миграции существующих аккаунтов на passwordHash.
