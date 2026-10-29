// src/components/shared/ProgressionBadge.tsx
// Badge de progression côté ÉLÈVE : reproduit le design « Fiqh » fourni par le client.
// Les illustrations viennent de src/assets/progression/*.png
//   - {item_code}.png        (ex : fiqh-01.png, forqan-13.png)
//   - header-{programme}.png (ex : header-fiqh.png)
import React, { useEffect, useMemo, useState } from 'react'
import {
  useGetProgressionCatalogueQuery,
  useGetProgressionEleveQuery,
} from '../../store/apiSlice'

// ── Images (chargées par Vite au build) ───────────────────────────────────────
const ICONS = import.meta.glob('../../assets/progression/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>
const img = (name: string): string | undefined => ICONS[`../../assets/progression/${name}.png`]

// ── Types ─────────────────────────────────────────────────────────────────────
type Statut = 'en_cours' | 'termine' | undefined
interface Programme {
  code: string
  nom: string
  unite: 'livre' | 'chapitre'
  icon?: string
  items: { code: string; label: string }[]
}

// ── Palette (identique à l'image) ─────────────────────────────────────────────
const C = {
  termine: { ring: '#3fae5a', soft: '#dff3e3', fg: '#2f8f4a' },
  en_cours: { ring: '#f5a623', soft: '#fdecc8', fg: '#c77f0a' },
  none: { ring: '#aeb4bf', soft: '#e9ebf0', fg: '#6b7280' },
}
const col = (s: Statut) => (s === 'termine' ? C.termine : s === 'en_cours' ? C.en_cours : C.none)

// ── Mini icônes SVG (coche / livre ouvert / cadenas) ──────────────────────────
function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
function IconBook({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.5C10.2 5 7.5 4.5 4 4.5v13c3.5 0 6.2.5 8 2 1.8-1.5 4.5-2 8-2v-13c-3.5 0-6.2.5-8 2z" />
      <path d="M12 6.5v13" />
    </svg>
  )
}
function IconLock({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M7 10V8a5 5 0 0 1 10 0v2h.5A1.5 1.5 0 0 1 19 11.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-8A1.5 1.5 0 0 1 6.5 10H7zm2 0h6V8a3 3 0 0 0-6 0v2z" />
    </svg>
  )
}
function StatusGlyph({ s, size }: { s: Statut; size: number }) {
  if (s === 'termine') return <IconCheck size={size} />
  if (s === 'en_cours') return <IconBook size={size} />
  return <IconLock size={size} />
}

const LABEL: Record<'termine' | 'en_cours' | 'none', string> = {
  termine: 'Étudié',
  en_cours: 'En cours',
  none: 'Non commencé',
}

// ── Un livre / chapitre ───────────────────────────────────────────────────────
function Item({
  n, label, code, statut, nextStatut, isLast,
}: {
  n: number
  label: string
  code: string
  statut: Statut
  nextStatut: Statut
  isLast: boolean
}) {
  const c = col(statut)
  const key = (statut ?? 'none') as 'termine' | 'en_cours' | 'none'
  const src = img(code)

  return (
    <div className="relative flex-1 min-w-[104px] flex flex-col items-center px-1">
      {/* ligne de liaison vers l'item suivant (dégradé entre les deux états) */}
      {!isLast && (
        <span
          className="absolute"
          style={{
            top: 71,
            left: '50%',
            width: '100%',
            height: 5,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${c.ring}, ${col(nextStatut).ring})`,
            opacity: 0.9,
            zIndex: 0,
          }}
        />
      )}

      {/* pastille numérotée */}
      <span
        className="relative z-10 flex items-center justify-center font-bold text-white text-[13px] rounded-full"
        style={{
          width: 28, height: 28, marginBottom: 4,
          background: c.ring, border: '2px solid #fff',
          boxShadow: '0 2px 6px rgba(0,0,0,.18)',
        }}
      >
        {n}
      </span>

      {/* médaillon */}
      <div className="relative z-10" style={{ width: 84, height: 84 }}>
        <div
          className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{
            border: `3px solid ${c.ring}`,
            background: '#fff',
            boxShadow: statut ? `0 4px 12px -4px ${c.ring}` : '0 2px 6px rgba(0,0,0,.06)',
          }}
        >
          {src ? (
            <img
              src={src}
              alt={label}
              draggable={false}
              className="w-full h-full object-cover"
              style={{ filter: statut ? undefined : 'grayscale(.45) opacity(.82)' }}
            />
          ) : (
            <span className="text-2xl">📘</span>
          )}
        </div>
        {/* pastille d'état (bas du médaillon) */}
        <span
          className="absolute flex items-center justify-center rounded-full"
          style={{
            width: 26, height: 26, left: '50%', bottom: -8, transform: 'translateX(-50%)',
            background: c.ring, border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,.2)',
          }}
        >
          <StatusGlyph s={statut} size={13} />
        </span>
      </div>

      {/* libellé */}
      <p
        className="relative z-10 text-center font-semibold text-neutral-800 leading-tight"
        style={{ fontSize: 13, marginTop: 18, minHeight: 50, maxWidth: 112 }}
      >
        {label}
      </p>

      {/* pilule d'état */}
      <span
        className="relative z-10 inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap"
        style={{ background: c.soft, color: c.fg, fontSize: 11, padding: '4px 10px', marginTop: 4 }}
      >
        {statut === 'termine' ? (
          <span className="rounded-full flex items-center justify-center" style={{ width: 14, height: 14, background: c.ring }}>
            <IconCheck size={9} />
          </span>
        ) : statut === 'en_cours' ? (
          <IconBook size={12} color={c.fg} />
        ) : (
          <IconLock size={11} color={c.fg} />
        )}
        {LABEL[key]}
      </span>
    </div>
  )
}

// ── Légende ───────────────────────────────────────────────────────────────────
function LegendEntry({ s, title, text }: { s: Statut; title: string; text: React.ReactNode }) {
  const c = col(s)
  return (
    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
      <span
        className="shrink-0 rounded-full flex items-center justify-center"
        style={{ width: 46, height: 46, background: c.soft }}
      >
        <span className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, background: c.ring }}>
          <StatusGlyph s={s} size={16} />
        </span>
      </span>
      <div className="leading-snug">
        <p className="font-bold text-neutral-800 text-[14px]">{title}</p>
        <p className="text-neutral-500 text-[12px]">{text}</p>
      </div>
    </div>
  )
}

// ── Panneau d'un programme ────────────────────────────────────────────────────
function ProgrammePanel({ p, etat }: { p: Programme; etat: Record<string, 'en_cours' | 'termine'> }) {
  const total = p.items.length
  const termine = p.items.filter((i) => etat[i.code] === 'termine').length
  const enCours = p.items.filter((i) => etat[i.code] === 'en_cours').length
  const header = img(`header-${p.code}`)
  const unitePlur = p.unite === 'chapitre' ? 'chapitres' : 'livres'

  return (
    <div
      className="rounded-3xl p-4 sm:p-5 space-y-4"
      style={{
        background: 'linear-gradient(180deg,#fffbf2 0%,#fdf6e6 100%)',
        border: '1px solid #f3e7cb',
        boxShadow: '0 6px 24px -12px rgba(160,120,40,.25)',
      }}
    >
      {/* En-tête : titre + progression globale */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="shrink-0 rounded-2xl overflow-hidden flex items-center justify-center"
            style={{ width: 84, height: 84, background: '#fbf1da', border: '1px solid #f1e2bd', boxShadow: '0 3px 10px -4px rgba(160,120,40,.35)' }}
          >
            {header ? (
              <img src={header} alt={p.nom} draggable={false} className="w-full h-full object-cover" style={{ mixBlendMode: 'multiply' }} />
            ) : (
              <span className="text-4xl">{p.icon ?? '📚'}</span>
            )}
          </div>
          <div>
            <h3 className="leading-none text-neutral-900" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 38, fontWeight: 700 }}>
              {p.nom}
            </h3>
            <p className="text-neutral-600 mt-1.5" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18 }}>
              {total} {unitePlur}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl px-5 py-3 flex items-center gap-5 min-w-[300px] flex-1 sm:flex-none sm:w-[460px]" style={{ boxShadow: '0 4px 16px -8px rgba(0,0,0,.18)' }}>
          <div className="flex-1">
            <p className="font-bold text-neutral-800 text-[14px] mb-2">Progression globale</p>
            <div className="h-3 rounded-full overflow-hidden flex" style={{ background: '#e6e8ec' }}>
              <div style={{ width: `${(100 * termine) / total}%`, background: C.termine.ring, transition: 'width .6s' }} />
              <div style={{ width: `${(100 * enCours) / total}%`, background: C.en_cours.ring, transition: 'width .6s' }} />
            </div>
          </div>
          <div className="text-right leading-tight shrink-0">
            <p className="font-bold text-neutral-800" style={{ fontSize: 22 }}>
              {termine} / {total}
            </p>
            <p className="text-neutral-500 text-[11px]">{unitePlur} complétés</p>
          </div>
        </div>
      </div>

      {/* Frise des livres / chapitres */}
      <div className="overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        <div className="flex min-w-max sm:min-w-0 pt-1 pb-3">
          {p.items.map((it, idx) => (
            <Item
              key={it.code}
              n={idx + 1}
              code={it.code}
              label={it.label}
              statut={etat[it.code]}
              nextStatut={etat[p.items[idx + 1]?.code]}
              isLast={idx === total - 1}
            />
          ))}
        </div>
      </div>

      {/* Légende */}
      <div className="bg-white/80 rounded-2xl px-5 py-4 flex flex-wrap gap-x-8 gap-y-4" style={{ boxShadow: '0 2px 10px -6px rgba(0,0,0,.15)' }}>
        <LegendEntry s="termine" title="Livre étudié" text={<>Le livre est terminé<br />avec le professeur.</>} />
        <LegendEntry s="en_cours" title="Livre en cours" text={<>Le livre est actuellement<br />étudié.</>} />
        <LegendEntry s={undefined} title="Livre non commencé" text={<>L'étude de ce livre<br />n'a pas encore débuté.</>} />
      </div>
    </div>
  )
}

// ── Composant exporté ─────────────────────────────────────────────────────────
// 'me' : le backend force l'élève connecté (voir ProgressionViewSet.list)
export default function ProgressionBadge() {
  const { data: catalogue = [] } = useGetProgressionCatalogueQuery()
  const { data } = useGetProgressionEleveQuery('me')
  const etat: Record<string, Record<string, 'en_cours' | 'termine'>> = data?.etat ?? {}

  // On n'affiche que les programmes déjà démarrés (au moins 1 livre en cours / terminé)
  const demarres = useMemo(
    () => (catalogue as Programme[]).filter((p) => p.items.some((i) => etat[p.code]?.[i.code])),
    [catalogue, etat]
  )

  const [active, setActive] = useState('')
  useEffect(() => {
    if (demarres.length && !demarres.some((p) => p.code === active)) setActive(demarres[0].code)
  }, [demarres, active])

  if (!demarres.length) return null
  const current = demarres.find((p) => p.code === active) ?? demarres[0]

  return (
    <section className="space-y-3">
      {demarres.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {demarres.map((p) => {
            const done = p.items.filter((i) => etat[p.code]?.[i.code] === 'termine').length
            const pct = Math.round((100 * done) / p.items.length)
            const on = p.code === current.code
            const h = img(`header-${p.code}`)
            return (
              <button
                key={p.code}
                onClick={() => setActive(p.code)}
                className="shrink-0 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full text-sm font-semibold transition"
                style={
                  on
                    ? { background: '#fff', color: '#1f2937', border: `2px solid ${C.en_cours.ring}`, boxShadow: '0 3px 10px -5px rgba(245,166,35,.6)' }
                    : { background: '#fffaf0', color: '#6b7280', border: '2px solid #f1e6cc' }
                }
              >
                <span className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-amber-50">
                  {h ? <img src={h} alt="" className="w-full h-full object-cover" style={{ mixBlendMode: 'multiply' }} /> : p.icon}
                </span>
                <span className="whitespace-nowrap">{p.nom}</span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: pct === 100 ? C.termine.soft : '#f3f4f6', color: pct === 100 ? C.termine.fg : '#6b7280' }}>
                  {pct}%
                </span>
              </button>
            )
          })}
        </div>
      )}
      <ProgrammePanel p={current} etat={etat[current.code] ?? {}} />
    </section>
  )
}
