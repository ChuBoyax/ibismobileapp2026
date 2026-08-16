import { router, type Href } from 'expo-router';

/**
 * Ligtas na pagbalik sa nakaraang screen.
 *
 * Ang router.back() ay nabibigo kapag walang laman ang history — nangyayari
 * ito kapag nag-reload ang app habang nasa pushed screen (Fast Refresh o
 * pagpindot ng `r`), o kapag deep link ang pinasukan. Naibabalik ang route
 * pero hindi ang mga screen na pinanggalingan, kaya walang mababalikan:
 *
 *   ERROR  The action 'GO_BACK' was not handled by any navigator.
 *
 * Bukod sa warning, hindi rin gumagalaw ang back button — dead end ang user.
 * Kaya kapag walang mababalikan, dinadala na lang natin siya sa fallback.
 */
export function goBack(fallback: Href = '/dashboard') {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
