'use client'

import { useRef, useCallback } from 'react'
import { useMotionValue, useSpring } from 'framer-motion'

interface UseTiltOptions {
  rotateAmplitude?: number
  scaleOnHover?: number
  springConfig?: { damping: number; stiffness: number; mass: number }
}

export function useTilt(options: UseTiltOptions = {}) {
  const {
    rotateAmplitude = 8,
    scaleOnHover = 1.0,
    springConfig = { damping: 30, stiffness: 100, mass: 2 },
  } = options

  const ref = useRef<HTMLElement>(null)

  const rawRotateX = useMotionValue(0)
  const rawRotateY = useMotionValue(0)
  const rawScale = useMotionValue(1)

  const rotateX = useSpring(rawRotateX, springConfig)
  const rotateY = useSpring(rawRotateY, springConfig)
  const scale = useSpring(rawScale, springConfig)

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const offsetX = (e.clientX - cx) / (rect.width / 2)
    const offsetY = (e.clientY - cy) / (rect.height / 2)
    rawRotateX.set(-offsetY * rotateAmplitude)
    rawRotateY.set(offsetX * rotateAmplitude)
  }, [rotateAmplitude, rawRotateX, rawRotateY])

  const onMouseEnter = useCallback(() => {
    rawScale.set(scaleOnHover)
  }, [scaleOnHover, rawScale])

  const onMouseLeave = useCallback(() => {
    rawRotateX.set(0)
    rawRotateY.set(0)
    rawScale.set(1)
  }, [rawRotateX, rawRotateY, rawScale])

  return {
    ref,
    style: { rotateX, rotateY, scale },
    handlers: { onMouseMove, onMouseEnter, onMouseLeave },
  }
}
