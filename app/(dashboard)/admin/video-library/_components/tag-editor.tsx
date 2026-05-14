'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'

const NICHES = [
  'ai_tools', 'productivity', 'gaming', 'creator_tools', 'side_hustle',
  'app_reviews', 'editing', 'streaming', 'business', 'education',
]

const HOOK_TYPES = [
  'curiosity', 'shock', 'transformation', 'social_proof',
  'storytelling', 'tutorial', 'comparison', 'testimonial',
]

const TONES = ['casual', 'professional', 'funny', 'inspirational', 'edgy']

interface TagEditorProps {
  videoId: string
  currentNiche: string[]
  currentHookType: string | null
  currentTone: string | null
  currentLanguage: string
  onSaved: () => void
}

export function TagEditor({ videoId, currentNiche, currentHookType, currentTone, currentLanguage, onSaved }: TagEditorProps) {
  const [niche, setNiche] = useState<string[]>(currentNiche)
  const [hookType, setHookType] = useState(currentHookType || '')
  const [tone, setTone] = useState(currentTone || '')
  const [language, setLanguage] = useState(currentLanguage)
  const [saving, setSaving] = useState(false)

  const toggleNiche = (n: string) => {
    setNiche(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/admin/video-library/${videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          hook_type: hookType || null,
          tone: tone || null,
          language,
        }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <span className="text-xs text-zinc-500">Niches</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {NICHES.map(n => (
            <button
              key={n}
              onClick={() => toggleNiche(n)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                niche.includes(n) ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {n.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <select
          value={hookType}
          onChange={(e) => setHookType(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
        >
          <option value="">Hook...</option>
          {HOOK_TYPES.map(h => <option key={h} value={h}>{h.replace(/_/g, ' ')}</option>)}
        </select>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
        >
          <option value="">Tone...</option>
          {TONES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
        >
          <option value="en">EN</option>
          <option value="fr">FR</option>
          <option value="es">ES</option>
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1 px-3 py-1 bg-amber-600/80 text-white rounded text-xs hover:bg-amber-500 disabled:opacity-50"
      >
        <Check className="h-3 w-3" /> {saving ? 'Saving...' : 'Save Tags'}
      </button>
    </div>
  )
}
