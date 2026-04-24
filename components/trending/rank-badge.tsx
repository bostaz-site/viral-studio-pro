"use client"

import React from 'react'
import type { ClipRank } from '@/types/trending'

/** Map ClipRank to the CSS tier class for card styling */
export function getRankTierClass(rank: ClipRank): string {
  switch (rank) {
    case 'master': return 'r-master'
    case 'legendary': return 'r-legendary'
    case 'epic': return 'r-epic'
    default: return 'r-neutral'
  }
}

/** Diamond SVG corner for Legendary cards */
export function DiamondCorner({ className }: { className?: string }) {
  const id = React.useId()
  return (
    <svg className={className} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`dia-glow-${id}`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1"/>
          <stop offset="45%" stopColor="#FEF9C3" stopOpacity=".9"/>
          <stop offset="100%" stopColor="#FCD34D" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={`dia-edge-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF"/>
          <stop offset="50%" stopColor="#FCD34D"/>
          <stop offset="100%" stopColor="#B45309"/>
        </linearGradient>
      </defs>
      <circle cx="13" cy="13" r="14" fill={`url(#dia-glow-${id})`} opacity=".7"/>
      <path d="M13 2 L22 6 L24 13 L22 20 L13 24 L4 20 L2 13 L4 6 Z" fill={`url(#dia-edge-${id})`} stroke="#FFF9DB" strokeWidth=".6"/>
      <path d="M13 2 L22 6 L13 9 Z" fill="#FFFFFF" opacity=".95"/>
      <path d="M13 2 L4 6 L13 9 Z" fill="#FEF9C3" opacity=".85"/>
      <path d="M4 6 L2 13 L13 9 Z" fill="#FDE68A" opacity=".7"/>
      <path d="M22 6 L24 13 L13 9 Z" fill="#FEF3C7" opacity=".8"/>
      <path d="M13 9 L24 13 L22 20 Z" fill="#F59E0B" opacity=".55"/>
      <path d="M13 9 L22 20 L13 24 Z" fill="#D97706" opacity=".6"/>
      <path d="M13 9 L13 24 L4 20 Z" fill="#B45309" opacity=".5"/>
      <path d="M13 9 L4 20 L2 13 Z" fill="#F59E0B" opacity=".5"/>
      <ellipse cx="10" cy="6" rx="2.5" ry="1" fill="#FFFFFF" opacity=".9"/>
      <circle cx="9" cy="5.5" r=".8" fill="#FFFFFF"/>
    </svg>
  )
}

/** Filigree SVG corner for Master cards */
export function MasterCorner({ className }: { className?: string }) {
  const id = React.useId()
  return (
    <svg className={className} viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`mc-gold-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF4B8"/>
          <stop offset="50%" stopColor="#FCD34D"/>
          <stop offset="100%" stopColor="#92400E"/>
        </linearGradient>
        <radialGradient id={`mc-halo-${id}`} cx="30%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity=".5"/>
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="34" height="34" fill={`url(#mc-halo-${id})`}/>
      <path d="M2 2 L18 2 C10 4 4 10 2 18 Z" fill="#0A0704"/>
      <path d="M2 2 L14 2 Q12 5 9 6 Q6 7 4 10 Q2 13 2 16 Z" fill={`url(#mc-gold-${id})`} stroke="#78350F" strokeWidth=".4"/>
      <path d="M6 4 Q9 5 9 8 Q9 11 6 11 Q4 11 4 9" fill="none" stroke="#FCD34D" strokeWidth=".9" strokeLinecap="round"/>
      <circle cx="5" cy="5" r="1.4" fill="#FCD34D" stroke="#78350F" strokeWidth=".3"/>
      <circle cx="5" cy="5" r=".5" fill="#78350F"/>
      <path d="M14 2 L20 2 L22 4 L18 4 L16 6 Z" fill={`url(#mc-gold-${id})`} stroke="#78350F" strokeWidth=".3"/>
      <path d="M2 14 L2 20 L4 22 L4 18 L6 16 Z" fill={`url(#mc-gold-${id})`} stroke="#78350F" strokeWidth=".3"/>
      <g transform="translate(9.5 9.5) scale(.55)">
        <ellipse cx="5" cy="5" rx="4.5" ry="4.2" fill="#1A0F03" stroke="#FCD34D" strokeWidth=".6"/>
        <circle cx="3.3" cy="5" r="1.1" fill="#FCD34D"/>
        <circle cx="6.7" cy="5" r="1.1" fill="#FCD34D"/>
        <rect x="4.2" y="7" width="1.6" height=".6" fill="#FCD34D"/>
        <rect x="4.2" y="7.9" width="1.6" height=".4" fill="#FCD34D"/>
      </g>
    </svg>
  )
}

/** Crown SVG pediment for Master cards */
export function MasterCrown({ className }: { className?: string }) {
  const id = React.useId()
  return (
    <svg className={className} viewBox="0 0 78 32" xmlns="http://www.w3.org/2000/svg" style={{ width: 110, height: 44 }}>
      <defs>
        <linearGradient id={`mcrown-body-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF4B8"/>
          <stop offset="45%" stopColor="#FCD34D"/>
          <stop offset="100%" stopColor="#92400E"/>
        </linearGradient>
        <radialGradient id={`mcrown-gem-${id}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF"/>
          <stop offset="60%" stopColor="#FCD34D"/>
          <stop offset="100%" stopColor="#B45309"/>
        </radialGradient>
      </defs>
      <rect x="14" y="22" width="50" height="7" rx="1" fill={`url(#mcrown-body-${id})`} stroke="#78350F" strokeWidth=".6"/>
      <path d="M18 25 Q22 23 26 25 Q30 27 34 25 Q38 23 42 25 Q46 27 50 25 Q54 23 58 25 Q60 26 62 25" fill="none" stroke="#78350F" strokeWidth=".5"/>
      <path d="M39 22 L36 10 L39 2 L42 10 L39 22 Z" fill={`url(#mcrown-body-${id})`} stroke="#78350F" strokeWidth=".6" strokeLinejoin="round"/>
      <circle cx="39" cy="3" r="2.2" fill={`url(#mcrown-gem-${id})`} stroke="#78350F" strokeWidth=".4"/>
      <path d="M26 22 L24 12 L26 7 L28 12 Z" fill={`url(#mcrown-body-${id})`} stroke="#78350F" strokeWidth=".5" strokeLinejoin="round"/>
      <circle cx="26" cy="8" r="1.6" fill={`url(#mcrown-gem-${id})`} stroke="#78350F" strokeWidth=".3"/>
      <path d="M52 22 L50 12 L52 7 L54 12 Z" fill={`url(#mcrown-body-${id})`} stroke="#78350F" strokeWidth=".5" strokeLinejoin="round"/>
      <circle cx="52" cy="8" r="1.6" fill={`url(#mcrown-gem-${id})`} stroke="#78350F" strokeWidth=".3"/>
      <path d="M17 22 L15 14 L17 10 L19 14 Z" fill={`url(#mcrown-body-${id})`} stroke="#78350F" strokeWidth=".5" strokeLinejoin="round"/>
      <circle cx="17" cy="11" r="1.2" fill={`url(#mcrown-gem-${id})`}/>
      <path d="M61 22 L59 14 L61 10 L63 14 Z" fill={`url(#mcrown-body-${id})`} stroke="#78350F" strokeWidth=".5" strokeLinejoin="round"/>
      <circle cx="61" cy="11" r="1.2" fill={`url(#mcrown-gem-${id})`}/>
      <path d="M19 16 Q22 12 26 14 M28 14 Q33 12 36 12 M42 12 Q45 12 50 14 M54 14 Q58 12 59 16" fill="none" stroke="#FCD34D" strokeWidth="1" strokeLinecap="round"/>
      <circle cx="39" cy="25.5" r="1.5" fill="#FEF9C3" stroke="#78350F" strokeWidth=".3"/>
    </svg>
  )
}

/** Skull icon for Master CTA */
export function SkullIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12v4c0 1.1.9 2 2 2h1v-2c0-.55.45-1 1-1s1 .45 1 1v2h2v-2c0-.55.45-1 1-1s1 .45 1 1v2h2v-2c0-.55.45-1 1-1s1 .45 1 1v2h2v-2c0-.55.45-1 1-1s1 .45 1 1v2h1c1.1 0 2-.9 2-2v-4c0-5.52-4.48-10-10-10zM8.5 14c-.83 0-1.5-.67-1.5-1.5S7.67 11 8.5 11s1.5.67 1.5 1.5S9.33 14 8.5 14zm7 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </svg>
  )
}
