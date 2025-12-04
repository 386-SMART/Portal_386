const fs = require('fs');
const path = require('path');
const db = require('./conexiondb'); // Asegúrate que esta ruta apunte a tu archivo conexiondb.js

// Configuración de rutas
const STORAGE_PATH = path.join(__dirname, 'storage');

async function migrarFirmas() {
    console.log("🚀 Iniciando migración de firmas...");
    
    let connection;
    try {
        connection = await db.getConnection();
        
        // 1. Obtener todos los informes que tengan firmas (asumimos que son textos largos)
        // Buscamos campos que empiecen con 'data:image' o que sean muy largos
        const [informes] = await connection.execute(
            `SELECT id_informe, firma_usuario, firma_tecnico 
             FROM InformeCampo 
             WHERE firma_usuario LIKE 'data:image%' OR firma_tecnico LIKE 'data:image%'`
        );

        console.log(`📊 Se encontraron ${informes.length} informes con firmas en Base64 para procesar.`);

        for (const informe of informes) {
            console.log(`\n🔹 Procesando Informe ID: ${informe.id_informe}`);
            
            let nuevaRutaUsuario = informe.firma_usuario;
            let nuevaRutaTecnico = informe.firma_tecnico;
            let huboCambios = false;

            // --- Procesar Firma Cliente ---
            if (esBase64(informe.firma_usuario)) {
                const nombreArchivo = `cliente_inf_${informe.id_informe}_${Date.now()}.png`;
                const rutaRelativa = path.join('firmas', 'clientes', nombreArchivo);
                const rutaAbsoluta = path.join(STORAGE_PATH, rutaRelativa);

                if (guardarImagen(informe.firma_usuario, rutaAbsoluta)) {
                    nuevaRutaUsuario = rutaRelativa.replace(/\\/g, '/'); // Asegurar slash normal para BD
                    huboCambios = true;
                    console.log(`   ✅ Firma Cliente migrada a: ${nuevaRutaUsuario}`);
                }
            }

            // --- Procesar Firma Técnico (si existe en este registro antiguo) ---
            if (esBase64(informe.firma_tecnico)) {
                const nombreArchivo = `tecnico_inf_${informe.id_informe}_${Date.now()}.png`;
                const rutaRelativa = path.join('firmas', 'tecnicos', nombreArchivo);
                const rutaAbsoluta = path.join(STORAGE_PATH, rutaRelativa);

                if (guardarImagen(informe.firma_tecnico, rutaAbsoluta)) {
                    nuevaRutaTecnico = rutaRelativa.replace(/\\/g, '/');
                    huboCambios = true;
                    console.log(`   ✅ Firma Técnico migrada a: ${nuevaRutaTecnico}`);
                }
            }

            // --- Actualizar BD ---
            if (huboCambios) {
                await connection.execute(
                    `UPDATE InformeCampo SET firma_usuario = ?, firma_tecnico = ? WHERE id_informe = ?`,
                    [nuevaRutaUsuario, nuevaRutaTecnico, informe.id_informe]
                );
            }
        }

        console.log("\n✨ Migración completada exitosamente.");

    } catch (error) {
        console.error("❌ Error fatal durante la migración:", error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

// --- Funciones Auxiliares ---

function esBase64(texto) {
    return texto && typeof texto === 'string' && texto.startsWith('data:image');
}

function guardarImagen(base64String, outputPath) {
    try {
        // El formato suele ser: "data:image/png;base64,iVBORw0KGgo..."
        // Necesitamos quitar la cabecera antes de guardar
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
            console.warn("   ⚠️ Formato Base64 inválido o no reconocido.");
            return false;
        }

        const buffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(outputPath, buffer);
        return true;
    } catch (err) {
        console.error(`   ❌ Error guardando archivo: ${err.message}`);
        return false;
    }
}

// Ejecutar
migrarFirmas();