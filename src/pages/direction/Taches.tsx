import { useState, useRef, useEffect } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import {
  useGetTachesDirectionQuery,
  useCreateTacheDirectionMutation,
  useUpdateTacheDirectionMutation,
  useDeleteTacheDirectionMutation,
  useMarquerTacheFaiteMutation,
  useGetAdminsAssignablesQuery,
} from '../../store/apiSlice'
import { TacheDirection, AdminUser } from '../../types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return format(new Date(iso), 'dd MMM yyyy', { locale: fr })
}

function fmtDatetime(iso: string) {
  return format(new Date(iso), "dd MMM yyyy 'à' HH:mm", { locale: fr })
}

function initiales(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500',
]
function avatarColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function Avatar({ user, size = 'sm' }: { user: { id: string; display_name: string | null; email: string }; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${sz} ${avatarColor(user.id)}`}
      title={user.display_name ?? user.email}
    >
      {initiales(user.display_name, user.email)}
    </span>
  )
}

function StatusBadge({ faite }: { faite: boolean }) {
  return faite ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-none" />
      Faite
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      En cours
    </span>
  )
}

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

// ── Modal Création / Édition ──────────────────────────────────────────────────

interface TacheFormProps {
  tache?: TacheDirection
  admins: AdminUser[]
  onClose: () => void
}

function TacheFormModal({ tache, admins, onClose }: TacheFormProps) {
  const [titre, setTitre] = useState(tache?.titre ?? '')
  const [description, setDescription] = useState(tache?.description ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>(
    tache?.assignees.map((a) => a.user) ?? []
  )
  const [createTache, { isLoading: creating }] = useCreateTacheDirectionMutation()
  const [updateTache, { isLoading: updating }] = useUpdateTacheDirectionMutation()
  const loading = creating || updating

  const [delais, setDelais] = useState(
    tache?.delais ? tache.delais.slice(0, 16) : ''  // format datetime-local
    )

  function toggleAdmin(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    try {
      if (tache) {
        await updateTache({ id: tache.id, titre, description, assignee_ids: selectedIds, delais: delais || null }).unwrap()
      } else {
        await createTache({ titre, description, assignee_ids: selectedIds, delais: delais || null }).unwrap()
      }
      onClose()
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">
            {tache ? 'Modifier la tâche' : 'Nouvelle tâche'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Titre <span className="text-rose-500">*</span>
            </label>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Préparer le rapport mensuel"
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez la tâche en détail…"
              rows={3}
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none"
            />
          </div>

          {/* <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
                Date limite
            </label>
            <input
                type="datetime-local"
                value={delais}
                onChange={(e) => setDelais(e.target.value)}
                className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
          </div> */}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Assigner à
              {selectedIds.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full font-semibold">
                  {selectedIds.length}
                </span>
              )}
            </label>
            {admins.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Aucun admin disponible.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {admins.map((admin) => {
                  const checked = selectedIds.includes(admin.id)
                  return (
                    <button
                      key={admin.id}
                      type="button"
                      onClick={() => toggleAdmin(admin.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                        checked
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      <Avatar user={admin} size="sm" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-neutral-800 truncate">
                          {admin.display_name ?? admin.email}
                        </p>
                        {admin.display_name && (
                          <p className="text-xs text-neutral-400 truncate">{admin.email}</p>
                        )}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        checked ? 'bg-violet-500 border-violet-500' : 'border-neutral-300'
                      }`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !titre.trim()}
              className="flex-1 px-4 py-2.5 text-sm text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl transition font-semibold"
            >
              {loading ? '⏳ Enregistrement…' : tache ? 'Mettre à jour' : 'Créer la tâche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Carte tâche ───────────────────────────────────────────────────────────────

interface TacheCardProps {
  tache: TacheDirection
  isDirection: boolean
  currentUserId: string
}

function TacheCard({ tache, isDirection, currentUserId }: TacheCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [marquer, { isLoading: toggling }] = useMarquerTacheFaiteMutation()
  const [deleteTache, { isLoading: deleting }] = useDeleteTacheDirectionMutation()
  const { data: admins = [] } = useGetAdminsAssignablesQuery(undefined, { skip: !isDirection })

  const isAssigned = tache.assignees.some((a) => a.user === currentUserId)
  const canToggle = isDirection || isAssigned

  async function handleToggle() {
    if (!canToggle || toggling) return
    await marquer({ id: tache.id, faite: !tache.faite })
  }

  async function handleDelete() {
    if (!window.confirm('Supprimer cette tâche ?')) return
    await deleteTache(tache.id)
  }

  return (
    <>
      <div
        className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
          tache.faite ? 'border-emerald-200 opacity-80' : 'border-neutral-200 hover:border-violet-200 hover:shadow-md'
        }`}
      >
        {/* Ligne principale */}
        <div className="px-4 py-4 flex items-start gap-3">
          {/* Checkbox */}
          
          {/* <button
            type="button"
            onClick={handleToggle}
            disabled={!canToggle || toggling}
            className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              tache.faite
                ? 'bg-emerald-500 border-emerald-500'
                : canToggle
                ? 'border-neutral-300 hover:border-violet-400'
                : 'border-neutral-200 cursor-default'
            }`}
          >
            {tache.faite && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button> */}

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <p className={`text-sm font-semibold leading-snug flex-1 min-w-0 ${tache.faite ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
                {tache.titre}
              </p>
              
              <StatusBadge faite={tache.faite} />
              {tache.delais && (
                <DelaiBadge delais={tache.delais} />
               )}
            </div>

            {tache.description && (
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{tache.description}</p>
            )}

            <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
              {/* Avatars assignées */}
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {tache.assignees.slice(0, 4).map((a) => (
                    <Avatar
                      key={a.id}
                      user={{ id: a.user, display_name: a.display_name, email: a.email }}
                      size="sm"
                    />
                  ))}
                  {tache.assignees.length > 4 && (
                    <span className="w-7 h-7 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-xs text-neutral-500 font-semibold">
                      +{tache.assignees.length - 4}
                    </span>
                  )}
                </div>
                {tache.assignees.length === 0 && (
                  <span className="text-xs text-neutral-400 italic">Non assignée</span>
                )}
              </div>

            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition"
            >
              <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isDirection && (
              <>
                <button
                  type="button"
                  onClick={() => setShowEdit(true)}
                  className="p-1.5 text-neutral-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Détail expandable */}
        {expanded && (
          <div className="border-t border-neutral-100 px-4 py-3 bg-neutral-50 space-y-3">
            {tache.description && (
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-neutral-700">{tache.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Créée par</p>
                <p className="text-sm text-neutral-700">{tache.created_by_name ?? '—'}</p>
              </div>
              {tache.faite && (
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Faite par</p>
                  <p className="text-sm text-neutral-700">{tache.faite_par_name ?? '—'}</p>
                </div>
              )}
              {tache.faite_at && (
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Faite le</p>
                  <p className="text-sm text-neutral-700">{fmtDatetime(tache.faite_at)}</p>
                </div>
              )}

              {/* {tache.delais && (
                <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Date limite</p>
                    <p className="text-sm text-neutral-700">{fmtDatetime(tache.delais)}</p>
                </div>
              )} */}
            </div>

            {tache.assignees.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Assignée à</p>
                <div className="space-y-1.5">
                  {tache.assignees.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Avatar
                        user={{ id: a.user, display_name: a.display_name, email: a.email }}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-700 font-medium truncate">
                          {a.display_name ?? a.email}
                        </p>
                        <p className="text-xs text-neutral-400 truncate">{a.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showEdit && (
        <TacheFormModal
          tache={tache}
          admins={admins}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

type TabId = 'en_cours' | 'faites'

export default function TachesDirectionPage() {
  const { user } = useAppSelector(selectAuth)
  const isDirection = user?.role === 'direction'
  const [activeTab, setActiveTab] = useState<TabId>('en_cours')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: tachesRaw, isLoading } = useGetTachesDirectionQuery()
  const allTaches: TacheDirection[] = Array.isArray(tachesRaw)
    ? tachesRaw
    : (tachesRaw as any)?.results ?? []
  const { data: admins = [] } = useGetAdminsAssignablesQuery(undefined, {
    skip: !isDirection,
  })

  const enCours = allTaches.filter((t) => !t.faite)
  const faites = allTaches.filter((t) => t.faite)

  const currentList = activeTab === 'en_cours' ? enCours : faites

  const tabs: { id: TabId; label: string; count: number; color: string }[] = [
    {
      id: 'en_cours',
      label: 'En cours',
      count: enCours.length,
      color: 'text-amber-600 bg-amber-100',
    },
    {
      id: 'faites',
      label: 'Faites',
      count: faites.length,
      color: 'text-emerald-600 bg-emerald-100',
    },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-6 min-h-screen">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Tâches</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {isDirection ? 'Gestion des tâches admins' : 'Mes tâches assignées'}
          </p>
        </div>
        {isDirection && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-2xl shadow-sm transition active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nouvelle tâche</span>
          </button>
        )}
      </div>

      {/* ── Stats rapides ── */}
      {isLoading ? null : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white border border-neutral-200 rounded-2xl px-4 py-3">
            <p className="text-xs text-neutral-500 font-medium">En cours</p>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{enCours.length}</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-2xl px-4 py-3">
            <p className="text-xs text-neutral-500 font-medium">Complétées</p>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{faites.length}</p>
          </div>
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
                activeTab === tab.id ? tab.color : 'bg-neutral-200 text-neutral-500'
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
              <div className="flex gap-3">
                <div className="w-5 h-5 bg-neutral-200 rounded-full shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-200 rounded-lg w-3/4" />
                  <div className="h-3 bg-neutral-100 rounded-lg w-1/2" />
                  <div className="flex gap-1.5 mt-3">
                    <div className="w-7 h-7 bg-neutral-200 rounded-full" />
                    <div className="w-7 h-7 bg-neutral-200 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : currentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
            {activeTab === 'faites' ? (
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            )}
          </div>
          <p className="text-neutral-600 font-semibold">
            {activeTab === 'faites' ? 'Aucune tâche complétée' : 'Aucune tâche en cours'}
          </p>
          <p className="text-neutral-400 text-sm mt-1">
            {activeTab === 'faites'
              ? 'Les tâches terminées apparaîtront ici.'
              : isDirection
              ? 'Créez une nouvelle tâche pour commencer.'
              : 'Aucune tâche ne vous est assignée.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((tache) => (
            <TacheCard
              key={tache.id}
              tache={tache}
              isDirection={isDirection}
              currentUserId={user?.id ?? ''}
            />
          ))}
        </div>
      )}

      {/* ── Modal création ── */}
      {showCreateModal && isDirection && (
        <TacheFormModal
          admins={admins}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* ── Animation CSS (si non globale) ── */}
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