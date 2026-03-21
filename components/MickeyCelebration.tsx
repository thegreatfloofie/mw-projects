'use client'

import { useEffect, useRef } from 'react'

interface Props { active: boolean }

export default function MickeyCelebration({ active }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !ref.current) return
    const cel = ref.current
    cel.querySelectorAll('.fw-particle').forEach(p => p.remove())
    const COLORS = ['#CEFF58','#EEFF25','#FF5E30','#0038FF','#B4C6BB','#ffffff','#FF9EAA','#00C9FF']
    const origins = [[12,15],[88,15],[8,55],[92,55],[50,7],[28,82],[72,82],[50,50],[20,40],[80,40]]
    origins.forEach((o, oi) => {
      const count = oi === 8 ? 16 : 10
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div')
        p.className = 'fw-particle'
        const angle = (i / count) * Math.PI * 2
        const dist = 50 + Math.random() * 65
        const fx = (Math.cos(angle) * dist).toFixed(1) + 'px'
        const fy = (Math.sin(angle) * dist).toFixed(1) + 'px'
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]
        const size = 5 + Math.random() * 7
        const delay = oi * 0.04 + Math.random() * 0.12
        const dur = 1.0 + Math.random() * 0.8
        Object.assign(p.style, {
          left: o[0] + '%', top: o[1] + '%',
          width: size + 'px', height: size + 'px',
          background: color,
          '--fx': fx, '--fy': fy,
          animation: `fwShoot ${dur}s ease-out ${delay}s forwards`,
        } as any)
        cel.appendChild(p)
      }
    })
  }, [active])

  if (!active) return null

  return (
    <div ref={ref} className="mw-celebration">
      <div className="mickey-popup">
        <div className="mickey-card">
          <svg width="112" height="100" viewBox="0 0 112 100">
            <circle cx="30" cy="32" r="25" fill="#0C0C0C"/>
            <circle cx="82" cy="32" r="25" fill="#0C0C0C"/>
            <circle cx="56" cy="65" r="35" fill="#0C0C0C"/>
            <ellipse cx="56" cy="68" rx="25" ry="22" fill="#F5C5A3"/>
            <ellipse cx="47" cy="62" rx="4.5" ry="5.5" fill="white"/>
            <ellipse cx="65" cy="62" rx="4.5" ry="5.5" fill="white"/>
            <circle cx="47" cy="63" r="2.5" fill="#0C0C0C"/>
            <circle cx="65" cy="63" r="2.5" fill="#0C0C0C"/>
            <ellipse cx="56" cy="72" rx="4" ry="3" fill="#C17A5A"/>
            <path d="M44 78 Q56 86 68 78" stroke="#0C0C0C" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <circle cx="44" cy="70" r="6" fill="#F0A0A0" opacity="0.5"/>
            <circle cx="68" cy="70" r="6" fill="#F0A0A0" opacity="0.5"/>
          </svg>
          <div className="mickey-label">🎉 Complete!</div>
        </div>
      </div>
    </div>
  )
}
