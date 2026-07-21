/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useState } from 'react'

/** Live countdown from a starting value, ticks every second */
function useCountdown(initial: number) {
  const [s, setS] = useState(initial)
  useEffect(() => {
    const id = setInterval(() => setS(prev => (prev > 0 ? prev - 1 : 8280)), 1000)
    return () => clearInterval(id)
  }, [])
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function FeaturesGrid() {
  const cd = useCountdown(2 * 3600 + 18 * 60 + 7)

  return (
    <section className="farm-section lv3-divider">
      <div className="lv3-container" style={{ position: 'relative', zIndex: 1 }}>
        <p className="farm-eyebrow">Step 3 — Automation</p>
        <h2 className="farm-h2">The farm runs while you sleep.</h2>
        <p className="farm-sub">Queue your clips. The system picks the optimal time and posts automatically.</p>

        {/* ── Pipeline animation ── */}
        <div className="farm-pipeline">
          {/* CLIP BANK */}
          <div className="farm-bank">
            <div className="farm-banklabel"><span className="farm-bankdot" />CLIP BANK</div>
            <div className="farm-bcard farm-bcard-1">
              <img src="/landing/farm-thumb-1.jpg" alt="" />
              <span className="farm-tag farm-tag-best">{'\u2605'} BEST NEXT</span>
              <span className="farm-score-pill">98</span>
            </div>
            <div className="farm-bcard farm-bcard-2">
              <img src="/landing/farm-thumb-2.jpg" alt="" />
              <span className="farm-tag farm-tag-prio">{'\uD83D\uDD25'} PRIORITY</span>
              <span className="farm-score-pill">95</span>
            </div>
          </div>

          {/* FLOW bank → brain */}
          <div className="farm-flow"><span className="farm-cargo" /></div>

          {/* BRAIN */}
          <div className="farm-brainwrap">
            <svg className="farm-brain" viewBox="0 0 320 320">
              <defs>
                <filter id="farm-bglow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="5" result="blur"/>
                  <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.15  0 0 0 0 0.75  0 0 0 0 1  0 0 0 0.85 0" result="glow"/>
                  <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <linearGradient id="farm-bstroke" x1="60" y1="60" x2="260" y2="260" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#7DD3FC"/><stop offset="50%" stopColor="#38BDF8"/><stop offset="100%" stopColor="#0EA5E9"/>
                </linearGradient>
                <linearGradient id="farm-bfill" x1="160" y1="50" x2="160" y2="270" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.16"/><stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.04"/>
                </linearGradient>
              </defs>
              <g className="farm-outer-ring">
                <circle cx="160" cy="160" r="148" fill="none" stroke="rgba(56,189,248,0.5)" strokeWidth="1" strokeDasharray="2 7" strokeLinecap="round"/>
                <circle cx="160" cy="12" r="2.5" fill="#FB923C" opacity="0.85"/>
              </g>
              <g className="farm-breathe">
                <g transform="translate(0 30)">
                  <path d="M153 48 C132 24 92 30 79 58 C48 63 35 91 47 116 C23 138 35 176 65 184 C68 219 111 235 153 207 Z" fill="url(#farm-bfill)" opacity="0.85"/>
                  <path d="M167 48 C188 24 228 30 241 58 C272 63 285 91 273 116 C297 138 285 176 255 184 C252 219 209 235 167 207 Z" fill="url(#farm-bfill)" opacity="0.85"/>
                  <g filter="url(#farm-bglow)" stroke="url(#farm-bstroke)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                    <path d="M153 48 C132 24 92 30 79 58 C48 63 35 91 47 116 C23 138 35 176 65 184 C68 219 111 235 153 207"/>
                    <path d="M167 48 C188 24 228 30 241 58 C272 63 285 91 273 116 C297 138 285 176 255 184 C252 219 209 235 167 207"/>
                    <path d="M160 45 L160 78" opacity="0.9"/><path d="M160 188 L160 218" opacity="0.9"/>
                  </g>
                  <g stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.75">
                    <path d="M130 61 C108 61 92 72 88 91"/><path d="M137 78 C115 82 104 96 102 112"/>
                    <path d="M58 132 C78 123 101 126 116 140"/><path d="M83 149 C103 144 126 150 138 166"/>
                    <path d="M190 61 C212 61 228 72 232 91"/><path d="M183 78 C205 82 216 96 218 112"/>
                    <path d="M262 132 C242 123 219 126 204 140"/><path d="M237 149 C217 144 194 150 182 166"/>
                  </g>
                  <g fill="#7DD3FC">
                    <circle className="farm-nnode" cx="88" cy="91" r="3"/>
                    <circle className="farm-nnode farm-f1" cx="102" cy="112" r="2.6"/>
                    <circle className="farm-nnode farm-f2" cx="116" cy="140" r="2.6"/>
                    <circle className="farm-nnode farm-f3" cx="138" cy="166" r="2.6"/>
                    <circle className="farm-nnode" cx="232" cy="91" r="3"/>
                    <circle className="farm-nnode farm-f1" cx="218" cy="112" r="2.6"/>
                    <circle className="farm-nnode farm-f2" cx="204" cy="140" r="2.6"/>
                    <circle className="farm-nnode farm-f3" cx="182" cy="166" r="2.6"/>
                  </g>
                </g>
                <g className="farm-wolfg" transform="matrix(0.55 0 0 0.55 119.3 118.925)">
                  <path fill="#020617" stroke="#FFC58A" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" fillRule="evenodd"
                    d="M 16.0 5.0 L 16.0 46.0 L 21.0 63.0 L 27.0 59.0 L 24.0 27.0 L 41.0 53.0 L 35.0 53.0 L 36.0 69.0 L 28.0 63.0 L 8.0 80.0 L 17.0 85.0 L 4.0 103.0 L 14.0 102.0 L 14.0 112.0 L 31.0 111.0 L 28.0 101.0 L 40.0 111.0 L 41.0 106.0 L 50.0 112.0 L 49.0 125.0 L 62.0 149.0 L 63.0 142.0 L 71.0 138.0 L 62.0 126.0 L 64.0 122.0 L 85.0 123.0 L 77.0 137.0 L 84.0 141.0 L 86.0 149.0 L 98.0 127.0 L 96.0 111.0 L 106.0 106.0 L 108.0 110.0 L 119.0 101.0 L 116.0 111.0 L 134.0 112.0 L 132.0 103.0 L 144.0 103.0 L 130.0 85.0 L 139.0 80.0 L 119.0 63.0 L 111.0 69.0 L 113.0 53.0 L 106.0 53.0 L 123.0 27.0 L 120.0 59.0 L 126.0 64.0 L 131.0 44.0 L 130.0 4.0 L 88.0 41.0 L 59.0 41.0 Z M 51.0 137.0 L 56.0 163.0 L 64.0 173.0 L 64.0 172.0 L 66.0 171.0 L 72.0 177.0 L 74.0 178.0 L 76.0 177.0 L 81.0 172.0 L 83.0 173.0 L 89.0 167.0 L 92.0 162.0 L 92.0 159.0 L 93.0 158.0 L 93.0 153.0 L 94.0 152.0 L 94.0 148.0 L 95.0 147.0 L 96.0 138.0 L 94.0 142.0 L 94.0 145.0 L 91.0 150.0 L 90.0 155.0 L 87.0 160.0 L 85.0 159.0 L 83.0 153.0 L 82.0 157.0 L 81.0 158.0 L 81.0 161.0 L 79.0 164.0 L 68.0 164.0 L 67.0 163.0 L 67.0 159.0 L 66.0 158.0 L 65.0 153.0 L 62.0 160.0 L 61.0 160.0 L 59.0 158.0 L 58.0 154.0 L 56.0 151.0 L 55.0 146.0 L 53.0 143.0 L 52.0 138.0 Z M 110.0 82.0 L 110.0 83.0 L 109.0 84.0 L 109.0 86.0 L 108.0 87.0 L 108.0 89.0 L 107.0 90.0 L 107.0 91.0 L 106.0 92.0 L 105.0 95.0 L 103.0 97.0 L 101.0 97.0 L 100.0 98.0 L 95.0 98.0 L 94.0 99.0 L 91.0 100.0 L 91.0 101.0 L 90.0 102.0 L 89.0 102.0 L 87.0 104.0 L 86.0 104.0 L 85.0 103.0 L 85.0 101.0 L 86.0 100.0 L 86.0 96.0 L 89.0 93.0 L 90.0 93.0 L 92.0 91.0 L 93.0 91.0 L 95.0 89.0 L 96.0 89.0 L 98.0 87.0 L 99.0 87.0 L 104.0 83.0 L 105.0 83.0 L 108.0 81.0 L 109.0 81.0 Z M 38.0 82.0 L 39.0 81.0 L 42.0 82.0 L 44.0 84.0 L 45.0 84.0 L 47.0 86.0 L 48.0 86.0 L 50.0 88.0 L 51.0 88.0 L 53.0 90.0 L 54.0 90.0 L 56.0 92.0 L 57.0 92.0 L 59.0 94.0 L 60.0 94.0 L 61.0 95.0 L 61.0 98.0 L 62.0 99.0 L 62.0 103.0 L 61.0 104.0 L 60.0 104.0 L 55.0 99.0 L 52.0 99.0 L 51.0 98.0 L 47.0 98.0 L 46.0 97.0 L 45.0 97.0 L 42.0 94.0 L 42.0 93.0 L 40.0 90.0 L 40.0 88.0 L 38.0 85.0 Z" />
                </g>
              </g>
            </svg>
            <div className="farm-autofarm-pill">
              <span className="farm-autofarm-dot" />
              AUTOFARM ACTIVE
            </div>
          </div>

          {/* SPLITTER: 1 trunk → 4 branches */}
          <svg className="farm-splitter" width="96" height="232" viewBox="0 0 96 232" fill="none">
            <path className="farm-br" d="M0 116 C22 116 26 116 34 116 C58 116 58 28 96 28"/>
            <path className="farm-br" d="M34 116 C58 116 58 87 96 87"/>
            <path className="farm-br" d="M34 116 C58 116 58 145 96 145"/>
            <path className="farm-br" d="M34 116 C58 116 58 204 96 204"/>
            <circle className="farm-sp farm-sp-1" r="3.5" fill="#FBBF24">
              <animateMotion dur="8s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;0.54;0.63;1" calcMode="linear" path="M0 116 C22 116 26 116 34 116 C58 116 58 28 96 28"/>
            </circle>
            <circle className="farm-sp farm-sp-2" r="3.5" fill="#FBBF24">
              <animateMotion dur="8s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;0.555;0.645;1" calcMode="linear" path="M0 116 C22 116 26 116 34 116 C58 116 58 87 96 87"/>
            </circle>
            <circle className="farm-sp farm-sp-3" r="3.5" fill="#FBBF24">
              <animateMotion dur="8s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;0.57;0.66;1" calcMode="linear" path="M0 116 C22 116 26 116 34 116 C58 116 58 145 96 145"/>
            </circle>
            <circle className="farm-sp farm-sp-4" r="3.5" fill="#FBBF24">
              <animateMotion dur="8s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;0.585;0.675;1" calcMode="linear" path="M0 116 C22 116 26 116 34 116 C58 116 58 204 96 204"/>
            </circle>
          </svg>

          {/* APPS */}
          <div className="farm-apps">
            <div className="farm-app farm-app-active">
              <span className="farm-app-ic">{'\u266A'}</span>
              <span>TikTok</span>
              <span className="farm-posted farm-posted-1">PUBLISHED {'\u2713'}</span>
            </div>
            <div className="farm-app farm-app-active farm-app-r2">
              <span className="farm-app-ic">{'\u25B6'}</span>
              <span>YouTube</span>
              <span className="farm-posted farm-posted-2">PUBLISHED {'\u2713'}</span>
            </div>
            <div className="farm-app farm-app-active farm-app-r3">
              <span className="farm-app-ic">{'\u25CE'}</span>
              <span>Instagram</span>
              <span className="farm-posted farm-posted-3">PUBLISHED {'\u2713'}</span>
            </div>
            <div className="farm-app farm-app-active farm-app-r4">
              <span className="farm-app-ic">f</span>
              <span>Facebook</span>
              <span className="farm-posted farm-posted-4">PUBLISHED {'\u2713'}</span>
            </div>
          </div>
        </div>

        {/* NEXT POST panel */}
        <div className="farm-nextpost">
          <span className="farm-nextpost-lbl">NEXT POST &middot; EXAMPLE</span>
          <span className="farm-nextpost-cd">{cd}</span>
          <span className="farm-nextpost-win">Tonight &middot; 7:18 PM &middot; High-activity window</span>
        </div>
        <p className="farm-soon-note">TikTok live today. YouTube, Instagram &amp; Facebook coming soon.</p>
      </div>
    </section>
  )
}
