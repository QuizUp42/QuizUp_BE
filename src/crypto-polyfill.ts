import * as nodeCrypto from 'crypto';

// Assign Node's crypto module to globalThis.crypto for TypeORM utils

(globalThis as any).crypto = (globalThis as any).crypto || nodeCrypto;
