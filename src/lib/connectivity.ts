import * as Network from 'expo-network';

/**
 * May koneksyon ba ang cellphone?
 *
 * Ang tanong dito ay sa DEVICE, hindi sa server. Mabilis itong sagutin —
 * hindi tulad ng pagpapadala ng request na aabot ng labinlimang segundo bago
 * sumuko. Kaya kapag alam na nating walang signal, hindi na natin sasayangin
 * ang oras ng user sa paghihintay ng bagay na tiyak na mabibigo.
 *
 * Mapagbigay ang default: kapag hindi malaman ang estado, ipinapalagay na
 * konektado at hahayaang ang request mismo ang magsabi. Mas mabuting sumubok
 * nang minsanan kaysa iwasan ang server na buhay naman pala.
 */
export async function isDeviceOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();

    // Ang isInternetReachable ay minsan undefined sa ilang device — sa
    // ganoong kaso, ang isConnected na lang ang batayan.
    return !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}
