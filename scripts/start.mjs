import { spawn } from 'node:child_process';
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

const child = spawn('npx', ['expo', 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: ip ? { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: ip } : process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
