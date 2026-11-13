const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const port = Number(process.env.PORT || 3004);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  if (!process.env[key] || process.env[key].length < 32) throw new Error(key + ' must have at least 32 characters');
}
if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('JWT secrets must differ');
const prisma = new PrismaClient();
const publicUser = { id: true, email: true, name: true, role: true, createdAt: true };
module.exports = { port, prisma, publicUser };
