// Single source of truth for admin email checks.
// Used server-side only (via /api/auth/me and withAdmin.ts).
//
// Reads ADMIN_EMAILS (server-only env var).
// Falls back to Samy's personal address so the admin panel works on day one.

const DEFAULT_ADMIN_EMAILS = 'samycloutier30@gmail.com'

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAILS
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().has(email.toLowerCase())
}
