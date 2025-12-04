const PdfPrinter = require('pdfmake');
const path = require('path');

// --- INICIO DE LA CORRECCIÓN DEFINITIVA ---
// Usando las rutas exactas de tus capturas de pantalla
const fonts = {
    Roboto: {
        normal: path.resolve('node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf'),
        bold: path.resolve('node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf'),
        italics: path.resolve('node_modules/roboto-font/fonts/Roboto/roboto-italic-webfont.ttf'),
        bolditalics: path.resolve('node_modules/roboto-font/fonts/Roboto/roboto-bolditalic-webfont.ttf')
    }
};
// --- FIN DE LA CORRECCIÓN DEFINITIVA ---

const printer = new PdfPrinter(fonts);

const createPdf = (docDefinition) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = printer.createPdfKitDocument({ ...docDefinition, defaultStyle: { font: 'Roboto' } });
            
            const chunks = [];
            doc.on('data', (chunk) => {
                chunks.push(chunk);
            });

            doc.on('end', () => {
                const result = Buffer.concat(chunks);
                resolve(result);
            });

            doc.end();

        } catch (err) {
            reject(err);
        }
    });
};

module.exports = {
    createPdf
};