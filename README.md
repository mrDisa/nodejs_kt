# Контрольные точки по Node.js

Учебные работы в одном репозитории. Каждая контрольная точка — самостоятельный проект со своими зависимостями и инструкциями.

| Работа | Тема | Исходники |
|---|---|---|
| КТ1 | CLI-фильтр CSV по возрасту и городу | [kt01](./kt01/) |
| КТ2 | REST API товаров: CRUD, Joi, Multer, фильтрация | [kt02](./kt02/) |
| КТ3 | REST API блога: Prisma ORM, SQLite, пользователи, посты и теги | [kt03](./kt03/) |
| КТ4 | JWT, bcrypt, RBAC, Helmet, rate limiting, Jest/Supertest | [kt04](./kt04/) |

## Запуск КТ1

```bash
cd kt01
npm ci
cp .env.example .env
npm start
```

Исходные данные: `kt01/data/users.csv`; результат — `kt01/data/result.csv`.

## Запуск КТ2

```bash
cd kt02
npm install
cp .env.example .env
npm start
```

API: `http://localhost:3000/api/products`. Подробнее: [kt02/README.md](./kt02/README.md).

## Запуск КТ3

```bash
cd kt03
npm install
cp .env.example .env
npx prisma migrate deploy
npx prisma generate
npm start
```

API: `http://localhost:3003` (маршруты `/api/users`, `/api/posts`). Подробнее: [kt03/README.md](./kt03/README.md).

## Запуск КТ4

```bash
cd kt04
npm install
cp .env.example .env
# Замените JWT_ACCESS_SECRET и JWT_REFRESH_SECRET на два разных случайных секрета.
npx prisma migrate deploy
npx prisma generate
npm start
npm test
```

API: `http://localhost:3004`. Подробнее: [kt04/README.md](./kt04/README.md).

**Важно:** выполнять команды из папки соответствующей КТ. Локальные `.env`, базы данных и `node_modules` не коммитятся.
