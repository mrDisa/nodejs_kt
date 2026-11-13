const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: false });
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('redis');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  if (!process.env[key] || process.env[key].length < 32) throw new Error(key + ' must have at least 32 characters');
}
if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('JWT secrets must differ');
const port = Number(process.env.PORT || 3006);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', error => {
  if (process.env.NODE_ENV !== 'test') console.error('Redis:', error.message);
});
const publicUser = { id: true, email: true, name: true, role: true, createdAt: true };
module.exports = { prisma, redis, publicUser, port };
