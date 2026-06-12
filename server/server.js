require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

const { initializeDatabase } = require('./services/database');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io integration
app.set('io', io);
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Serve static files from client folder
app.use(express.static(path.join(__dirname, '../client')));

// Mount routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/materiales', require('./routes/materiales'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/caja', require('./routes/caja'));
app.use('/api/config', require('./routes/config'));
app.use('/api/actividad', require('./routes/actividad'));
app.use('/api/licencias', require('./routes/licencias'));

// Handle SPA routing
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ message: 'API route not found' });
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Initialize DB and start server
initializeDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});
