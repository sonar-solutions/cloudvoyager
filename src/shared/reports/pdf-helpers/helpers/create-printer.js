// -------- Create PDF Printer --------
import PdfPrinterModule from 'pdfmake/js/Printer.js';
import URLResolverModule from 'pdfmake/js/URLResolver.js';
import vfsModule from 'pdfmake/build/vfs_fonts.js';

const PdfPrinter = typeof PdfPrinterModule === 'function' ? PdfPrinterModule : (PdfPrinterModule.default || PdfPrinterModule);
const URLResolver = typeof URLResolverModule === 'function' ? URLResolverModule : (URLResolverModule.default || URLResolverModule);
const vfs = vfsModule.pdfMake?.vfs || vfsModule.default || vfsModule;

function createVirtualFs(vfsData) {
  return {
    existsSync(path) { return path.split('/').pop() in vfsData; },
    readFileSync(path) { return Buffer.from(vfsData[path.split('/').pop()], 'base64'); },
    writeFileSync() {},
  };
}

export function createPrinter() {
  const fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf',
    }
  };
  const virtualFs = createVirtualFs(vfs);
  const urlResolver = new URLResolver(virtualFs);
  return new PdfPrinter(fonts, virtualFs, urlResolver);
}
