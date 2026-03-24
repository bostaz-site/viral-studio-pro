export interface CaptionStyle {
  id: string
  name: string
  previewStyle: React.CSSProperties
  activeWordStyle: React.CSSProperties
  position: 'top' | 'middle' | 'bottom'
  ffmpegStyle: {
    fontname: string
    fontsize: number
    primaryColor: string
    outlineColor: string
    backColor: string
    bold: number
    outline: number
    shadow: number
    alignment: number
    marginV: number
  }
}

export const CAPTION_TEMPLATES: Record<string, CaptionStyle> = {
  default: {
    id: 'default',
    name: 'Default',
    position: 'bottom',
    previewStyle: {
      fontSize: '1rem',
      fontWeight: 600,
      color: '#ffffff',
      textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
      letterSpacing: '0.01em',
    },
    activeWordStyle: {
      color: '#fbbf24',
      fontWeight: 700,
    },
    ffmpegStyle: {
      fontname: 'Arial',
      fontsize: 36,
      primaryColor: '&H00FFFFFF',
      outlineColor: '&H00000000',
      backColor: '&H80000000',
      bold: 1,
      outline: 2,
      shadow: 1,
      alignment: 2,
      marginV: 40,
    },
  },
  bold: {
    id: 'bold',
    name: 'Bold',
    position: 'bottom',
    previewStyle: {
      fontSize: '1.2rem',
      fontWeight: 900,
      color: '#ffffff',
      textShadow: '3px 3px 0px #000000, -1px -1px 0 #000, 1px -1px 0 #000',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },
    activeWordStyle: {
      color: '#f97316',
      textShadow: '3px 3px 0px #7c2d12',
    },
    ffmpegStyle: {
      fontname: 'Impact',
      fontsize: 52,
      primaryColor: '&H00FFFFFF',
      outlineColor: '&H00000000',
      backColor: '&H00000000',
      bold: 1,
      outline: 3,
      shadow: 0,
      alignment: 2,
      marginV: 30,
    },
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    position: 'bottom',
    previewStyle: {
      fontSize: '1rem',
      fontWeight: 700,
      color: '#00ff88',
      textShadow: '0 0 8px #00ff88, 0 0 16px #00ff88, 0 0 32px #00cc66',
      letterSpacing: '0.04em',
    },
    activeWordStyle: {
      color: '#ffffff',
      textShadow: '0 0 12px #ffffff, 0 0 24px #00ff88',
    },
    ffmpegStyle: {
      fontname: 'Arial',
      fontsize: 36,
      primaryColor: '&H0088FF00',
      outlineColor: '&H0044CC66',
      backColor: '&H80000000',
      bold: 1,
      outline: 2,
      shadow: 0,
      alignment: 2,
      marginV: 40,
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    position: 'bottom',
    previewStyle: {
      fontSize: '0.875rem',
      fontWeight: 400,
      color: 'rgba(255,255,255,0.95)',
      textShadow: '1px 1px 3px rgba(0,0,0,0.95)',
      letterSpacing: '0em',
    },
    activeWordStyle: {
      color: '#93c5fd',
      fontWeight: 500,
    },
    ffmpegStyle: {
      fontname: 'Arial',
      fontsize: 28,
      primaryColor: '&H00FFFFFF',
      outlineColor: '&H00000000',
      backColor: '&H00000000',
      bold: 0,
      outline: 1,
      shadow: 1,
      alignment: 2,
      marginV: 50,
    },
  },
  impact: {
    id: 'impact',
    name: 'Impact',
    position: 'top',
    previewStyle: {
      fontSize: '1.5rem',
      fontWeight: 900,
      color: '#ffffff',
      textShadow: '4px 4px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
    activeWordStyle: {
      color: '#fde047',
      textShadow: '4px 4px 0 #713f12, -2px -2px 0 #713f12',
    },
    ffmpegStyle: {
      fontname: 'Impact',
      fontsize: 60,
      primaryColor: '&H00FFFFFF',
      outlineColor: '&H00000000',
      backColor: '&H00000000',
      bold: 1,
      outline: 4,
      shadow: 0,
      alignment: 8,
      marginV: 20,
    },
  },
}

export const TEMPLATE_LIST = Object.values(CAPTION_TEMPLATES)
