import { useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import {
  useGetTachesDirectionQuery,
  useMarquerTacheFaiteMutation,
} from '../../store/apiSlice'
import { TacheDirection } from '../../types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return format(new Date(iso), 'dd MMM yyyy', { locale: fr })
}

function fmtDatetime(iso: string) {
  return format(new Date(iso), "dd MMM yyyy 'à' HH:mm", { locale: fr })
}

// ── DelaiBadge ────────────────────────────────────────────────────────────────

function DelaiBadge({ delais }: { delais: string }) {
  const now = new Date()
  const date = new Date(delais)
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const label = fmtDate(delais)

  if (diffDays < 0)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
        ⚠️ En retard · {label}
      </span>
    )
  if (diffDays === 0)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
        🔥 Aujourd'hui
      </span>
    )
  if (diffDays <= 3)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        ⏳ {diffDays}j · {label}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-500">
      📅 {label}
    </span>
  )
}

// ── Modal confirmation ────────────────────────────────────────────────────────

interface ConfirmModalProps {
  tache: TacheDirection
  action: 'complete' | 'reopen'
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function ConfirmModal({ tache, action, onConfirm, onCancel, loading }: ConfirmModalProps) {
  const isComplete = action === 'complete'
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="p-6 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isComplete ? 'bg-emerald-100' : 'bg-amber-100'
          }`}>
            {isComplete ? (
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
          </div>

          <h3 className="text-base font-bold text-neutral-900 mb-1">
            {isComplete ? 'Marquer comme accomplie ?' : 'Rouvrir cette tâche ?'}
          </h3>
          <p className="text-sm text-neutral-500 mb-1 font-medium line-clamp-2">« {tache.titre} »</p>
          <p className="text-xs text-neutral-400 mb-6">
            {isComplete
              ? 'Cette action indique que vous avez terminé cette tâche.'
              : 'La tâche repassera en statut "En cours".'}
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition font-medium"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 text-sm text-white rounded-xl transition font-semibold disabled:opacity-50 ${
                isComplete
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {loading
                ? '⏳ En cours…'
                : isComplete
                ? '✅ Accomplie'
                : '🔄 Rouvrir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Carte tâche admin ─────────────────────────────────────────────────────────

interface TacheCardAdminProps {
  tache: TacheDirection
  currentUserId: string
}

function TacheCardAdmin({ tache, currentUserId }: TacheCardAdminProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'complete' | 'reopen' | null>(null)
  const [marquer, { isLoading: toggling }] = useMarquerTacheFaiteMutation()

  async function handleConfirm() {
    if (!confirmAction) return
    await marquer({ id: tache.id, faite: confirmAction === 'complete' })
    setConfirmAction(null)
  }

  const urgence = (() => {
    if (!tache.delais || tache.faite) return null
    const diff = Math.ceil(
      (new Date(tache.delais).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (diff < 0) return 'retard'
    if (diff === 0) return 'urgent'
    if (diff <= 3) return 'proche'
    return null
  })()

  const borderClass = tache.faite
    ? 'border-emerald-200 bg-emerald-50/30'
    : urgence === 'retard'
    ? 'border-rose-300 bg-rose-50/30'
    : urgence === 'urgent'
    ? 'border-orange-300 bg-orange-50/20'
    : 'border-neutral-200 hover:border-violet-200 hover:shadow-md'

  return (
    <>
      <div className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${borderClass}`}>

        {/* Bandeau urgence */}
        {urgence === 'retard' && !tache.faite && (
          <div className="bg-rose-500 px-4 py-1.5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-white shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-semibold text-white">Tâche en retard — veuillez la traiter dès que possible</span>
          </div>
        )}
        {urgence === 'urgent' && !tache.faite && (
          <div className="bg-orange-400 px-4 py-1.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-white">🔥 Échéance aujourd'hui</span>
          </div>
        )}

        {/* Corps principal */}
        <div className="px-4 py-4">
          {/* Titre + badges */}
          <div className="flex items-start gap-2 flex-wrap mb-2">
            <p className={`text-sm font-bold leading-snug flex-1 min-w-0 ${tache.faite ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
              {tache.titre}
            </p>
            {tache.faite ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 shrink-0">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Accomplie
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                En cours
              </span>
            )}
          </div>

          {/* Délai */}
          {tache.delais && (
            <div className="mb-2">
              <DelaiBadge delais={tache.delais} />
            </div>
          )}

          {/* Description courte */}
          {tache.description && (
            <p className="text-xs text-neutral-500 mb-3 line-clamp-2">{tache.description}</p>
          )}

          {/* Boutons action */}
          {!tache.faite ? (
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => setConfirmAction('complete')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Marquer accomplie
              </button>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="px-3 py-2.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition"
              >
                <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-3">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-emerald-700">
                  {tache.faite_at ? `Accomplie le ${fmtDate(tache.faite_at)}` : 'Accomplie'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmAction('reopen')}
                className="px-3 py-2 text-xs font-medium text-neutral-500 hover:text-amber-600 hover:bg-amber-50 border border-neutral-200 hover:border-amber-300 rounded-xl transition"
              >
                Rouvrir
              </button>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="px-3 py-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition border border-neutral-200"
              >
                <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Détail expandable */}
        {expanded && (
          <div className="border-t border-neutral-100 px-4 py-3 bg-neutral-50 space-y-3">
            {tache.description && (
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Description complète</p>
                <p className="text-sm text-neutral-700 leading-relaxed">{tache.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Assignée par</p>
                <p className="text-sm text-neutral-700">{tache.created_by_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Créée le</p>
                <p className="text-sm text-neutral-700">{fmtDate(tache.created_at)}</p>
              </div>
              {tache.delais && (
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Date limite</p>
                  <p className="text-sm text-neutral-700">{fmtDatetime(tache.delais)}</p>
                </div>
              )}
              {tache.faite_at && (
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Accomplie le</p>
                  <p className="text-sm text-neutral-700">{fmtDatetime(tache.faite_at)}</p>
                </div>
              )}
            </div>

            {/* Co-assignés */}
            {tache.assignees.filter((a) => a.user !== currentUserId).length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Également assignée à</p>
                <div className="flex flex-wrap gap-2">
                  {tache.assignees
                    .filter((a) => a.user !== currentUserId)
                    .map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-neutral-200 rounded-full text-xs text-neutral-600 font-medium"
                      >
                        <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-semibold">
                          {(a.display_name ?? a.email).slice(0, 1).toUpperCase()}
                        </span>
                        {a.display_name ?? a.email}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal confirmation */}
      {confirmAction && (
        <ConfirmModal
          tache={tache}
          action={confirmAction}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
          loading={toggling}
        />
      )}
    </>
  )
}

// ── Page principale Admin ─────────────────────────────────────────────────────

type TabId = 'en_cours' | 'accomplies'

export default function TachesAdminPage() {
  const { user } = useAppSelector(selectAuth)
  const [activeTab, setActiveTab] = useState<TabId>('en_cours')

  const { data: tachesRaw, isLoading } = useGetTachesDirectionQuery()
  const allTaches: TacheDirection[] = Array.isArray(tachesRaw)
    ? tachesRaw
    : (tachesRaw as any)?.results ?? []

  const enCours = allTaches.filter((t) => !t.faite)
  const accomplies = allTaches.filter((t) => t.faite)

  // Trier les tâches en cours : retard en premier, puis par délai croissant
  const enCoursSorted = [...enCours].sort((a, b) => {
    const da = a.delais ? new Date(a.delais).getTime() : Infinity
    const db = b.delais ? new Date(b.delais).getTime() : Infinity
    return da - db
  })

  const currentList = activeTab === 'en_cours' ? enCoursSorted : accomplies

  const retardCount = enCours.filter(
    (t) => t.delais && new Date(t.delais) < new Date()
  ).length

  const tabs = [
    {
      id: 'en_cours' as TabId,
      label: 'À faire',
      count: enCours.length,
      activeColor: 'text-amber-600 bg-amber-100',
    },
    {
      id: 'accomplies' as TabId,
      label: 'Accomplies',
      count: accomplies.length,
      activeColor: 'text-emerald-600 bg-emerald-100',
    },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-6 min-h-screen">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Mes tâches</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Bonjour {user?.display_name ?? 'Admin'} — voici vos tâches assignées
        </p>
      </div>

      {/* ── Stats ── */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-neutral-200 rounded-2xl px-3 py-3">
            <p className="text-xs text-neutral-500 font-medium">À faire</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{enCours.length}</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-2xl px-3 py-3">
            <p className="text-xs text-neutral-500 font-medium">Accomplies</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{accomplies.length}</p>
          </div>
          <div className={`border rounded-2xl px-3 py-3 ${retardCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-neutral-200'}`}>
            <p className={`text-xs font-medium ${retardCount > 0 ? 'text-rose-500' : 'text-neutral-500'}`}>En retard</p>
            <p className={`text-2xl font-bold mt-0.5 ${retardCount > 0 ? 'text-rose-600' : 'text-neutral-300'}`}>{retardCount}</p>
          </div>
        </div>
      )}

      {/* ── Alerte retard ── */}
      {retardCount > 0 && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 mb-5">
          <svg className="w-5 h-5 text-rose-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-rose-700 font-medium">
            {retardCount} tâche{retardCount > 1 ? 's' : ''} en retard — traitez-les en priorité.
          </p>
        </div>
      )}

      {/* ── Onglets ── */}
      <div className="flex gap-2 mb-5 bg-neutral-100 p-1 rounded-2xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                activeTab === tab.id ? tab.activeColor : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Liste ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4 animate-pulse">
              <div className="space-y-3">
                <div className="h-4 bg-neutral-200 rounded-lg w-3/4" />
                <div className="h-3 bg-neutral-100 rounded-lg w-1/2" />
                <div className="h-10 bg-neutral-100 rounded-xl w-full mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
            {activeTab === 'accomplies' ? (
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-neutral-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            )}
          </div>
          <p className="text-neutral-600 font-semibold">
            {activeTab === 'accomplies' ? 'Aucune tâche accomplie' : 'Aucune tâche en attente'}
          </p>
          <p className="text-neutral-400 text-sm mt-1">
            {activeTab === 'accomplies'
              ? 'Vos tâches accomplies apparaîtront ici.'
              : 'Vous êtes à jour — aucune tâche ne vous est assignée.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((tache) => (
            <TacheCardAdmin
              key={tache.id}
              tache={tache}
              currentUserId={user?.id ?? ''}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1) forwards;
        }
      `}</style>
    </div>
  )
}