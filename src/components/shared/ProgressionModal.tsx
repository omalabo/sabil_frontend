// src/components/shared/ProgressionModal.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  useGetProgressionCatalogueQuery,
  useGetProgressionEleveQuery,
  useSaveProgressionEleveMutation,
} from '../../store/apiSlice'

// ── Types ─────────────────────────────────────────────────────────────────────
type Statut = 'en_cours' | 'termine'
interface CatalogItem { code: string; label: string }
interface Programme {
  code: string
  nom: string
  unite: 'livre' | 'chapitre'
  icon?: string
  items: CatalogItem[]
}
// Draft à plat : clé "programme::item" → statut. Clé absente = non commencé.
type Draft = Record<string, Statut>
const k = (p: string, i: string) => `${p}::${i}`

interface Props {
  eleveId: string
  eleveNom?: string
  onClose: () => void
  onSaved?: () => void
}

// ── Couleurs (couvertures de livres) ──────────────────────────────────────────
const COVERS = [
  { from: '#dc2626', to: '#7f1d1d' }, // rouge
  { from: '#16a34a', to: '#14532d' }, // vert
  { from: '#2563eb', to: '#1e3a8a' }, // bleu
  { from: '#b45309', to: '#78350f' }, // brun
  { from: '#9333ea', to: '#581c87' }, // violet
  { from: '#0d9488', to: '#134e4a' }, // turquoise
  { from: '#db2777', to: '#831843' }, // rose
  { from: '#4f46e5', to: '#312e81' }, // indigo
]

const STATE_UI = {
  termine: { ring: '#22c55e', label: 'Étudié', bg: '#dcfce7', fg: '#15803d' },
  en_cours: { ring: '#f59e0b', label: 'En cours', bg: '#fef3c7', fg: '#b45309' },
  none: { ring: '#e5e7eb', label: 'Non commencé', bg: '#f3f4f6', fg: '#6b7280' },
} as const

