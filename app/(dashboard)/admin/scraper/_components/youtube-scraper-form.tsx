'use client'

import { useState } from 'react'
import { Search, Save, Mail } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface Props {
  onSearch: (params: { query: string; maxResults: number; language?: string; requireEmail?: boolean }) => Promise<void>
  onSaveSearch: (name: string, query: string) => Promise<void>
  loading: boolean
  savedSearches: Array<{ id: string; name: string; query: string }>
}

/** Normalize smart/curly quotes to straight ASCII quotes */
function sanitizeQuery(q: string): string {
  return q
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
}

export function YouTubeScraperForm({ onSearch, onSaveSearch, loading, savedSearches }: Props) {
  const [query, setQuery] = useState('')
  const [maxResults, setMaxResults] = useState(15)
  const [language, setLanguage] = useState('')
  const [saveName, setSaveName] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [requireEmail, setRequireEmail] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const sanitized = sanitizeQuery(query).trim()
    if (!sanitized) return
    onSearch({ query: sanitized, maxResults, language: language || undefined, requireEmail: requireEmail || undefined })
  }

  const handleSave = () => {
    if (!saveName.trim() || !query.trim()) return
    onSaveSearch(saveName.trim(), sanitizeQuery(query).trim())
    setSaveName('')
    setShowSave(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">Search Query</Label>
          <Input
            placeholder='"use code" AI tools creator review'
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <div className="w-20">
          <Label className="text-xs text-muted-foreground mb-1 block">Max</Label>
          <Input
            type="number"
            value={maxResults}
            onChange={e => setMaxResults(Math.min(25, Math.max(5, parseInt(e.target.value) || 15)))}
            className="text-sm"
          />
        </div>
        <div className="w-20">
          <Label className="text-xs text-muted-foreground mb-1 block">Lang</Label>
          <Input
            placeholder="en"
            value={language}
            onChange={e => setLanguage(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {savedSearches.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setQuery(s.query)}
              className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !query.trim()} className="gap-1.5">
          {loading ? <WolfLoader variant="spinner" size={16} mode="amber" /> : <Search className="h-4 w-4" />}
          Search YouTube
        </Button>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 border border-border">
          <Mail className="h-3.5 w-3.5 text-amber-400" />
          <Label htmlFor="require-email" className="text-xs text-muted-foreground cursor-pointer select-none">Only with email</Label>
          <Switch id="require-email" checked={requireEmail} onCheckedChange={setRequireEmail} className="scale-75" />
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => setShowSave(!showSave)} className="gap-1">
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
        {showSave && (
          <div className="flex items-center gap-1.5">
            <Input
              placeholder="Search name..."
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              className="h-8 w-40 text-xs"
            />
            <Button type="button" size="sm" className="h-8" onClick={handleSave} disabled={!saveName.trim()}>
              Save
            </Button>
          </div>
        )}
      </div>
    </form>
  )
}
