// src/middlewares/handleMulterError.js

const multer = require('multer');

function handleMulterError(err, req, res, next) {
    // Verificamos si el error proviene de Multer
    if (err instanceof multer.MulterError) {
        
        // Usamos un switch para manejar los diferentes códigos de error de Multer
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                // Error cuando un archivo pesa más de lo permitido (10 MB)
                return res.status(413).json({ 
                    success: false, 
                    message: `Error: Uno de los archivos es demasiado grande. El límite por archivo es de 10 MB.` 
                });

            case 'LIMIT_FILE_COUNT':
                // Error cuando se suben más archivos de los permitidos (más de 10)
                return res.status(400).json({
                    success: false,
                    message: `Error: Se ha excedido el número máximo de archivos permitidos (10 por categoría).`
                });

            case 'LIMIT_UNEXPECTED_FILE':
                 // Error cuando el nombre del campo del archivo no se espera
                return res.status(400).json({
                    success: false,
                    message: `Error: Se ha recibido un archivo en un campo no esperado.`
                });
            
            // Puedes añadir más casos para otros errores de Multer si lo necesitas
            
            default:
                 // Un error de Multer genérico que no hemos especificado
                return res.status(400).json({
                    success: false,
                    message: `Ocurrió un error al subir los archivos. Inténtalo de nuevo.`
                });
        }
    }
    
    // Si no es un error de Multer, pasamos al siguiente manejador de errores
    next(err);
}

module.exports = handleMulterError;