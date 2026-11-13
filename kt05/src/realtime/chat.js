const { Server } = require('socket.io');
const { prisma, publicUser } = require('../config');
const { verifyAccess } = require('../utils/jwt');

const ROOM_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;
const MAX_MESSAGE_LENGTH = 1000;

function attachChat(httpServer, db = prisma) {
  const io = new Server(httpServer, {
    maxHttpBufferSize: 10 * 1024,
    transports: ['polling', 'websocket']
  });
  const online = new Map();

  io.use(async (socket, next) => {
    try {
      const rawToken = socket.handshake.auth?.token;
      const token = typeof rawToken === 'string' ? rawToken.replace(/^Bearer\s+/i, '') : '';
      const payload = verifyAccess(token);
      const user = await db.user.findUnique({
        where: { id: Number(payload.sub) },
        select: publicUser
      });
      if (!user) return next(new Error('Unauthorized'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  function respond(socket, ack, result) {
    if (typeof ack === 'function') ack(result);
    else if (!result.ok) socket.emit('chat:error', { error: result.error });
  }

  function textFrom(value) {
    return typeof value === 'string' && value.trim().length > 0 &&
      value.trim().length <= MAX_MESSAGE_LENGTH ? value.trim() : null;
  }

  function validRoom(value) {
    return typeof value === 'string' && ROOM_PATTERN.test(value);
  }

  function publicMessage(message) {
    return {
      id: message.id,
      content: message.content,
      room: message.room,
      createdAt: message.createdAt,
      author: message.author
    };
  }

  io.on('connection', socket => {
    const user = socket.data.user;
    const count = online.get(user.id)?.count ?? 0;
    online.set(user.id, { user, count: count + 1 });

    // A snapshot for the newly connected user, then presence notifications for others.
    socket.emit('users:online', { users: [...online.values()].map(entry => entry.user) });
    if (count === 0) socket.broadcast.emit('user:online', { user });

    socket.on('message:send', async (payload, ack) => {
      const content = textFrom(payload?.content);
      if (!content) return respond(socket, ack, { ok: false, error: 'Message must have 1-1000 characters' });
      try {
        const message = await db.chatMessage.create({
          data: { content, authorId: user.id },
          include: { author: { select: publicUser } }
        });
        const data = publicMessage(message);
        io.emit('message:new', data);
        respond(socket, ack, { ok: true, message: data });
      } catch {
        respond(socket, ack, { ok: false, error: 'Could not save message' });
      }
    });

    socket.on('room:join', async (payload, ack) => {
      const room = payload?.room;
      if (!validRoom(room)) return respond(socket, ack, { ok: false, error: 'Invalid room name' });
      if (!socket.rooms.has('room:' + room) && socket.rooms.size >= 21)
        return respond(socket, ack, { ok: false, error: 'Room limit reached' });
      await socket.join('room:' + room);
      respond(socket, ack, { ok: true, room });
    });

    socket.on('room:leave', async (payload, ack) => {
      const room = payload?.room;
      if (!validRoom(room)) return respond(socket, ack, { ok: false, error: 'Invalid room name' });
      await socket.leave('room:' + room);
      respond(socket, ack, { ok: true, room });
    });

    socket.on('room:message', async (payload, ack) => {
      const room = payload?.room;
      const content = textFrom(payload?.content);
      if (!validRoom(room) || !content)
        return respond(socket, ack, { ok: false, error: 'Invalid room or message' });
      if (!socket.rooms.has('room:' + room))
        return respond(socket, ack, { ok: false, error: 'Join room before sending messages' });
      try {
        const message = await db.chatMessage.create({
          data: { content, room, authorId: user.id },
          include: { author: { select: publicUser } }
        });
        const data = publicMessage(message);
        io.to('room:' + room).emit('room:message', data);
        respond(socket, ack, { ok: true, message: data });
      } catch {
        respond(socket, ack, { ok: false, error: 'Could not save message' });
      }
    });

    socket.on('disconnect', () => {
      const entry = online.get(user.id);
      if (!entry) return;
      if (entry.count > 1) online.set(user.id, { ...entry, count: entry.count - 1 });
      else {
        online.delete(user.id);
        socket.broadcast.emit('user:offline', { userId: user.id });
      }
    });
  });

  return io;
}
module.exports = { attachChat, ROOM_PATTERN, MAX_MESSAGE_LENGTH };
