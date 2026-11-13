const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');

const port = Number(process.env.PORT ?? 3003);
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a number between 1 and 65535');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing: copy .env.example to .env');
}
const prisma = new PrismaClient();
module.exports = { prisma, port };
