import type { EngineSpec } from '../types/index.ts';

// TRD section 4 (engines and licenses). Poppler joins with M1.1-2.
export const ENGINE_SPECS: readonly EngineSpec[] = [
  { id: 'sharp', pack: 'builtin', bundled: true, installUrl: 'https://sharp.pixelplumbing.com/' },
  { id: 'pdflib', pack: 'builtin', bundled: true, installUrl: 'https://pdf-lib.js.org/' },
  {
    id: 'libreoffice',
    pack: 'office',
    bins: { win32: ['soffice'], darwin: ['soffice'], linux: ['soffice', 'libreoffice'] },
    knownPaths: {
      win32: ['C:\\Program Files\\LibreOffice\\program\\soffice.exe'],
      darwin: ['/Applications/LibreOffice.app/Contents/MacOS/soffice'],
      linux: ['/usr/bin/soffice', '/opt/libreoffice*/program/soffice', '/snap/bin/soffice'],
    },
    versionArgs: ['--version'],
    versionPattern: 'LibreOffice (\\d+(?:\\.\\d+)*)',
    installUrl: 'https://www.libreoffice.org/download/download-libreoffice/',
  },
];
