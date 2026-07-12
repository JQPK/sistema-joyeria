/**
 * Centralized activity logger utility.
 * Call this from any route to record user actions in actividad_usuarios.
 * 
 * @param {object} db - Database instance
 * @param {number|null} userId - The user performing the action (null for anonymous)
 * @param {string} accion - Action type (e.g. 'LOGIN', 'VENTA_COMPLETADA')
 * @param {string} detalles - Human-readable description of what happened
 */
async function logActivity(db, userId, accion, detalles = '') {
  try {
    if (userId) {
      await db.query(
        'INSERT INTO actividad_usuarios (usuario_id, accion, detalles) VALUES ($1, $2, $3)',
        [userId, accion, detalles]
      );
    }
    // If no userId (e.g. failed login), we can't log to the table since it requires a user FK.
    // Failed logins are handled separately in auth.js using a special system user or just skipped.
  } catch (err) {
    // Never let logging errors break the main flow
    console.error('[Logger] Failed to log activity:', err.message);
  }
}

module.exports = { logActivity };
