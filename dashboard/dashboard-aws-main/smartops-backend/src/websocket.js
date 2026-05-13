const { Server } = require('socket.io');

let io;

function initWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('[WEBSOCKET] Client connected:', socket.id);
    
    socket.on('disconnect', () => {
      console.log('[WEBSOCKET] Client disconnected:', socket.id);
    });
  });
}

function getIO() {
  if (!io) {
    throw new Error('WebSocket not initialized!');
  }
  return io;
}

module.exports = {
  initWebSocket,
  getIO
};