// ── Carte d'un livre / chapitre ───────────────────────────────────────────────
function ItemCard({
  index, label, unite, statut, onSet,
}: {
  index: number
  label: string
  unite: 'livre' | 'chapitre'
  statut: Statut | undefined
  onSet: (s: Statut | undefined) => void
}) {
  const cover = COVERS[index % COVERS.length]
  const ui = STATE_UI[statut ?? 'none']
  const idle = !statut

  // clic sur la couverture : non commencé → en cours → étudié → non commencé
  function cycle() {
    onSet(!statut ? 'en_cours' : statut === 'en_cours' ? 'termine' : undefined)
  }

  return (
    <div
      className="group bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{
        border: `2px solid ${ui.ring}`,
        boxShadow: statut ? `0 6px 18px -8px ${ui.ring}` : undefined,
      }}
    >
      {/* Couverture */}
      <button
        type="button"
        onClick={cycle}
        title="Cliquer pour changer le statut"
        className="relative block w-full h-28 overflow-hidden text-left"
        style={{
          background: `linear-gradient(135deg, ${cover.from}, ${cover.to})`,
          filter: idle ? 'grayscale(0.65) opacity(0.85)' : undefined,
          transition: 'filter .2s',
        }}
      >
        {/* décor */}
        <span className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
        <span className="absolute -left-4 -bottom-8 w-24 h-24 rounded-full bg-white/10" />
        <span className="absolute inset-y-0 left-3 w-1.5 bg-black/20" />
        <span className="absolute inset-2 rounded-xl border border-white/25" />

        {/* numéro */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center font-bold text-lg shadow-lg"
            style={{ color: cover.to }}
          >
            {index + 1}
          </span>
        </span>

        {/* pastille statut */}
        <span
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow"
          style={{ background: statut ? ui.ring : '#9ca3af', color: '#fff' }}
        >
          {statut === 'termine' ? '✓' : statut === 'en_cours' ? '📖' : '🔒'}
        </span>
        {statut === 'en_cours' && (
          <span className="absolute top-2 right-2 w-7 h-7 rounded-full animate-ping bg-amber-400/50" />
        )}
      </button>

      {/* Titre + contrôle */}
      <div className="p-3 space-y-2.5">
        <p className="text-[13px] font-semibold text-neutral-800 leading-snug min-h-[2.5rem] line-clamp-3">
          {label}
        </p>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSet(undefined)}
            title={`${unite === 'chapitre' ? 'Chapitre' : 'Livre'} non commencé`}
            className="px-2 py-1.5 rounded-lg text-xs transition"
            style={{
              background: idle ? '#e5e7eb' : '#f9fafb',
              color: idle ? '#374151' : '#9ca3af',
              fontWeight: idle ? 700 : 500,
            }}
          >
            🔒
          </button>
          <button
            type="button"
            onClick={() => onSet('en_cours')}
            className="flex-1 py-1.5 rounded-lg text-[11px] transition"
            style={{
              background: statut === 'en_cours' ? STATE_UI.en_cours.bg : '#f9fafb',
              color: statut === 'en_cours' ? STATE_UI.en_cours.fg : '#9ca3af',
              fontWeight: statut === 'en_cours' ? 700 : 500,
              outline: statut === 'en_cours' ? `1.5px solid ${STATE_UI.en_cours.ring}` : undefined,
            }}
          >
            En cours
          </button>
          <button
            type="button"
            onClick={() => onSet('termine')}
            className="flex-1 py-1.5 rounded-lg text-[11px] transition"
            style={{
              background: statut === 'termine' ? STATE_UI.termine.bg : '#f9fafb',
              color: statut === 'termine' ? STATE_UI.termine.fg : '#9ca3af',
              fontWeight: statut === 'termine' ? 700 : 500,
              outline: statut === 'termine' ? `1.5px solid ${STATE_UI.termine.ring}` : undefined,
            }}
          >
            ✓ Étudié
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function ProgressionModal({ eleveId, eleveNom, onClose, onSaved }: Props) {
  const { data: catalogue = [], isLoading: loadingCat } = useGetProgressionCatalogueQuery()
  const { data: serverData, isLoading: loadingState } = useGetProgressionEleveQuery(eleveId, {
    refetchOnMountOrArgChange: true,
  })
  const [save, { isLoading: saving }] = useSaveProgressionEleveMutation()

  const programmes = catalogue as Programme[]
  const [activeCode, setActiveCode] = useState<string>('')
  const [draft, setDraft] = useState<Draft>({})
  const [error, setError] = useState('')

  // État serveur aplati (référence pour calculer les changements)
  const serverFlat = useMemo<Draft>(() => {
    const flat: Draft = {}
    const etat = serverData?.etat ?? {}
    Object.keys(etat).forEach((p) =>
      Object.keys(etat[p]).forEach((i) => (flat[k(p, i)] = etat[p][i]))
    )
    return flat
  }, [serverData])

  useEffect(() => { setDraft(serverFlat) }, [serverFlat])
  useEffect(() => {
    if (!activeCode && programmes.length) setActiveCode(programmes[0].code)
  }, [programmes, activeCode])

  const active = programmes.find((p) => p.code === activeCode)

  // Changements non enregistrés
  const changes = useMemo(() => {
    const out: { programme_code: string; item_code: string; statut: Statut | null }[] = []
    programmes.forEach((p) =>
      p.items.forEach((it) => {
        const key = k(p.code, it.code)
        const cur = draft[key] ?? null
        const base = serverFlat[key] ?? null
        if (cur !== base) out.push({ programme_code: p.code, item_code: it.code, statut: cur })
      })
    )
    return out
  }, [draft, serverFlat, programmes])

  function stats(p: Programme) {
    let termine = 0, enCours = 0
    p.items.forEach((it) => {
      const s = draft[k(p.code, it.code)]
      if (s === 'termine') termine++
      else if (s === 'en_cours') enCours++
    })
    const total = p.items.length
    return { termine, enCours, total, pct: total ? Math.round((100 * termine) / total) : 0 }
  }

  function setItem(p: string, i: string, s: Statut | undefined) {
    setDraft((prev) => {
      const next = { ...prev }
      if (s) next[k(p, i)] = s
      else delete next[k(p, i)]
      return next
    })
  }

  function setAll(p: Programme, s: Statut | undefined) {
    setDraft((prev) => {
      const next = { ...prev }
      p.items.forEach((it) => {
        if (s) next[k(p.code, it.code)] = s
        else delete next[k(p.code, it.code)]
      })
      return next
    })
  }

  function handleClose() {
    if (changes.length && !window.confirm('Des modifications ne sont pas enregistrées. Fermer quand même ?')) return
    onClose()
  }

  async function handleSave() {
    setError('')
    try {
      await save({ eleve_id: eleveId, changes }).unwrap()
      onSaved?.()
      onClose()
    } catch (e: any) {
      setError(e?.data?.detail || "Erreur lors de l'enregistrement de la progression")
    }
  }

  const st = active ? stats(active) : null
  const unitePluriel = active?.unite === 'chapitre' ? 'chapitres' : 'livres'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3" onClick={handleClose}>
      <div
        className="bg-gradient-to-b from-amber-50/60 to-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-5 pt-4 pb-3 border-b border-amber-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">📈 Progression</h2>
            {eleveNom && <p className="text-sm text-neutral-500">{eleveNom}</p>}
          </div>
          <button onClick={handleClose} className="text-neutral-400 hover:text-neutral-700 text-xl">✕</button>
        </div>

        {/* Programmes (filtre horizontal) */}
        <div
          className="flex gap-2 px-5 py-3 overflow-x-auto border-b border-amber-100 bg-white/70"
          style={{ scrollbarWidth: 'none' }}
        >
          {programmes.map((p, idx) => {
            const s = stats(p)
            const isActive = p.code === activeCode
            const color = COVERS[idx % COVERS.length]
            return (
              <button
                key={p.code}
                onClick={() => setActiveCode(p.code)}
                className="shrink-0 flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-full text-sm font-semibold transition border-2"
                style={
                  isActive
                    ? { background: `linear-gradient(135deg, ${color.from}, ${color.to})`, color: '#fff', borderColor: 'transparent' }
                    : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }
                }
              >
                <span>{p.icon}</span>
                <span className="whitespace-nowrap">{p.nom}</span>
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded-full font-bold"
                  style={
                    isActive
                      ? { background: 'rgba(255,255,255,.25)', color: '#fff' }
                      : { background: s.pct === 100 ? '#dcfce7' : '#f3f4f6', color: s.pct === 100 ? '#15803d' : '#6b7280' }
                  }
                >
                  {s.pct}%
                </span>
              </button>
            )
          })}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loadingCat || loadingState ? (
            <div className="text-center py-16 text-neutral-500">⏳ Chargement…</div>
          ) : active && st ? (
            <>
              {/* Résumé du programme */}
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900">
                      {active.icon} {active.nom}
                    </h3>
                    <p className="text-sm text-neutral-500">
                      {st.total} {unitePluriel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-extrabold text-emerald-600 leading-none">{st.pct}%</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {st.termine} / {st.total} {unitePluriel} terminés
                    </p>
                  </div>
                </div>

                {/* Barre : vert = étudié, orange = en cours */}
                <div className="h-3 rounded-full bg-neutral-200 overflow-hidden flex">
                  <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(100 * st.termine) / st.total}%` }} />
                  <div className="bg-amber-400 transition-all duration-500" style={{ width: `${(100 * st.enCours) / st.total}%` }} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                  <div className="flex gap-3 text-xs text-neutral-500">
                    <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" />Étudié ({st.termine})</span>
                    <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-1" />En cours ({st.enCours})</span>
                    <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-neutral-300 mr-1" />Non commencé ({st.total - st.termine - st.enCours})</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAll(active, 'termine')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    >
                      ✓ Tout marquer étudié
                    </button>
                    <button
                      onClick={() => setAll(active, undefined)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    >
                      Tout réinitialiser
                    </button>
                  </div>
                </div>
              </div>

              {/* Cartes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {active.items.map((it, idx) => (
                  <ItemCard
                    key={it.code}
                    index={idx}
                    label={it.label}
                    unite={active.unite}
                    statut={draft[k(active.code, it.code)]}
                    onSet={(s) => setItem(active.code, it.code, s)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-neutral-500 py-12">Aucun programme disponible.</p>
          )}
        </div>

        {/* Pied */}
        <div className="px-5 py-3 border-t border-amber-100 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            {error ? (
              <span className="text-red-600">⚠️ {error}</span>
            ) : changes.length ? (
              <span className="text-amber-700 font-medium">● {changes.length} modification(s) non enregistrée(s)</span>
            ) : (
              <span className="text-neutral-400">Aucune modification</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-semibold rounded-lg"
            >
              Fermer
            </button>
            <button
              onClick={handleSave}
              disabled={saving || changes.length === 0}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg"
            >
              {saving ? '⏳ Enregistrement…' : '💾 Enregistrer la progression'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
