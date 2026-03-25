// -------- Create PDF Printer --------
import PdfPrinterModule from 'pdfmake/js/Printer.js';
import vfs from 'pdfmake/build/vfs_fonts.js';

const PdfPrinter = PdfPrinterModule.default;

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
