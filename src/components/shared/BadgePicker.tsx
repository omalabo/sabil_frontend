// src/components/shared/BadgePicker.tsx
// Champ « Badge (optionnel) » : aperçu du badge choisi + modal de sélection.
import React, { useState } from 'react'
import { BADGES, badgeInfo } from './badges'

interface Props {
  value: string                       // code du badge ('' = aucun)
  onChange: (code: string) => void
  label?: string
}

export default function BadgePicker({ value, onChange, label = 'Badge (optionnel)' }: Props) {
  const [open, setOpen] = useState(false)
  const current = badgeInfo(value)

  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>

      {current ? (
        <div className="flex items-center gap-3 p-2.5 rounded-xl border border-amber-200 bg-amber-50/60">
          {current.src ? (
            <img src={current.src} alt={current.label} className="h-16 w-auto drop-shadow" draggable={false} />
          ) : (
            <span className="text-3xl">🏅</span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-800 truncate">{current.label}</p>
            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-violet-600 hover:underline">
                Changer
              </button>
              <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-red-500 hover:underline">
                Retirer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full px-3 py-2.5 text-sm font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border-2 border-dashed border-amber-300 rounded-xl transition"
        >
          🏅 Attribuer un badge à l'élève
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-3"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-gradient-to-b from-amber-50 to-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-amber-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">🏅 Choisir un badge</h3>
                <p className="text-xs text-neutral-500">Récompense l'élève pour son comportement ou son travail.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700 text-xl">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {BADGES.map((b) => {
                  const info = badgeInfo(b.code)!
                  const selected = value === b.code
                  return (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => { onChange(b.code); setOpen(false) }}
                      title={b.label}
                      className="relative rounded-2xl p-2 transition hover:-translate-y-1 hover:shadow-lg bg-white"
                      style={{
                        border: selected ? '3px solid #7c3aed' : '2px solid #f3e8cf',
                        boxShadow: selected ? '0 6px 18px -6px rgba(124,58,237,.55)' : undefined,
                      }}
                    >
                      {info.src ? (
                        <img src={info.src} alt={b.label} className="w-full h-auto" draggable={false} />
                      ) : (
                        <span className="text-4xl">🏅</span>
                      )}
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center shadow">
                          ✓
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-amber-100 bg-white flex justify-between gap-3">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg"
              >
                Aucun badge
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
