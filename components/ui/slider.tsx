"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const inputValue = value?.[0] ?? 0
    const pct = max === min ? 0 : ((inputValue - min) / (max - min)) * 100

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value)
      onValueChange?.([newValue])
    }

    return (
      <div className={cn("relative w-full h-5 flex items-center", className)}>
        {/* Rail */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 pointer-events-none" />
        {/* Filled range */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 pointer-events-none"
          style={{ width: `${pct}%` }}
        />
        {/* Native input */}
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={inputValue}
          onChange={handleChange}
          className={cn(
            "relative w-full h-1.5 appearance-none bg-transparent cursor-pointer z-10",
            "[&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1.5",
            "[&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:border-0",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-950/40 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(245,158,11,0.4)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform",
            "hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-110",
            "focus-visible:[&::-webkit-slider-thumb]:outline focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-amber-400/50 focus-visible:[&::-webkit-slider-thumb]:outline-offset-2",
            "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-amber-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-amber-950/40 [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(245,158,11,0.4)] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-transform",
            "hover:[&::-moz-range-thumb]:scale-110 active:[&::-moz-range-thumb]:scale-110",
            "focus-visible:[&::-moz-range-thumb]:outline focus-visible:[&::-moz-range-thumb]:outline-2 focus-visible:[&::-moz-range-thumb]:outline-amber-400/50 focus-visible:[&::-moz-range-thumb]:outline-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          {...props}
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
