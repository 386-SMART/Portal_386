const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- CAMBIO 1: Definir la ruta raíz de ALMACENAMIENTO PRIVADO ---
// Esto reemplaza tu 'baseDir'. Sube dos niveles (desde src/config) a la raíz del proyecto y entra a 'storage'.
const STORAGE_PATH = path.join(__dirname, '..', '..', 'storage');

// --- Storage Logic for Contract Documents ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = '';
        if (file.fieldname === 'contratos_pdf') folder = 'contratos';
        else if (file.fieldname === 'guias_pdf') folder = 'guias';
        else if (file.fieldname === 'propuestas_pdf') folder = 'propuestas';
        else folder = 'otros';

        // --- CAMBIO 2: Usar STORAGE_PATH en lugar de baseDir ---
        const destinationPath = path.join(STORAGE_PATH, folder);
        fs.mkdirSync(destinationPath, { recursive: true });
        cb(null, destinationPath);
    },
    filename: function (req, file, cb) {
        // Tu lógica de 'filename' es buena, no necesita cambios.
        const originalName = path.parse(file.originalname).name; 
        const sanitizedName = originalName.replace(/\s+/g, '-'); 
        const extension = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, sanitizedName + '-' + uniqueSuffix + extension);
    }
});

// --- CAMBIO 3: Crear un storage seguro para 'informes' ---
// En lugar de usar 'dest:', creamos una lógica de storage dedicada
// para que los informes también se guarden en la carpeta 'storage' privada.
const informeStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const destinationPath = path.join(STORAGE_PATH, 'informes');
        fs.mkdirSync(destinationPath, { recursive: true });
        cb(null, destinationPath);
    },
    filename: function (req, file, cb) {
        // Re-usamos la misma lógica de 'filename' para consistencia
        const originalName = path.parse(file.originalname).name;
        const sanitizedName = originalName.replace(/\s+/g, '-');
        const extension = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, sanitizedName + '-' + uniqueSuffix + extension);
    }
});


// --- Filtros (Sin cambios) ---
const pdfFileFilter = (req, file, cb) => {
    console.log(`Filtrando archivo: ${file.originalname}, mimetype: ${file.mimetype}`);
    const isPdfMimeType = file.mimetype === 'application/pdf';
    const isPdfExtension = path.extname(file.originalname).toLowerCase() === '.pdf';

    if (isPdfMimeType || isPdfExtension) {
        cb(null, true);
    } else {
        const errorMsg = `Archivo rechazado. Solo se permiten PDFs. El archivo '${file.originalname}' fue detectado como '${file.mimetype}'.`;
        console.error(errorMsg);
        cb(new Error(errorMsg), false);
    }
};

const imageFileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    const isAllowedMimeType = allowedMimeTypes.includes(file.mimetype);

    if (isAllowedMimeType) {
        cb(null, true);
    } else {
        cb(new Error('El logo debe ser un archivo en formato JPG o PNG.'), false);
    }
};

// --- Main Upload Middleware for PDFs ---
// (Esto ahora usa el 'storage' seguro automáticamente)
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB limit per file
    },
    fileFilter: pdfFileFilter
});

// --- Other Multer Configurations ---

// --- CAMBIO 4: Actualizar 'informeUploads' para que use el storage seguro ---
const informeUploads = multer({ 
    storage: informeStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB (puedes ajustar esto)
    }
    // Asumimos que los informes pueden ser imágenes o PDFs,
    // así que no ponemos un filtro estricto por ahora.
});

// (Estos están bien, usan memoryStorage para procesamiento, no para guardado directo)
const uploadLogo = multer({ 
    storage: multer.memoryStorage(),
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const uploadXlsx = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

// ... (Mantén todo tu código anterior de imports y STORAGE_PATH) ...

// --- NUEVO: Storage Especial para Firmas ---
const firmaStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'firmas/otros'; 

        // Decide la carpeta según el nombre del campo en el formulario
        if (file.fieldname === 'firma_tecnico') {
            folder = 'firmas/tecnicos';
        } else if (file.fieldname === 'firma_cliente') {
            folder = 'firmas/clientes';
        }

        const destinationPath = path.join(STORAGE_PATH, folder);
        
        // Crea la carpeta si no existe
        fs.mkdirSync(destinationPath, { recursive: true });
        
        cb(null, destinationPath);
    },
    filename: function (req, file, cb) {
        const extension = path.extname(file.originalname);
        // Nombre único: firma-timestamp-random.png
        const uniqueSuffix = 'firma-' + Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + extension);
    }
});

// Filtro para aceptar solo imágenes
const firmaFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Formato inválido. Solo se permiten imágenes (JPG, PNG).'), false);
    }
};

// Middleware listo para exportar
const uploadFirma = multer({ 
    storage: firmaStorage,
    fileFilter: firmaFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // Máximo 2MB
});

// --- Actualiza el exports al final ---
module.exports = {
    informeUploads,
    uploadLogo,
    uploadXlsx,
    upload,
    uploadFirma // <--- ¡AGREGADO!
};