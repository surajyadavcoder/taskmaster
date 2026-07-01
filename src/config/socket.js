const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const { initNotificationService } = require('../services/notificationService');

function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  // Every socket connection must present a valid JWT, same one used for REST auth.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication token missing.'));
    }
    try {
      const decoded = verifyToken(token);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    // Each user gets a private room keyed by their own id, so we can
    // target notifications at them without tracking socket ids manually.
    socket.join(socket.userId);

    socket.on('disconnect', () => {
      socket.leave(socket.userId);
    });
  });

  initNotificationService(io);

  return io;
}

module.exports = setupSocket;
