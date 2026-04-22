import Link from 'next/link'
import { Scissors } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Viral Animal. Rules and terms for using our viral clip creation service.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Scissors className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              VIRAL ANIMAL
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 26, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By using Viral Animal, you accept these Terms of Service. If you do not accept these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Service Description</h2>
            <p className="text-muted-foreground leading-relaxed">
              Viral Animal is a SaaS tool that enables creating viral clips from stream videos. The service includes: automatic transcription, AI analysis, karaoke caption addition, split-screen with satisfying videos, and optimized export for social networks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. User Accounts</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>You must provide accurate information when registering</li>
              <li>You are responsible for the security of your account and password</li>
              <li>An account may only be used by one person</li>
              <li>You must be at least 13 years old to use the service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Plans and Payments</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li><strong className="text-foreground">Free plan</strong>: 3 videos per month, clips up to 60 seconds, watermark included</li>
              <li><strong className="text-foreground">Pro plan ($19/month)</strong>: 30 videos per month, clips up to 2 minutes, no watermark, custom branding</li>
              <li><strong className="text-foreground">Studio plan ($24/month)</strong>: 120 videos per month (90 + 30 welcome bonus), clips up to 2 minutes, split-screen, multi-platform distribution</li>
              <li>Subscriptions are billed monthly via Stripe</li>
              <li>You can cancel anytime, access remains active until the end of the paid period</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Content and Intellectual Property</h2>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>You retain all rights to the content you upload</li>
              <li>You grant us a limited license to process your content (transcription, analysis, rendering)</li>
              <li>You are responsible for respecting copyright of content you clip</li>
              <li>Clips created from third-party streams must comply with source platform terms (Twitch, YouTube)</li>
              <li>We encourage you to credit original creators</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>Use the service for illegal, hateful, or deceptive content</li>
              <li>Circumvent plan limitations (multiple accounts, etc.)</li>
              <li>Attempt to access other users' data</li>
              <li>Automate service access without authorization (scraping, bots)</li>
              <li>Resell or redistribute the service without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Viral Animal is provided "as is". We do not guarantee that the service will be continuously available or error-free. We are not responsible for damages resulting from the use or inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your account if you violate these terms. You can delete your account anytime from settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these terms at any time. Important changes will be notified by email. Continued use of the service after modification constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For any questions about these terms, contact us at: <strong className="text-foreground">legal@viralanimal.com</strong>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Viral Animal</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
