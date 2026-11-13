const http = require('node:http');
const app = require('./app');
const { port, prisma } = require('./config');
const { attachChat } = require('./realtime/chat');

const server = http.createServer(app);
const io = attachChat(server);
server.listen(port, () => {
  console.log('KT5 HTTP + Socket.io running at http://localhost:' + port);
});

function shutdown() {
  io.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
