const { Prisma } = require('@prisma/client');

function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Unique constraint violation', fields: err.meta?.target ?? [] });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Related record does not exist or cannot be changed' });
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
  }
  if (err.status === 400 && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
module.exports = errorHandler;
