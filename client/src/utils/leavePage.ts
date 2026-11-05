/**
 * Leave the client for another site's address, as the OAuth consent page does to
 * send the person back to an app (SPEC §6; §15 DR-152). Its own module so tests
 * can stand in for the browser's navigation.
 */
export function leavePage(url: string): void {
  window.location.assign(url);
}
