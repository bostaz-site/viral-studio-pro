// Client-safe admin email check. Keeps the allowlist in sync with
// lib/api/withAdmin.ts — the server version is authoritative, this one
// just controls whether the "Admin" nav link renders.
//
// Using NEXT_PUBLIC_ADMIN_EMAILS so it's embedded at build time; falls
// back to Samy's personal address so the button works on day one.

const DEFAULT_ADMIN_EMAILS = 'samycloutier30@gmail.com'

function getAdminEmails(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAILS
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
