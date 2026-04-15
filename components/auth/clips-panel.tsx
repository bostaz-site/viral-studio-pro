"use client"

import { Scissors } from 'lucide-react'
import { ClipTransformAnimation } from '@/components/shared/clip-transform-animation'

export function AuthClipsPanel() {
  return (
    <div className="relative z-10 flex flex-col justify-center items-center px-8 xl:px-16 w-full h-full">
      {/* Logo */}
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Scissors className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">VIRAL STUDIO</span>
        </div>
        <p className="text-xl font-black text-white leading-tight max-w-xs">
          More viral clips.<br />
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Faster.
          </span>
        </p>
      </div>

      {/* Transformation animation */}
      <ClipTransformAnimation compact />

      {/* No credit card required */}
      <p className="mt-6 text-xs text-blue-200/50">
        No credit card &middot; 3 free clips per month
      </p>
    </div>
  )
}
