const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  // Custom database errors
  if (err.code === '23505') {
    return res.status(400).json({ success: false, message: 'El registro ya existe (duplicado)' });
  }

  res.status(500).json({ 
    success: false, 
    message: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

module.exports = errorHandler;
