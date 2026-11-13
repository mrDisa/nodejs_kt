# КТ5 — Realtime чат на Socket.IO (направление A)

Самостоятельная копия **КТ4** с JWT, RBAC, Prisma, Express и SQLite, дополненная realtime-чатом. Исходная папка `kt04` не изменена.

## Запуск

Требуется Node.js 18+.

```bash
cd kt05
npm install
cp .env.example .env
```

Замените оба `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` на **разные секретные случайные строки** длиной от 32 символов. Например, для каждого отдельно:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```bash
npx prisma migrate deploy
npx prisma generate
npm start
```

Адрес HTTP API и Socket.IO: **http://localhost:3005**. Для изменения порта задайте `PORT` в `.env`. Начальная миграция перенесена из КТ4, вторая добавляет таблицу `ChatMessage` и индексы.

## Аутентификация

1. Зарегистрируйте пользователя через `POST /auth/register` с телом `{"name":"Alice","email":"alice@example.com","password":"secret123"}`.
2. Выполните `POST /auth/login` с email и паролем; получите `accessToken`.
3. При Socket.IO подключении передайте access-токен через `auth.token`. При неверном, истёкшем JWT либо удалённом пользователе сервер отклоняет handshake с `connect_error: Unauthorized`.
4. При отправке сообщений автор определяется **по JWT** из `socket.data.user`, а не из пользовательского payload.

Refresh JWT из КТ4 остаётся доступен в httpOnly cookie через `POST /auth/refresh`. После истечения access-токена клиенту нужно получить новый и переподключиться.

## События Socket.IO

| Событие | Отправитель | Payload / назначение |
|---|---|---|
| `users:online` | server → новый клиент | `{ users: [{id,name,email,role,createdAt}, ...] }` |
| `user:online` | server → остальные | `{ user }` при первом соединении пользователя |
| `user:offline` | server → остальные | `{ userId }` после последнего отключения пользователя |
| `message:send` | client → server | `{ content }`; ack `{ok,message}` |
| `message:new` | server → все | сохранённое сообщение с `author` |
| `room:join` | client → server | `{ room }`; ack `{ok,room}` |
| `room:leave` | client → server | `{ room }`; ack `{ok,room}` |
| `room:message` | client → server | `{ room,content }`; ack `{ok,message}` |
| `room:message` | server → участники | сохранённое сообщение с `room` и `author` |
| `chat:error` | server → client | `{ error }`, если не передан ack |

Комнаты принимают только латинские буквы, цифры, `_` и `-` (1–40 символов). Не более 20 пользовательских комнат на одно подключение. Текст сообщения — 1–1000 символов. Отправка сообщения в комнату разрешена только после `room:join`, а вещание доступно только подписанным клиентам. Сообщения сохраняются в `ChatMessage` вместе с автором и названием комнаты (или `null` для общего чата).

**Примечание:** комнаты — открытые каналы для всех аутентифицированных пользователей, не приватные чаты. Список online хранится в памяти одного Node.js-процесса, поэтому для кластерного production нужна общая инфраструктура (например, Redis adapter). История сообщений сохраняется в БД, но отдельный REST-маршрут истории не входит в требования КТ5.

## Пример клиента (Node.js)

Установите зависимости проекта (`npm install`) и запустите этот пример из папки `kt05`. Замените токен на полученный из `/auth/login`:

```js
const { io } = require('socket.io-client');
const socket = io('http://localhost:3005', {
  auth: { token: 'YOUR_ACCESS_TOKEN' }
});
socket.on('users:online', data => console.log('Online:', data.users));
socket.on('user:online', data => console.log('Joined:', data.user.name));
socket.on('user:offline', data => console.log('Left:', data.userId));
socket.on('message:new', message => console.log('Global:', message.content));
socket.on('room:message', message => console.log('Room:', message.room, message.content));
socket.on('connect', () => {
  socket.emit('message:send', { content: 'Hello!' }, console.log);
  socket.emit('room:join', { room: 'general' }, answer => {
    if (answer.ok) socket.emit('room:message', { room: 'general', content: 'Hi room!' }, console.log);
  });
});
socket.on('connect_error', error => console.error(error.message));
```

## Тестирование

```bash
npm test
```

Скрипт `tests/run.js` устанавливает тестовые переменные, применяет миграции и генерирует Prisma client для отдельной БД `prisma/test.db`. Далее Jest запускает существующие API-тесты КТ4 и тесты Socket.IO: отклонение невалидного JWT, online/offline, сохранение сообщений, вступление/выход и запрет сообщений от пользователей вне комнаты.

Тестовый `prisma/test.db` изолирован от основной БД, но **каждый запуск тестов очищает данные именно тестовой базы**.

## Что перенесено из КТ4

JWT access/refresh, bcrypt, авторизация REST, роли USER/MODERATOR/ADMIN, CRUD постов, фильтрация и пагинация, Helmet, rate limiting, лимит тела 10kb, Joi, Jest + Supertest. Подробнее о REST-маршрутах: [README КТ4](../kt04/README.md).
