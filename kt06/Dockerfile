FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY __tests__ ./__tests__
EXPOSE 3006
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
