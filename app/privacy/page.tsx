import Link from 'next/link'
import { Scissors } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Viral Animal Privacy Policy. Learn how we protect your personal data.',
}

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 26, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Viral Animal ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you use our viral clip creation service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Data We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We collect the following types of data:</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li><strong className="text-foreground">Account information</strong>: name, email address, password (encrypted)</li>
              <li><strong className="text-foreground">Uploaded content</strong>: videos, clips, thumbnails you upload to the platform</li>
              <li><strong className="text-foreground">Usage data</strong>: features used, clips created, processing time</li>
              <li><strong className="text-foreground">Technical data</strong>: IP address, browser type, operating system</li>
              <li><strong className="text-foreground">Payment data</strong>: securely processed by Stripe (we do not store your bank details)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Data</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Your data is used to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>Provide and improve our clip creation services</li>
              <li>Process your videos (transcription, AI analysis, rendering)</li>
              <li>Manage your account and subscription</li>
              <li>Send you service-related notifications</li>
              <li>Prevent fraud and ensure security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We use the following third-party services:</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li><strong className="text-foreground">Supabase</strong>: database hosting and file storage</li>
              <li><strong className="text-foreground">OpenAI (Whisper)</strong>: audio transcription of your videos</li>
              <li><strong className="text-foreground">Anthropic (Claude)</strong>: AI analysis of clips and viral score generation</li>
              <li><strong className="text-foreground">Stripe</strong>: secure payment processing</li>
              <li><strong className="text-foreground">Netlify</strong>: application hosting</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored securely via Supabase with encryption at rest and in transit. Passwords are hashed. Uploaded videos are stored in private buckets with row-level security controls. We never share your videos with third parties without your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">Under GDPR, you have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>Access your personal data</li>
              <li>Correct your data</li>
              <li>Delete your account and all your data</li>
              <li>Export your data (portability)</li>
              <li>Withdraw your consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies only to maintain your authentication session. We do not use advertising tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For any questions about this Privacy Policy or to exercise your rights, contact us at: <strong className="text-foreground">privacy@viralanimal.com</strong>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/30 py-8 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Viral Animal</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of service</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
