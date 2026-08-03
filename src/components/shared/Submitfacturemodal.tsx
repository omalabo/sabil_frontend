import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  useLazyGetFactureDetailSeancesQuery,
  useSubmitFactureMutation,
} from '../../store/apiSlice'
import {
  Facture,
  EleveInscrit,
  SeanceDetail,
  SubmitMethode,
  MontantManuel,
} from '../../types'

// ── Helpers ──────────────────────────────────────────────────
function fmtDate(iso: string) {
  return format(new Date(iso), 'dd/MM/yyyy', { locale: fr })
}
function fmtDuree(h: string) {
  const heures = parseFloat(h)
  const hh = Math.floor(heures)
  const mm = Math.round((heures - hh) * 60)
  return `${hh}h${mm > 0 ? mm.toString().padStart(2, '0') : '00'}`
}

// montantsGrid[presence_id][eleve_id] = valeur affichée dans l'input
type MontantsGrid = Record<string, Record<string, string>>

interface Props {
  facture: Facture
  onClose: () => void
  onSuccess: () => void
}

const METHODES = [
  {
    id: 'inscrits' as SubmitMethode,
    label: 'Par inscrits',
    desc: 'Montant total ÷ nb élèves inscrits',
    icon: '👥',
    active:   'bg-blue-600 text-white border-blue-600 shadow-md',
    inactive: 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50',
    badge:    'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'participants' as SubmitMethode,
    label: 'Par participants',
    desc: 'Montant total ÷ nb participants — non-participants = 0 €',
    icon: '✅',
    active:   'bg-emerald-600 text-white border-emerald-600 shadow-md',
    inactive: 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50',
    badge:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'manuel' as SubmitMethode,
    label: 'Manuel',
    desc: 'Saisir librement le montant de chaque élève',
    icon: '✏️',
    active:   'bg-amber-500 text-white border-amber-500 shadow-md',
    inactive: 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50',
    badge:    'bg-amber-50 text-amber-700 border-amber-200',
  },
]

