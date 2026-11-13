# КТ2 — REST API каталога товаров

Node.js 18+, Express, Joi, Multer. Товары сохраняются в `data/products.json` между перезапусками.

## Запуск
```bash
cd kt02
npm install
cp .env.example .env
npm start
```

Сервер: `http://localhost:3000`. Файл `.env` локальный и игнорируется Git.

## Маршруты

| Метод | URL | Назначение |
|---|---|---|
| GET | /api/products | Список с фильтрацией и пагинацией |
| GET | /api/products/:id | Один товар |
| POST | /api/products | Создать |
| PUT | /api/products/:id | Полностью заменить редактируемые поля |
| PATCH | /api/products/:id | Частично обновить |
| DELETE | /api/products/:id | Удалить |
| POST | /api/products/:id/image | Загрузить изображение |

Обязательные поля при создании и PUT: `name` (2–100 символов), `price` (> 0), `category` (`electronics`, `clothing`, `food`, `other`). `stock` — целое >= 0, по умолчанию 0. `description` — до 500 символов. `id` и `createdAt` генерируются автоматически; `imageUrl` устанавливается после загрузки.

## Примеры

Создание:
```bash
curl -i -X POST http://localhost:3000/api/products -H 'Content-Type: application/json' -d '{"name":"Headphones","price":3990,"category":"electronics","stock":5}'
```

Фильтрация и пагинация:
```bash
curl 'http://localhost:3000/api/products?category=electronics&minPrice=1000&maxPrice=5000&page=1&limit=10'
```
Ответ: `{"data":[...],"total":1,"page":1,"limit":10}`.

Обновление:
```bash
curl -X PATCH http://localhost:3000/api/products/1 -H 'Content-Type: application/json' -d '{"stock":3}'
```

Загрузка JPEG/PNG (максимум 2 МБ):
```bash
curl -X POST http://localhost:3000/api/products/1/image -F 'image=@photo.png'
```
Изображение доступно по `imageUrl` из ответа.

Валидация возвращает HTTP 400 и массив `details`; отсутствующий товар — 404. Логгер выводит метод, URL, статус, длительность. Необработанные ошибки — 500.

**Примечание:** хранение в JSON предназначено для учебной работы и последовательных локальных запросов, не для многопроцессного production. Формат файла проверяется по MIME и расширению, но не по сигнатуре файла.
