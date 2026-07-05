const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  // Custom database errors
  if (err.code === '23505') {
    return res.status(400).json({ success: false, message: 'El registro ya existe (duplicado)' });
  }

  // Application validation errors that should be shown to the user
  if (err.message && (
      err.message.startsWith('Stock insuficiente') || 
      err.message.startsWith('Producto no encontrado') ||
      err.message.startsWith('Variante no encontrada')
  )) {
    return res.status(400).json({ success: false, message: err.message });
  }

  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

module.exports = errorHandler;
