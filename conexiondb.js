// conexiondb.js
const mysql = require('mysql2/promise'); // <-- IMPORTANTE: Asegúrate que sea 'mysql2/promise'
require('dotenv').config();

// CAMBIO CLAVE: Usamos createPool en lugar de createConnection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  timezone: 'local',      // o '-05:00' para Lima
  dateStrings: true,       // devuelve DATETIME como string, sin convertir a Date
  
  // Opciones recomendadas para el pool
  waitForConnections: true,
  connectionLimit: 50, // Puedes ajustar este número
  queueLimit: 0
});

// Ya no es necesario el bloque db.connect(). El pool maneja las conexiones
// automáticamente. Podemos añadir un listener para verificar si está listo.
pool.getConnection()
  .then(connection => {
    console.log('Pool de conexiones a la base de datos establecido exitosamente.');
    connection.release(); // Liberamos la conexión de prueba inmediatamente
  })
  .catch(err => {
    console.error('Error al establecer el pool de conexiones a la base de datos:', err);
    process.exit(1);
  });


// Exportamos el pool completo. Tu variable 'db' en server.js ahora será el pool.
module.exports = pool;
