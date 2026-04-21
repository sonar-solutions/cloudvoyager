// -------- Create PDF Printer --------
import PdfPrinterModule from 'pdfmake/js/Printer.js';
import vfsModule from 'pdfmake/build/vfs_fonts.js';

const PdfPrinter = typeof PdfPrinterModule === 'function' ? PdfPrinterModule : (PdfPrinterModule.default || PdfPrinterModule);
const vfs = vfsModule.pdfMake?.vfs || vfsModule;

function createVirtualFs(vfsData) {
  return {
    existsSync(path) { return path.split('/').pop() in vfsData; },
    readFileSync(path) { return Buffer.from(vfsData[path.split('/').pop()], 'base64'); },
  };
}

export function createPrinter() {
  const fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf',
    }
  };
  return new PdfPrinter(fonts, createVirtualFs(vfs));
}
