import Constants from 'expo-constants';

/**
 * Saan hahanapin ang IBIS backend.
 *
 * DALAWANG PINAGMULAN, at magkaiba ang dahilan ng bawat isa:
 *
 *  • SA DEVELOPMENT, ang host ng Metro. Iisang laptop ang nagpapatakbo ng
 *    Metro at ng Laravel, kaya sumasabay ito sa bawat palit ng IP nang walang
 *    inaayos — bagong DHCP lease, ibang WiFi, tuloy pa rin.
 *
 *  • SA TOTOONG BUILD, ang nakasulat sa app.json (`expo.extra.apiBaseUrl`).
 *
 * ITO ANG DAPAT MONG BAGUHIN KAPAG NAGPALIT ANG IP NG LAPTOP. Nakabaon ang
 * address sa APK, kaya bawat palit ay nangangahulugang bagong build. Patakbuhin
 * ang `ipconfig` sa laptop, kunin ang IPv4 Address, at ilagay sa app.json.
 */

/** Sa dev, iisang makina ang Metro at ang Laravel. */
const DEV_API_PORT = 8000;

/** Hinahango ang host mula sa `hostUri` ng Metro, hal. "192.168.100.166:8081". */
function apiHostFromMetro(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];

  return host ? `http://${host}:${DEV_API_PORT}` : null;
}

export function serverUrl(): string {
  return (
    (__DEV__ ? apiHostFromMetro() : null) ??
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
    'http://127.0.0.1:8000'
  );
}
