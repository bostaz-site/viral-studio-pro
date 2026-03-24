"use client"

import { useState, useRef } from 'react'
import { Upload, X, Loader2, ImageIcon, Film, Droplets, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface BrandEditorProps {
  onSuccess?: () => void
  onCancel?: () => void
}

const FONT_OPTIONS = [
  'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Oswald',
  'Raleway', 'Bebas Neue', 'Nunito', 'Source Sans Pro', 'Playfair Display',
]

interface FilePreview {
  file: File
  previewUrl: string
}

function FileUploadSlot({
  label,
  accept,
  icon: Icon,
  value,
  onChange,
  onClear,
}: {
  label: string
  accept: string
  icon: React.ElementType
  value: FilePreview | null
  onChange: (preview: FilePreview) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    onChange({ file, previewUrl })
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {value ? (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
          {accept.includes('image') && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.previewUrl} alt="" className="h-8 w-8 object-contain rounded" />
          )}
          {!accept.includes('image') && <Film className="h-8 w-8 text-muted-foreground" />}
          <span className="text-xs text-foreground truncate flex-1">{value.file.name}</span>
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-muted/20 transition-all text-muted-foreground text-xs"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>Choisir un fichier</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

export function BrandEditor({ onSuccess, onCancel }: BrandEditorProps) {
  const [name, setName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#6366f1')
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6')
  const [fontFamily, setFontFamily] = useState('Inter')
  const [isDefault, setIsDefault] = useState(false)
  const [logo, setLogo] = useState<FilePreview | null>(null)
  const [watermark, setWatermark] = useState<FilePreview | null>(null)
  const [intro, setIntro] = useState<FilePreview | null>(null)
  const [outro, setOutro] = useState<FilePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis'); return }

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('name', name.trim())
    formData.append('primary_color', primaryColor)
    formData.append('secondary_color', secondaryColor)
    formData.append('font_family', fontFamily)
    formData.append('is_default', String(isDefault))
    if (logo?.file)      formData.append('logo', logo.file)
    if (watermark?.file) formData.append('watermark', watermark.file)
    if (intro?.file)     formData.append('intro', intro.file)
    if (outro?.file)     formData.append('outro', outro.file)

    try {
      const res = await fetch('/api/brand-templates', { method: 'POST', body: formData })
      const data = await res.json() as { error: string | null; message: string }
      if (!res.ok || data.error) throw new Error(data.message ?? data.error ?? 'Erreur')
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="brand-name">Nom du template</Label>
        <Input
          id="brand-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ma Marque"
          required
        />
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
            Couleur primaire
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
            />
            <span className="text-sm text-muted-foreground font-mono">{primaryColor}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
            Couleur secondaire
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
            />
            <span className="text-sm text-muted-foreground font-mono">{secondaryColor}</span>
          </div>
        </div>
      </div>

      {/* Font */}
      <div className="space-y-1.5">
        <Label htmlFor="font-family">Police</Label>
        <select
          id="font-family"
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
          className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* File uploads */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Assets</p>
        <div className="grid grid-cols-2 gap-3">
          <FileUploadSlot
            label="Logo (PNG/SVG)"
            accept="image/*"
            icon={ImageIcon}
            value={logo}
            onChange={setLogo}
            onClear={() => setLogo(null)}
          />
          <FileUploadSlot
            label="Watermark (PNG transparent)"
            accept="image/png"
            icon={ImageIcon}
            value={watermark}
            onChange={setWatermark}
            onClear={() => setWatermark(null)}
          />
          <FileUploadSlot
            label="Intro vidéo (MP4)"
            accept="video/mp4"
            icon={Film}
            value={intro}
            onChange={setIntro}
            onClear={() => setIntro(null)}
          />
          <FileUploadSlot
            label="Outro vidéo (MP4)"
            accept="video/mp4"
            icon={Film}
            value={outro}
            onChange={setOutro}
            onClear={() => setOutro(null)}
          />
        </div>
      </div>

      {/* Preview swatch */}
      <Card className="bg-muted/20 border-border">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-6 h-6 rounded-full border border-border/50" style={{ backgroundColor: primaryColor }} />
            <div className="w-6 h-6 rounded-full border border-border/50" style={{ backgroundColor: secondaryColor }} />
          </div>
          <p className="text-sm font-medium text-foreground" style={{ fontFamily }}>
            Aa — {name || 'Aperçu'}
          </p>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.previewUrl} alt="logo" className="h-6 w-auto ml-auto object-contain" />
          )}
        </CardContent>
      </Card>

      {/* Is default toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <div
          onClick={() => setIsDefault(!isDefault)}
          className={cn(
            'w-10 h-5 rounded-full transition-colors relative cursor-pointer',
            isDefault ? 'bg-primary' : 'bg-muted'
          )}
        >
          <div className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            isDefault ? 'translate-x-5' : 'translate-x-0.5'
          )} />
        </div>
        <Star className={cn('h-3.5 w-3.5', isDefault ? 'text-yellow-400' : 'text-muted-foreground')} />
        <span className="text-sm text-foreground">Définir comme template par défaut</span>
      </label>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
        )}
        <Button type="submit" className="flex-1 gap-2" disabled={loading}>
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</>
          ) : (
            <><Upload className="h-4 w-4" /> Créer le template</>
          )}
        </Button>
      </div>
    </form>
  )
}
