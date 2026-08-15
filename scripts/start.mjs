import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

import { resolveHostIp } from './host-ip.mjs';

// Metro derives its advertised URL from the machine's own interfaces, which is
// wrong under WSL2. Pinning the hostname keeps the QR code and the emulator
// deep link pointed at an address that is reachable off-box.
const ip = resolveHostIp();

if (ip) {
  console.log(`\x1b[2m› host: ${ip}\x1b[0m`);
} else {
  console.warn('\x1b[33m› could not resolve a LAN IP, letting Expo choose\x1b[0m');
}

// Diretso sa lokal na Expo CLI imbes na dumaan sa `npx`. Sa Windows kasi ay
// `npx.cmd` ang totoong file — hindi ito mahahanap ng spawn (`ENOENT`), at
// ayaw nang magpatakbo ng Node 20+ ng .cmd nang walang shell. Ang pagtawag
// sa CLI gamit ang sariling node binary ay iisa ang gawi sa lahat ng OS at
// hindi na kailangan ng shell.
const expoCli = createRequire(import.meta.url).resolve('expo/bin/cli');

const child = spawn(process.execPath, [expoCli, 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: ip ? { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: ip } : process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
