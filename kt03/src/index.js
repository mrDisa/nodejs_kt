const express = require('express');
const { port, prisma } = require('./config');
const users = require('./routes/users');
const posts = require('./routes/posts');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api/users', users);
app.use('/api/posts', posts);
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(port, () => {
    console.log(`Blog API: http://localhost:${port}`);
  });
  async function shutdown() {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
module.exports = app;
