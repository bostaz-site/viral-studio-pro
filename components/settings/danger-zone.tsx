'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

/**
 * GDPR-compliant account deletion section.
 *
 * Pattern used by GitHub / Vercel / Notion: user must type their exact email
 * to confirm. No password required (they're already authenticated).
 *
 * After successful deletion:
 *  1. Server has cascaded delete through all user-scoped tables
 *  2. Client signs out (clears session)
 *  3. Redirect to landing page with a "deleted" query param
 */
export function DangerZone({ userEmail }: { userEmail: string }) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const expected = (userEmail ?? '').trim().toLowerCase()
  const provided = emailInput.trim().toLowerCase()
  const emailMatches = expected.length > 0 && provided === expected
  const canConfirm = emailMatches && acknowledged && !submitting

  async function handleDelete() {
    if (!canConfirm) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailConfirmation: emailInput }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || 'Failed to delete account. Please contact support.')
        setSubmitting(false)
        return
      }
      // Sign out client-side and redirect
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/?deleted=1')
    } catch {
      setErrorMsg('Network error. Please try again or contact support.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Section header — red themed */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-center">
          <AlertTriangle className="h-4 w-4 text-red-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-red-300">Danger zone</h2>
          <p className="text-xs text-muted-foreground">Permanent actions that cannot be undone.</p>
        </div>
      </div>

      <Card className="border-red-500/25 bg-red-500/5">
        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Delete account</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Permanently delete your Viral Animal account and all associated data:
              clips, renders, scheduled posts, connected social accounts, creator rank
              history, and analytics. This <strong>cannot be undone</strong>.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/60"
            onClick={() => {
              setShowModal(true)
              setEmailInput('')
              setAcknowledged(false)
              setErrorMsg(null)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete my account
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={() => !submitting && setShowModal(false)}
          onKeyDown={(e) => { if (e.key === 'Escape' && !submitting) setShowModal(false) }}
        >
          <div
            className="bg-card border border-red-500/30 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-4.5 w-4.5 text-red-400" />
                </div>
                <h3 id="delete-account-title" className="text-base font-bold text-foreground">
                  Delete account?
                </h3>
              </div>
              <button
                onClick={() => !submitting && setShowModal(false)}
                disabled={submitting}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed">
              This will <strong className="text-foreground">permanently delete</strong> your
              Viral Animal account, all your clips, renders, published posts, connected
              social accounts, and creator rank history.
              <br />
              <span className="text-red-400 font-medium">This action cannot be undone.</span>
            </div>

            {/* Email confirmation */}
            <div className="space-y-1.5">
              <label htmlFor="delete-email-confirm" className="text-xs font-medium text-foreground">
                Type your email to confirm:{' '}
                <code className="text-[11px] bg-muted/50 px-1.5 py-0.5 rounded text-red-300">
                  {userEmail}
                </code>
              </label>
              <input
                id="delete-email-confirm"
                type="email"
                autoComplete="off"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/40 disabled:opacity-50"
                placeholder={userEmail}
              />
            </div>

            {/* Acknowledgment checkbox */}
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 accent-red-500 disabled:opacity-50"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I understand this is permanent and all my data will be deleted forever.
              </span>
            </label>

            {/* Error message */}
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                <span className="text-destructive">{errorMsg}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={!canConfirm}
                className="gap-1.5 bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete forever
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
