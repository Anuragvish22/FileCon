import { startHost, type HostPort } from './host.ts';

// utilityProcess runs this file; `parentPort` is how Electron names the channel to main.
const { parentPort } = process as NodeJS.Process & { parentPort?: HostPort };
if (parentPort === undefined) throw new Error('core host must run as an Electron utilityProcess');
startHost({ port: parentPort, exit: () => process.exit(0) });
