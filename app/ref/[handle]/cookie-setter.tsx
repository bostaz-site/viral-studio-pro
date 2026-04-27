'use client'

import { useEffect } from 'react'

export function RefCookieSetter({ code }: { code: string }) {
  useEffect(() => {
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    document.cookie = `ref=${encodeURIComponent(code)};path=/;expires=${expires.toUTCString()};SameSite=Lax`
    // Also store in localStorage as backup
    try {
      localStorage.setItem('vsp:referral_code', code)
    } catch {
      // localStorage unavailable
    }
  }, [code])

  return null
}
