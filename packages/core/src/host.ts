import { mergePdf } from './combiners/merge-pdf.ts';
import { createLibreOffice } from './converters/libreoffice.ts';
import { pdflibConverter } from './converters/pdflib.ts';
import { sharpConverter } from './converters/sharp.ts';
import { discoverAll } from './engines/discovery.ts';
import { ENGINE_SPECS } from './engines/specs.ts';
import { createRegistry, type Registry } from './registry.ts';
import { createServer, type RegistryInput } from './rpc/server.ts';
import type { RpcMessage } from './types/index.ts';

/** The shape of Electron's `process.parentPort`, declared here so core never imports `electron`. */
export interface HostPort {
  postMessage(message: RpcMessage): void;
  on(event: 'message', listener: (message: { data: unknown }) => void): void;
}

// Registration order is the last graph tie-break (ARCHITECTURE section 8).
export const createProductionRegistry = ({ dataDir, enginePath }: RegistryInput): Registry => {
  const registry = createRegistry();
  registry.register(sharpConverter);
  registry.register(pdflibConverter);
  registry.register(
    createLibreOffice({ binPath: () => Promise.resolve(enginePath('libreoffice')), dataDir }),
  );
  registry.register(mergePdf);
  return registry;
};

/** Binds the RPC server to the transport. `exit` runs after the shutdown reply is sent. */
export const startHost = ({ port, exit }: { port: HostPort; exit: () => void }): void => {
  const server = createServer({
    send: (message) => port.postMessage(message),
    createRegistry: createProductionRegistry,
    discover: (overrides) => discoverAll({ specs: ENGINE_SPECS, overrides }),
    onClosed: exit,
  });
  port.on('message', (message) => server.handle(message.data));
};
