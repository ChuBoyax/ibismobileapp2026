import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveHostIp } from './host-ip.mjs';

/**
 * Open the running Metro bundle in Expo Go on an Android emulator.
 *
 * `expo start` + `a` cannot do this under WSL2: Expo shells out to the Linux
 * adb, which talks to a Linux-side adb server that has no visibility into an
 * emulator running on Windows. Driving the Windows adb.exe directly avoids
 * needing to bridge the two adb servers.
 */

const isWsl = () => {
  if (process.platform !== 'linux') return false;
  try {
    return /microsoft/i.test(readFileSync('/proc/version', 'utf8'));
  } catch {
    return false;
  }
};

const windowsAdb = () => {
  const users = '/mnt/c/Users';
  if (!existsSync(users)) return null;
  for (const user of readdirSync(users)) {
    const adb = join(users, user, 'AppData/Local/Android/Sdk/platform-tools/adb.exe');
    if (existsSync(adb)) return adb;
  }
  return null;
};

const adbBin = (isWsl() && windowsAdb()) || 'adb';
const adb = (...args) =>
  execFileSync(adbBin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .replace(/\r/g, '')
    .trim();

let devices;
try {
  devices = adb('devices')
    .split('\n')
    .slice(1)
    .filter((l) => l.trim().endsWith('\tdevice'))
    .map((l) => l.split('\t')[0]);
} catch {
  console.error(`Could not run adb (${adbBin}). Is the Android SDK installed?`);
  process.exit(1);
}

if (devices.length === 0) {
  console.error('No Android device or emulator found. Start your AVD, then retry.');
  process.exit(1);
}

const ip = resolveHostIp();
if (!ip) {
  console.error('Could not determine a LAN IP address.');
  process.exit(1);
}

const port = process.env.RCT_METRO_PORT ?? '8081';
const url = `exp://${ip}:${port}`;
const target = devices[0];

adb('-s', target, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, 'host.exp.exponent');
console.log(`› opened ${url} on ${target}`);
