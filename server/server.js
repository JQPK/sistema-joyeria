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
const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const categoriasRoutes = require('./routes/categorias');
const materialesRoutes = require('./routes/materiales');
const ventasRoutes = require('./routes/ventas');
const clientesRoutes = require('./routes/clientes');
const usuariosRoutes = require('./routes/usuarios');
const inventarioRoutes = require('./routes/inventario');
const cajaRoutes = require('./routes/caja');
const configRoutes = require('./routes/config');
const actividadRoutes = require('./routes/actividad');
const licenciasRoutes = require('./routes/licencias');
const variantesRoutes = require('./routes/variantes');

app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/materiales', materialesRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/config', configRoutes);
app.use('/api/actividad', actividadRoutes);
app.use('/api/licencias', licenciasRoutes);
app.use('/api/variantes', variantesRoutes);

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
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
});
