require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const setupSocket = require('./config/socket');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
setupSocket(server);

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

async function start() {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`TaskMaster server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
