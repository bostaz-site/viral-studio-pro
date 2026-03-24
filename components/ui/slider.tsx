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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value)
      onValueChange?.([newValue])
    }

    return (
      <div className="w-full flex items-center">
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={inputValue}
          onChange={handleChange}
          className={cn(
            "w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary",
            // Custom styling for better appearance
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary/50 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow",
            "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary/50 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow",
            "[&::-webkit-slider-thumb]:focus-visible:outline-none [&::-webkit-slider-thumb]:focus-visible:ring-1 [&::-webkit-slider-thumb]:focus-visible:ring-ring",
            "[&::-moz-range-thumb]:focus-visible:outline-none [&::-moz-range-thumb]:focus-visible:ring-1 [&::-moz-range-thumb]:focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
