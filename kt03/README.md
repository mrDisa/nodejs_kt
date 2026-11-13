# КТ3 — REST API блог-платформы (Prisma ORM + SQLite)

**Node.js >= 18**, Express, Joi, Prisma 6, SQLite. Каждый запуск работает с локальным файлом БД `prisma/dev.db`. PostgreSQL для проверки не нужен.

## Первый запуск

```bash
cd kt03
npm install
cp .env.example .env
npx prisma migrate deploy
npx prisma generate
npm start
```

После миграции API доступен на `http://localhost:3003`. Для редактирования схемы используется `npm run db:migrate -- --name change_name`; готовая начальная миграция уже включена в репозиторий. БД и `.env` не коммитятся.

## Маршруты

| Метод | URL | Описание |
|---|---|---|
| GET | /api/users | Пользователи с пагинацией |
| GET | /api/users/:id | Пользователь вместе с постами, новые первыми |
| POST | /api/users | Создать пользователя |
| PATCH | /api/users/:id | Частично обновить |
| DELETE | /api/users/:id | Удалить |
| GET | /api/posts | Фильтры и пагинация |
| GET | /api/posts/:id | Пост с автором и тегами |
| POST | /api/posts | Создать пост с тегами через connectOrCreate |
| PATCH | /api/posts/:id | Частично обновить пост и теги |
| DELETE | /api/posts/:id | Удалить пост |

Параметры `GET /api/posts`: `search` (по заголовку, регистр не учитывается для латиницы в SQLite), `published=true|false`, `authorId`, `page` (по умолчанию 1), `limit` (по умолчанию 10, максимум 100). Ответ:

```json
{
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 10, "pages": 0 }
}
```

`GET /api/users` имеет аналогичные поля `data` и `meta`.

## Проверка вручную (curl)

1. Создать пользователя:
```bash
curl -i -X POST http://localhost:3003/api/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","name":"Alice","role":"USER"}'
```

2. Создать пост (замените `authorId` на id из предыдущего ответа):
```bash
curl -i -X POST http://localhost:3003/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello Prisma","content":"My first blog post","published":true,"authorId":1,"tags":["nodejs","prisma"]}'
```

3. Повторить создание другого поста с тегом `prisma`: повторно он не создастся, а будет подключён существующий.

4. Применить фильтры:
```bash
curl 'http://localhost:3003/api/posts?search=HELLO&published=true&authorId=1&page=1&limit=5'
curl http://localhost:3003/api/users/1
curl http://localhost:3003/api/posts/1
```

5. Изменить или удалить:
```bash
curl -X PATCH http://localhost:3003/api/posts/1 \
  -H 'Content-Type: application/json' -d '{"published":false,"tags":["updated"]}'
curl -i -X DELETE http://localhost:3003/api/posts/1
```

При изменении `tags` список связей поста заменяется целиком. Удаление пользователя каскадно удаляет его посты, но не общие теги.

## Статусы и валидация

- `200`: успешный GET/PATCH, `201`: успешный POST, `204`: успешный DELETE без тела.
- `400`: Joi возвращает `{ "error": "Validation error", "details": [{ "field": "title", "message": "..." }] }`.
- `404`: нет запрошенного пользователя/поста или автора создаваемого поста.
- `409`: конфликт уникальности (`email`, `Tag.name`).
- `500`: непредвиденная ошибка без раскрытия внутренней информации.

В схеме определены User, Post, Tag и Role (USER/ADMIN); связь Post–Tag — many-to-many. Файл миграции `prisma/migrations/20261113000000_init/migration.sql` соответствует схеме.

**Ограничение SQLite:** `contains` использует SQLite LIKE, который нечувствителен к регистру для латинских ASCII-символов, но не обеспечивает полноценную Unicode-insensitive-проверку кириллицы. Для такой проверки лучше выбрать PostgreSQL с `mode: 'insensitive'`.
