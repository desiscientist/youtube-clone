/** Admins are the accounts listed in ADMIN_EMAILS (comma-separated). */
export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLocaleLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLocaleLowerCase());
}
