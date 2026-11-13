const http = require('node:http');
const { io: connectClient } = require('socket.io-client');
const app = require('../src/app');
const { prisma } = require('../src/config');
const { signAccess } = require('../src/utils/jwt');
const { attachChat } = require('../src/realtime/chat');

let server;
let socketServer;
let baseUrl;
const clients = [];

function once(socket, event, ms = 3500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, callback);
      reject(new Error('Timeout waiting for ' + event));
    }, ms);
    const callback = value => {
      clearTimeout(timer);
      resolve(value);
    };
    socket.once(event, callback);
  });
}

async function connect(user, tokenOverride) {
  const socket = connectClient(baseUrl, {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: false,
    auth: { token: tokenOverride ?? signAccess(user) }
  });
  clients.push(socket);
  const connected = once(socket, 'connect');
  socket.connect();
  await connected;
  return socket;
}

async function user(email) {
  return prisma.user.create({
    data: { email, name: 'Chat Tester', passwordHash: 'a-test-hash' }
  });
}

const send = (socket, event, payload) =>
  new Promise(resolve => socket.emit(event, payload, resolve));

beforeAll(async () => {
  server = http.createServer(app);
  socketServer = attachChat(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await prisma.chatMessage.deleteMany();
  await prisma.post.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await new Promise(resolve => socketServer.close(resolve));
  await prisma.$disconnect();
});

test('WebSocket rejects missing or invalid JWT', async () => {
  const socket = connectClient(baseUrl, {
    transports: ['websocket'],
    reconnection: false,
    auth: { token: 'invalid' }
  });
  clients.push(socket);
  const error = await once(socket, 'connect_error');
  expect(error.message).toBe('Unauthorized');
});

test('new connection receives online-user snapshot; others see join and leave', async () => {
  const first = await user('first@chat.test');
  const second = await user('second@chat.test');
  const a = await connect(first);
  const joined = once(a, 'user:online');
  const b = await connect(second);
  const online = await joined;
  expect(online.user.id).toBe(second.id);

  // The snapshot is emitted on each successful connection.
  const c = connectClient(baseUrl, {
    transports: ['websocket'], autoConnect: false,
    auth: { token: signAccess(second) }, reconnection: false
  });
  clients.push(c);
  const snapshot = once(c, 'users:online');
  c.connect();
  const state = await snapshot;
  expect(state.users.map(user => user.id).sort()).toEqual([first.id, second.id].sort());
  const left = once(a, 'user:offline');
  b.disconnect();
  c.disconnect();
  expect((await left).userId).toBe(second.id);
});

test('message:send broadcasts message:new and persists author in SQLite', async () => {
  const first = await user('first@chat.test');
  const second = await user('second@chat.test');
  const a = await connect(first);
  const b = await connect(second);
  const got = once(b, 'message:new');
  const ack = await send(a, 'message:send', { content: 'Hello everyone' });
  expect(ack.ok).toBe(true);
  const message = await got;
  expect(message.content).toBe('Hello everyone');
  expect(message.author.id).toBe(first.id);
  expect((await prisma.chatMessage.count())).toBe(1);
});

test('room join/leave and room:message only deliver to members', async () => {
  const first = await user('first@chat.test');
  const second = await user('second@chat.test');
  const a = await connect(first);
  const b = await connect(second);
  expect((await send(a, 'room:join', { room: 'news' })).ok).toBe(true);
  expect((await send(b, 'room:message', { room: 'news', content: 'No access' })).ok).toBe(false);
  const received = once(a, 'room:message');
  const ack = await send(a, 'room:message', { room: 'news', content: 'Room hello' });
  expect(ack.ok).toBe(true);
  expect((await received).room).toBe('news');
  expect((await send(a, 'room:leave', { room: 'news' })).ok).toBe(true);
  expect((await send(a, 'room:message', { room: 'news', content: 'After leave' })).ok).toBe(false);
});
