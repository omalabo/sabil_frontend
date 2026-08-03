import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  useGetClassDevoirsQuery,
  useCorrigerDevoirMutation,
} from '../../store/apiSlice'
import { Devoir } from '../../types'

// ─── Badge statut ─────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon',  cls: 'bg-neutral-100 text-neutral-600' },
  soumis:    { label: 'Soumis',     cls: 'bg-blue-100 text-blue-700' },
  cloturer:  { label: 'Clôturé',    cls: 'bg-warning-100 text-warning-700' },
  corrige:   { label: 'Corrigé ✓',  cls: 'bg-success-100 text-success-700' },
}

function StatutBadge({ statut }: { statut: string }) {
  const cfg = STATUT_CONFIG[statut] ?? { label: statut, cls: 'bg-neutral-100 text-neutral-500' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Formatage date ────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: fr }) }
  catch { return iso }
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function Devoirs() {
  const { classeId } = useParams<{ classeId: string }>()
  const navigate = useNavigate()

  const { data, isLoading, refetch } = useGetClassDevoirsQuery(classeId!, { skip: !classeId })
  const [corrigerDevoir, { isLoading: correcting }] = useCorrigerDevoirMutation()

  const [confirmCorriger, setConfirmCorriger] = useState<string | null>(null)

  const devoirs: Devoir[] = data?.results ?? []

  const handleCorriger = async (devoirId: string) => {
    try {
      await corrigerDevoir(devoirId).unwrap()
      setConfirmCorriger(null)
      refetch()
    } catch (err) {
      console.error('Erreur corriger devoir', err)
      alert('Erreur lors du passage en corrigé')
    }
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* En-tête */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-neutral-500 hover:text-primary-600 flex items-center gap-1 transition"
        >
          ← Retour
        </button>
        <h1 className="text-2xl font-bold text-neutral-900">📝 Devoirs de la classe</h1>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-neutral-400 text-sm">Chargement des devoirs…</div>
        ) : devoirs.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 text-sm">Aucun devoir pour cette classe.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-neutral-100 bg-neutral-50">
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold w-12">#</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Titre</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Créé le</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Date correction</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Statut</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devoirs.map((devoir, idx) => (
                  <tr
                    key={devoir.id}
                    className="border-b border-neutral-100 hover:bg-neutral-50 transition"
                  >
                    {/* Numéro */}
                    <td className="px-4 py-3 text-neutral-400 font-mono text-xs">
                      {idx + 1}
                    </td>

                    {/* Titre */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-800">
                        {devoir.titre || <span className="italic text-neutral-400">Sans titre</span>}
                      </span>
                    </td>

                    {/* Créé le */}
                    <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                      {fmtDate(devoir.created_at)}
                    </td>

                    {/* Date correction */}
                    <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                      {fmtDate(devoir.corrige_at)}
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3">
                      <StatutBadge statut={devoir.statut} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap items-center">
                        {/* Bouton Élèves */}
                        <button
                          onClick={() =>
                            navigate(`/professeur/devoirs/${devoir.id}/eleves`)
                          }
                          className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded hover:bg-indigo-700 transition font-medium"
                        >
                          👥 Élèves
                        </button>

                        {/* Bouton Corriger (uniquement si pas déjà corrigé) */}
                        {devoir.statut !== 'corrige' && (
                          <>
                            {confirmCorriger === devoir.id ? (
                              <div className="flex gap-1 items-center">
                                <span className="text-xs text-neutral-500">Confirmer ?</span>
                                <button
                                  onClick={() => handleCorriger(devoir.id)}
                                  disabled={correcting}
                                  className="text-xs bg-success-600 text-white px-2 py-1 rounded hover:bg-success-700 transition disabled:opacity-50"
                                >
                                  {correcting ? '…' : '✅ Oui'}
                                </button>
                                <button
                                  onClick={() => setConfirmCorriger(null)}
                                  className="text-xs bg-neutral-200 text-neutral-600 px-2 py-1 rounded hover:bg-neutral-300 transition"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmCorriger(devoir.id)}
                                className="text-xs bg-success-600 text-white px-2.5 py-1 rounded hover:bg-success-700 transition font-medium"
                              >
                                ✏️ Corriger
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}