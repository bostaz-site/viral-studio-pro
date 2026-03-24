export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
            VIRAL STUDIO
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Créez des clips viraux avec l&apos;IA</p>
        </div>
        {children}
      </div>
    </div>
  )
}
