import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

/**
 * Resolve the LAN address that a phone or emulator can actually reach.
 *
 * Under WSL2 the Linux side only owns a NAT address (172.x.x.x) that exists
 * inside the Windows virtual switch, so Metro advertises a host nothing else on
 * the network can route to. The address we want in that case belongs to
 * Windows, so we ask Windows for it.
 */

const isWsl = () => {
  if (process.platform !== 'linux') return false;
  try {
    return /microsoft/i.test(readFileSync('/proc/version', 'utf8'));
  } catch {
    return false;
  }
};

// The adapter holding the default gateway is the one facing the LAN. The
// vEthernet (WSL) adapter has no gateway, so this skips it on its own.
const windowsLanIp = () => {
  const script =
    '(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and ' +
    "$_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress";
  const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out.replace(/\r/g, '').trim();
};

const localLanIp = () => {
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  return candidates.find((a) => !a.startsWith('172.')) ?? candidates[0] ?? '';
};

export function resolveHostIp() {
  if (isWsl()) {
    try {
      const ip = windowsLanIp();
      if (ip) return ip;
    } catch {
      // Fall through to the Linux-side lookup below.
    }
  }
  return localLanIp();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ip = resolveHostIp();
  if (!ip) {
    console.error('Could not determine a LAN IP address.');
    process.exit(1);
  }
  console.log(ip);
}
