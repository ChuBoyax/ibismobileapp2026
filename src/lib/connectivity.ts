import * as Network from 'expo-network';


export async function isDeviceOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();

    return !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}
