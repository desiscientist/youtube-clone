/** Sends a visitor to sign in, returning them to the current page afterwards. */
export function redirectToLogin() {
  const callbackUrl = `${window.location.pathname}${window.location.search}`;
  window.location.assign(
    `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
  );
}