// ─────────────────────────────────────────────────────────────
export default function SubmitFactureModal({ facture, onClose, onSuccess }: Props) {

  const [triggerDetail, { data: detail, isLoading: detailLoading, isError: detailError }] =
    useLazyGetFactureDetailSeancesQuery()
  const [submitFacture, { isLoading: submitting }] = useSubmitFactureMutation()

  const [methode, setMethode] = useState<SubmitMethode | null>(null)
  const [grid, setGrid]       = useState<MontantsGrid>({})
  const [erreur, setErreur]   = useState<string | null>(null)

  // Charger le détail dès l'ouverture
  useEffect(() => { triggerDetail(facture.id) }, [facture.id])

  const montantTotal = parseFloat(facture.montant_total as string) || 0

  // ── Recalcul automatique quand la méthode change ──────────
  useEffect(() => {
    if (!detail || !methode) return
    setErreur(null)
    const newGrid: MontantsGrid = {}
    const { eleves_inscrits, seances, nb_inscrits, nb_participants_global } = detail

    seances.forEach((seance) => {
      newGrid[seance.presence_id] = {}
      eleves_inscrits.forEach((eleve) => {
        const isParticipant = seance.participants_ids.includes(eleve.eleve_id)

        if (methode === 'inscrits') {
          const part = nb_inscrits > 0 ? (montantTotal / nb_inscrits).toFixed(2) : '0.00'
          newGrid[seance.presence_id][eleve.eleve_id] = part

        } else if (methode === 'participants') {
          if (isParticipant) {
            const part = nb_participants_global > 0
              ? (montantTotal / nb_participants_global).toFixed(2)
              : '0.00'
            newGrid[seance.presence_id][eleve.eleve_id] = part
          } else {
            newGrid[seance.presence_id][eleve.eleve_id] = '0.00'
          }

        } else {
          // manuel : conserver valeur existante ou vider
          newGrid[seance.presence_id][eleve.eleve_id] =
            grid[seance.presence_id]?.[eleve.eleve_id] ?? ''
        }
      })
    })
    setGrid(newGrid)
  }, [methode, detail])


  useEffect(() => {
    if (
      detail &&
      methode === 'inscrits' &&
      detail.nb_inscrits === detail.nb_participants_global
    ) {
      setMethode('participants')
    }
  }, [detail, methode])

  // ── Total saisi mode manuel (référence : première séance) ─
  const totalSaisi = useMemo(() => {
    if (!detail || !detail.seances[0]) return 0
    const ref = detail.seances[0].presence_id
    return Object.values(grid[ref] ?? {}).reduce((acc, v) => acc + (parseFloat(v) || 0), 0)
  }, [grid, detail])

  const tousRemplis = useMemo(() => {
    if (!detail || methode !== 'manuel') return true
    const ref = detail.seances[0]?.presence_id
    if (!ref) return false
    return detail.eleves_inscrits.every((e) => {
      const v = grid[ref]?.[e.eleve_id]
      return v !== '' && v != null
    })
  }, [grid, detail, methode])

  // ── Changement d'un input (mode manuel) ──────────────────
  // En mode manuel, quand on change sur une ligne/séance,
  // on propage la valeur sur toutes les séances pour cet élève
  // (1 montant global par élève, pas par séance)
  const handleInputChange = (eleveId: string, value: string) => {
    if (value !== '' && !/^\d*\.?\d{0,2}$/.test(value)) return
    if (!detail) return
    setGrid(prev => {
      const next = { ...prev }
      detail.seances.forEach((seance) => {
        next[seance.presence_id] = {
          ...next[seance.presence_id],
          [eleveId]: value,
        }
      })
      return next
    })
  }

  // ── Soumission ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!methode || !detail) { setErreur('Choisissez une méthode.'); return }
    setErreur(null)

    const payload: any = { facture_id: facture.id, methode }

    if (methode === 'manuel') {
      if (!tousRemplis) {
        setErreur('Renseignez tous les montants avant de soumettre (0 si gratuit).')
        return
      }
      const ref = detail.seances[0].presence_id
      payload.montants = detail.eleves_inscrits.map((eleve) => ({
        eleve_id: eleve.eleve_id,
        montant_a_payer: parseFloat(grid[ref]?.[eleve.eleve_id] ?? '0') || 0,
      }))
    }

    try {
      await submitFacture(payload).unwrap()
      onSuccess()
    } catch (err: any) {
      setErreur(err?.data?.error ?? 'Erreur lors de la soumission.')
    }
  }

  // ESC
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-8 flex flex-col overflow-hidden">

        {/* ══ EN-TÊTE ══════════════════════════════════════════ */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 text-white flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Soumettre la facture
              </p>
              <h2 className="text-xl font-bold">{facture.classe_nom}</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-slate-300">
                <span>📅 {fmtDate(facture.date_debut)} → {fmtDate(facture.date_fin)}</span>
                <span>💰 <strong className="text-white">{montantTotal.toFixed(2)} €</strong> total</span>
                {detail && (
                  <>
                    <span>👥 {detail.nb_inscrits} inscrit(s)</span>
                    <span>✅ {detail.nb_participants_global} participant(s) distinct(s)</span>
                    <span>📋 {detail.seances.length} séance(s)</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* ══ BARRE MÉTHODES ═══════════════════════════════════ */}
        <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-4 flex-shrink-0">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Méthode de répartition
          </p>
          <div className="flex flex-wrap gap-3">
            {METHODES
              .filter((m) => {
                if (
                  m.id === 'inscrits' &&
                  detail &&
                  detail.nb_inscrits === detail.nb_participants_global
                ) {
                  return false
                }
                return true
              }).map((m) => (
              <button
                key={m.id}
                onClick={() => setMethode(m.id)}
                disabled={detailLoading || !detail}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                  methode === m.id ? m.active : m.inactive
                }`}
              >
                <span className="text-lg mt-0.5">{m.icon}</span>
                <div>
                  <p className="font-semibold text-sm leading-tight">{m.label}</p>
                  <p className={`text-xs mt-0.5 leading-tight ${methode === m.id ? 'opacity-80' : 'opacity-60'}`}>
                    {m.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Info calcul */}
          {methode && detail && (
            <div className="mt-3">
              {methode === 'inscrits' && (
                <p className="inline-flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                  💡 {montantTotal.toFixed(2)} € ÷ {detail.nb_inscrits} inscrits
                  {' '}= <strong>{(montantTotal / (detail.nb_inscrits || 1)).toFixed(2)} € / élève</strong>
                </p>
              )}
              {methode === 'participants' && (
                <p className="inline-flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                  💡 {montantTotal.toFixed(2)} € ÷ {detail.nb_participants_global} participants
                  {' '}= <strong>{(montantTotal / (detail.nb_participants_global || 1)).toFixed(2)} € / participant</strong>
                </p>
              )}
              {methode === 'manuel' && (
                <p className={`inline-flex items-center gap-2 text-sm border rounded-lg px-3 py-1.5 ${
                  Math.abs(totalSaisi - montantTotal) < 0.01
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}>
                  Total saisi : <strong>{totalSaisi.toFixed(2)} €</strong>
                  {' '}/ {montantTotal.toFixed(2)} € attendu
                  {Math.abs(totalSaisi - montantTotal) < 0.01 && ' ✅'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ══ DATATABLE ════════════════════════════════════════ */}
        <div className="flex-1 overflow-auto p-6">

          {/* Chargement */}
          {detailLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-3">
              <span className="text-4xl animate-spin">⏳</span>
              <p className="text-sm">Chargement des séances et des élèves…</p>
            </div>
          )}

          {/* Erreur */}
          {detailError && (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-6 py-4">
                ⚠️ Impossible de charger les données. Fermez et réessayez.
              </p>
            </div>
          )}

          {/* Placeholder avant choix méthode */}
          {!detailLoading && !detailError && detail && !methode && (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-2">
              <p className="text-4xl">☝️</p>
              <p className="text-sm font-medium">Sélectionnez une méthode ci-dessus</p>
              <p className="text-xs">Le tableau se remplira automatiquement</p>
            </div>
          )}

          {/* ── Tableau principal ── */}
          {!detailLoading && !detailError && detail && methode && (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {/* Colonnes fixes */}
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap sticky left-0 bg-slate-800 z-20 min-w-[110px]">
                      Date
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[75px]">
                      Connexion
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[85px]">
                      Déconnexion
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[65px]">
                      Durée
                    </th>
                    {/* Colonnes élèves */}
                    {detail.eleves_inscrits.map((eleve) => (
                      <th
                        key={eleve.eleve_id}
                        className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider min-w-[110px]"
                        title={eleve.eleve_email}
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {eleve.eleve_nom.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <span className="block leading-tight text-center max-w-[100px] truncate">
                            {eleve.eleve_nom.split(' ')[0]}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-neutral-100">
                  {detail.seances.map((seance: SeanceDetail, idx: number) => (
                    <tr
                      key={seance.presence_id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'} hover:bg-blue-50/20 transition-colors`}
                    >
                      {/* Date */}
                      <td className="px-4 py-3 font-medium text-neutral-800 whitespace-nowrap sticky left-0 bg-inherit z-10">
                        {fmtDate(seance.date_seance)}
                      </td>
                      {/* Connexion */}
                      <td className="px-3 py-3 text-neutral-600 whitespace-nowrap">
                        {seance.heure_connexion ?? <span className="text-neutral-300">—</span>}
                      </td>
                      {/* Déconnexion */}
                      <td className="px-3 py-3 text-neutral-600 whitespace-nowrap">
                        {seance.heure_deconnexion ?? <span className="text-neutral-300">—</span>}
                      </td>
                      {/* Durée */}
                      <td className="px-3 py-3 text-right font-mono text-neutral-700 whitespace-nowrap">
                        {fmtDuree(seance.duree_heures)}
                      </td>

                      {/* Inputs par élève */}
                      {detail.eleves_inscrits.map((eleve: EleveInscrit) => {
                        const isParticipant = seance.participants_ids.includes(eleve.eleve_id)
                        // En mode manuel, on affiche la valeur propagée (identique sur toutes les lignes)
                        const ref = detail.seances[0].presence_id
                        const value = methode === 'manuel'
                          ? (grid[ref]?.[eleve.eleve_id] ?? '')
                          : (grid[seance.presence_id]?.[eleve.eleve_id] ?? '')
                        const isZero = parseFloat(value) === 0 || value === ''
                        const isEditable = methode === 'manuel'

                        return (
                          <td key={eleve.eleve_id} className="px-2 py-2 text-center">
                            <div className="flex flex-col items-center gap-1">

                              {/* Badge présence (méthode participants) */}
                              {methode === 'participants' && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-tight ${
                                  isParticipant
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-neutral-100 text-neutral-400'
                                }`}>
                                  {isParticipant ? '✓ présent' : 'absent'}
                                </span>
                              )}

                              {/* Input */}
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400 pointer-events-none select-none">
                                  €
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={value}
                                  readOnly={!isEditable}
                                  placeholder={isEditable ? '0.00' : ''}
                                  onChange={(e) => handleInputChange(eleve.eleve_id, e.target.value)}
                                  className={`w-24 pl-5 pr-2 py-1.5 text-right text-sm rounded-lg border transition-all duration-100
                                    ${!isEditable
                                      ? isZero
                                        ? 'bg-neutral-50 border-neutral-200 text-neutral-300 cursor-default select-none'
                                        : 'bg-slate-50 border-slate-200 text-slate-800 font-semibold cursor-default select-none'
                                      : value !== ''
                                        ? 'bg-amber-50 border-amber-300 text-amber-900 focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-text'
                                        : 'bg-white border-neutral-300 text-neutral-700 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:outline-none cursor-text'
                                    }`}
                                />
                              </div>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                  {/* ── Ligne récapitulatif par élève ── */}
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td
                      colSpan={4}
                      className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-100 whitespace-nowrap"
                    >
                      Montant / élève
                    </td>
                    {detail.eleves_inscrits.map((eleve: EleveInscrit) => {
                      const ref = detail.seances[0]?.presence_id
                      const montantEleve = ref
                        ? parseFloat(grid[ref]?.[eleve.eleve_id] ?? '0') || 0
                        : 0
                      return (
                        <td key={eleve.eleve_id} className="px-2 py-3 text-center">
                          <span className={`text-sm font-bold ${
                            montantEleve > 0 ? 'text-slate-800' : 'text-slate-300'
                          }`}>
                            {montantEleve.toFixed(2)} €
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ══ PIED ═════════════════════════════════════════════ */}
        <div className="border-t border-neutral-200 bg-neutral-50 px-6 py-4 flex-shrink-0">
          {erreur && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              ⚠️ {erreur}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-neutral-500">
              {!methode && 'Sélectionnez une méthode pour continuer.'}
              {methode === 'inscrits' && '✅ Répartition automatique — vérifiez et soumettez.'}
              {methode === 'participants' && '✅ Répartition automatique — les absents sont à 0 €.'}
              {methode === 'manuel' && (
                tousRemplis
                  ? '✅ Tous les montants sont renseignés.'
                  : '⚠️ Renseignez tous les montants (0 si gratuit) avant de soumettre.'
              )}
            </p>
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-neutral-600 border border-neutral-300 bg-white rounded-xl hover:bg-neutral-100 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  !methode ||
                  submitting ||
                  detailLoading ||
                  !detail ||
                  (methode === 'manuel' && !tousRemplis)
                }
                className="px-6 py-2 text-sm font-semibold bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {submitting
                  ? <><span className="animate-spin inline-block">⏳</span> Soumission…</>
                  : <>📤 Soumettre la facture</>
                }
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}