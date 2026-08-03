import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useGetUsersQuery,
  useGetAvailableAdminsQuery,
  useUpdateUserMutation,
  // 🔽 À ajouter dans ton apiSlice
  useGetClassesQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useGetInscriptionsQuery,
  useCreateInscriptionMutation,
  useDeleteInscriptionMutation,
  useGetAvailableElevesQuery, // query pour chercher des élèves à inscrire
  useGetCatalogueCoursQuery
} from '../../store/apiSlice'
import DataTable from '../../components/shared/DataTable'
import { User, Class, Inscription } from '../../types'

// ─────────────────────────────────────────────
// TYPES LOCAUX
// ─────────────────────────────────────────────

const STATUTS_CLASS = ['active', 'en_pause', 'fin_session', 'a_supprimer', 'supprimer']
const STATUTS_INSCR = ['actif', 'en_attente', 'annule']
const TYPE_COURS_OPTIONS = [
  { value: '', label: '————' },
  { value: 'alphabetisation',   label: 'Alphabétisation adulte' },
  { value: 'fluidification',    label: 'Fluidification intensive' },
  { value: 'groupe_special_3e', label: 'Groupe spécial 3€' },
  { value: 'gratuit',           label: '100% Gratuit' },
];

// ─────────────────────────────────────────────
// MODAL GÉNÉRIQUE
// ─────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] ${wide ? 'w-[900px] max-w-[95vw]' : 'w-[680px] max-w-[95vw]'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        {/* Body scrollable */}
        <div className="overflow-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// MODAL ÉLÈVES D'UNE CLASSE
// ─────────────────────────────────────────────

function ElevesModal({ classe, onClose }: { classe: Class; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  const { data: inscriptions, isLoading: inscLoading, refetch } = useGetInscriptionsQuery({ classe: classe.id })
  const { data: elevesDisponibles = [], isLoading: elevesLoading } = useGetAvailableElevesQuery({
    search: search || undefined,
    exclude_classe: classe.id,
  })
  const [createInscription] = useCreateInscriptionMutation()
  const [deleteInscription] = useDeleteInscriptionMutation()

  const inscrits = inscriptions?.results ?? []

  // IDs déjà inscrits pour éviter doublons dans la liste
  const inscritIds = new Set(inscrits.map((i: Inscription) => 
    typeof i.eleve === 'string' ? i.eleve : (i.eleve as User).id
  ))

  const disponibles: User[] = Array.isArray(elevesDisponibles)
    ? (elevesDisponibles as User[]).filter(e => !inscritIds.has(e.id))
    : []

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleAddSelected = async () => {
    if (selected.size === 0) return
    setAdding(true)
    try {
      await Promise.all(
        [...selected].map(eleveId =>
          createInscription({ eleve: eleveId, classe: classe.id }).unwrap()
        )
      )
      setSelected(new Set())
      refetch()
    } catch (err: any) {
      alert(err?.data?.detail || 'Erreur lors de l\'inscription')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (inscriptionId: string, eleveName: string) => {
    if (!confirm(`Retirer ${eleveName} de la classe ?`)) return
    try {
      await deleteInscription(inscriptionId).unwrap()
      refetch()
    } catch (err: any) {
      alert(err?.data?.detail || 'Erreur suppression')
    }
  }

  return (
    <Modal title={`👨‍🎓 Élèves — ${classe.nom}`} onClose={onClose} wide>
      <div className="flex gap-4 h-full" style={{ minHeight: 400 }}>

        {/* ── COLONNE GAUCHE : liste des élèves disponibles ── */}
        <div className="flex flex-col w-64 shrink-0 border border-neutral-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-200 bg-neutral-50 shrink-0">
            <p className="text-xs font-medium text-neutral-600 mb-1.5">Ajouter des élèves</p>
            <input
              type="search"
              placeholder="Rechercher..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(new Set()) }}
              className="form-input text-xs w-full"
            />
          </div>

          {/* Liste scrollable */}
          <div className="overflow-auto flex-1">
            {elevesLoading ? (
              <div className="text-xs text-neutral-400 text-center py-4">Chargement...</div>
            ) : disponibles.length === 0 ? (
              <div className="text-xs text-neutral-400 text-center py-4">
                {search ? 'Aucun résultat' : 'Tous les élèves sont inscrits'}
              </div>
            ) : (
              disponibles.map((e: User) => (
                <label
                  key={e.id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-primary-50 border-b border-neutral-50 last:border-0 ${
                    selected.has(e.id) ? 'bg-primary-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    className="rounded border-neutral-300 text-primary-600 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-neutral-800 truncate">
                      {e.display_name || e.email}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">{e.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>

          {/* Bouton inscrire */}
          <div className="px-3 py-2 border-t border-neutral-200 bg-neutral-50 shrink-0">
            <button
              onClick={handleAddSelected}
              disabled={selected.size === 0 || adding}
              className="w-full text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {adding ? 'Inscription...' : `+ Inscrire${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </div>

        {/* ── COLONNE DROITE : élèves inscrits ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-xs font-medium text-neutral-600 mb-2">
            Élèves inscrits ({inscrits.length})
          </p>

          {inscLoading ? (
            <div className="text-center py-8 text-neutral-400 text-sm">Chargement...</div>
          ) : inscrits.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm">Aucun élève inscrit</div>
          ) : (
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs text-neutral-500 border-b border-neutral-100">
                    <th className="pb-2 font-medium">Élève</th>
                    {/* <th className="pb-2 font-medium">Statut</th> */}
                    <th className="pb-2 font-medium">Inscrit le</th>
                    <th className="pb-2 font-medium">Contrat</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {inscrits.map((insc: Inscription) => (
                    <tr key={insc.id} className="border-b border-neutral-50 hover:bg-neutral-50/60 group">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-neutral-800">{insc.eleve_nom || String(insc.eleve)}</p>
                      </td>
                      {/* <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          insc.statut_inscription === 'actif'
                            ? 'bg-success-100 text-success-700'
                            : insc.statut_inscription === 'annule'
                            ? 'bg-danger-100 text-danger-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {insc.statut_inscription || 'actif'}
                        </span>
                      </td> */}
                      <td className="py-2 pr-3 text-neutral-500">
                        {insc.date_inscription
                          ? new Date(insc.date_inscription).toLocaleDateString('fr-FR')
                          : insc.created_at
                          ? new Date(insc.created_at).toLocaleDateString('fr-FR')
                          : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {insc.contrat_signe
                          ? <span className="text-success-600 text-xs">✅ Signé</span>
                          : <span className="text-neutral-400 text-xs">—</span>
                        }
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleDelete(insc.id, insc.eleve_nom || 'cet élève')}
                          className="opacity-0 group-hover:opacity-100 text-xs text-danger-500 hover:text-danger-700 transition"
                          title="Retirer de la classe"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────
// LIGNE EDITABLE — CLASSE
// ─────────────────────────────────────────────

function ClassRow({
  classe, isNew, onSave, onCancel,
}: {
  classe: Partial<Class>; isNew: boolean; onSave: (data: Partial<Class>) => Promise<void>; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Partial<Class>>(classe)
  const [saving, setSaving] = useState(false)
  const set = (field: string, value: any) => setDraft(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false) }
  }

  return (
    <tr className="border-b border-neutral-100 bg-primary-50/30 text-sm">
      {/* Nom */}
      <td className="py-2 pr-2">
        {isNew ? (
          <span className="text-xs text-neutral-400 italic">Auto généré</span>
        ) : (
          <span className="font-medium text-neutral-800">{draft.nom}</span>
        )}
      </td>

      {/* Programme & Niveau (champs libres) */}
      <td className="py-2 pr-2">
        <div className="flex gap-1">
          <input
            value={draft.programme || ''}
            onChange={e => set('programme', e.target.value)}
            className="form-input text-xs w-full"
            placeholder="Programme"
            autoFocus={isNew}
          />
          <input
            value={draft.niveau || ''}
            onChange={e => set('niveau', e.target.value)}
            className="form-input text-xs w-full"
            placeholder="Niveau"
          />
        </div>
      </td>

      {/* Type de cours (nouveau select) */}
      <td className="py-2 pr-2">
        <select
          value={draft.type_cours || ''}
          onChange={e => set('type_cours', e.target.value)}
          className="form-select text-xs w-full"
        >
          {TYPE_COURS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </td>

    

      {/* Statut */}
      {/* <td className="py-2 pr-2">
        <select value={draft.statut || 'active'} onChange={e => set('statut', e.target.value)} className="form-select text-sm w-28">
          {STATUTS_CLASS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td> */}

      {/* Nb inscrits (non éditable) */}
      <td className="py-2 pr-2 text-center text-neutral-400">—</td>

      {/* Actions */}
      <td className="py-2">
        <div className="flex gap-1 items-center">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs bg-success-600 text-white px-2 py-1 rounded hover:bg-success-700 disabled:opacity-40 transition"
          >
            {saving ? '…' : '✅'}
          </button>
          <button onClick={onCancel} className="text-xs bg-neutral-200 text-neutral-600 px-2 py-1 rounded hover:bg-neutral-300 transition">✕</button>
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────
// MODAL CLASSES D'UN PROFESSEUR
// ─────────────────────────────────────────────

function ClassesModal({ prof, onClose }: { prof: User; onClose: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [elevesForClasse, setElevesForClasse] = useState<Class | null>(null)

  const { data: classesData, isLoading, refetch } = useGetClassesQuery({
    professeur_id: prof.id,
    include_deleted: true,
  })
  const [createClass] = useCreateClassMutation()
  const [updateClass] = useUpdateClassMutation()

  const [tab, setTab] = useState<'actives' | 'supprimees'>('actives')

  //const classes: Class[] = classesData?.results ?? []
  const allClasses: Class[] = classesData?.results ?? []

  const activeClasses = allClasses.filter(
    (c: Class) => c.statut !== 'supprimer'
  )

  const deletedClasses = allClasses.filter(
    (c: Class) => c.statut === 'supprimer'
  )

  const handleCreate = async (data: Partial<Class>) => {
    try {
      await createClass({ ...data, professeur: prof.id }).unwrap()
      setAddingNew(false)
      refetch()
    } catch (err: any) {
      alert(err?.data?.detail || 'Erreur création')
    }
  }

  const handleUpdate = async (id: string, data: Partial<Class>) => {
    try {
      await updateClass({ id, ...data }).unwrap()
      setEditingId(null)
      refetch()
    } catch (err: any) {
      alert(err?.data?.detail || 'Erreur mise à jour')
    }
  }


  const handleDeleteRequest = async (classeId: string) => {
    if (!confirm('Envoyer la demande de suppression de cette classe ?')) return

    try {
      await updateClass({
        id: classeId,
        statut: 'supprimer',
      }).unwrap()

      refetch()
    } catch (err: any) {
      alert(err?.data?.detail || 'Erreur lors de la suppression')
    }
  }


  const handleReactivateClass = async (classeId: string) => {
  try {
    await updateClass({
      id: classeId,
      statut: 'active',
    }).unwrap()

    refetch()
  } catch (err: any) {
    alert(err?.data?.detail || 'Erreur lors de la réactivation')
  }
}

  return (
    <>
      <Modal title={`📚 Classes — ${prof.display_name || prof.email}`} onClose={onClose} wide>
        {/* Bouton ajouter */}
        <div className="flex justify-end mb-3">
          {!addingNew && (
            <button
              onClick={() => setAddingNew(true)}
              className="text-sm bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition"
            >
              + Nouvelle classe
            </button>
          )}
        </div>

    

    {isLoading ? (
        <div className="text-center py-8 text-neutral-400">
          Chargement...
        </div>
      ) : (
        <>
          {/* ONGLETS */}
          <div className="flex items-center gap-2 mb-4 border-b border-neutral-200">
            <button
              onClick={() => setTab('actives')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === 'actives'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              📚 Classes actives ({activeClasses.length})
            </button>

            <button
              onClick={() => setTab('supprimees')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === 'supprimees'
                  ? 'border-danger-600 text-danger-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              🗑 Supprimées ({deletedClasses.length})
            </button>
          </div>

          {/* ───────────────────────── */}
          {/* ONGLET ACTIVES */}
          {/* ───────────────────────── */}

          {tab === 'actives' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
                  <th className="pb-2 font-medium w-40">Nom</th>
                  <th className="pb-2 font-medium w-56">Programme / Niveau</th>
                  <th className="pb-2 font-medium w-28">Cours speciaux</th>
                  {/* <th className="pb-2 font-medium w-28">Statut</th> */}
                  <th className="pb-2 font-medium w-16 text-center">Élèves</th>
                  <th className="pb-2 font-medium w-20">Actions</th>
                </tr>
              </thead>

              <tbody>
                {addingNew && (
                  <ClassRow
                    classe={{ statut: 'active' }}
                    isNew
                    onSave={handleCreate}
                    onCancel={() => setAddingNew(false)}
                  />
                )}

                {activeClasses.length === 0 && !addingNew ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-neutral-400"
                    >
                      Aucune classe pour ce professeur
                    </td>
                  </tr>
                ) : (
                  activeClasses.map(c =>
                    editingId === c.id ? (
                      <ClassRow
                        key={c.id}
                        classe={c}
                        isNew={false}
                        onSave={data => handleUpdate(c.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <tr
                        key={c.id}
                        className="border-b border-neutral-50 hover:bg-neutral-50/60 group text-sm"
                      >
                        <td className="py-2 pr-3 font-medium text-neutral-800">
                          {c.nom}
                        </td>

                        <td className="py-2 pr-3 text-neutral-500 text-xs">
                          {(c.programme || '—') + ' • ' + (c.niveau || '—')}
                        </td>
                        <td className="py-2 pr-3 text-neutral-500 text-xs">
                          {TYPE_COURS_OPTIONS.find(o => o.value === c.type_cours)?.label || '—'}
                        </td>


                        {/* <td className="py-2 pr-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              c.statut === 'active'
                                ? 'bg-success-100 text-success-700'
                                : c.statut === 'fin_session'
                                ? 'bg-neutral-100 text-neutral-500'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {c.statut}
                          </span>
                        </td>
                        */}
                        <td className="py-2 pr-3 text-center text-neutral-600">
                          <button
                            onClick={() => setElevesForClasse(c)}
                            className="font-medium text-primary-600 hover:underline"
                          >
                            {c.nb_inscrits ?? 0}
                          </button>
                        </td>

                        <td className="py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingId(c.id)}
                              className="text-xs bg-neutral-100 text-neutral-600 px-2 py-1 rounded hover:bg-neutral-200 transition"
                            >
                              ✏️
                            </button>

                            <button
                              onClick={() => setElevesForClasse(c)}
                              className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded hover:bg-primary-100 transition"
                            >
                              👥
                            </button>

                            {c.statut === 'a_supprimer' && (
                              <button
                                onClick={() => handleDeleteRequest(c.id)}
                                className="text-xs bg-danger-50 text-danger-700 px-2 py-1 rounded hover:bg-danger-100 transition"
                              >
                                🗑 Demande suppression
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          )}

          {/* ───────────────────────── */}
          {/* ONGLET SUPPRIMÉES */}
          {/* ───────────────────────── */}

          {tab === 'supprimees' && (
            <div className="space-y-2">
              {deletedClasses.length === 0 ? (
                <div className="text-center py-10 text-neutral-400">
                  Aucune classe supprimée
                </div>
              ) : (
                deletedClasses.map((c: Class) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between border border-neutral-200 rounded-lg px-4 py-3 bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-700">
                        {c.nom}
                      </p>

                      <p className="text-xs text-neutral-400">
                        {c.programme || '—'} • {c.niveau || '—'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleReactivateClass(c.id)}
                      className="text-xs bg-success-50 text-success-700 px-3 py-1.5 rounded hover:bg-success-100 transition"
                    >
                      ♻️ Réactiver
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

        
      </Modal>

      {/* Modal élèves imbriqué */}
      {elevesForClasse && (
        <ElevesModal
          classe={elevesForClasse}
          onClose={() => setElevesForClasse(null)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────

export default function DirectionProfesseurs() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const [editedRow, setEditedRow] = useState<string | null>(null)
  const [pendingAdmin, setPendingAdmin] = useState<Record<string, string | null>>({})
  const [classesModal, setClassesModal] = useState<User | null>(null)

  const { data: usersData, isLoading, refetch } = useGetUsersQuery({
    role: 'professeur',
    page: 1,
    search: search || undefined,
  })
  const { data: availableAdmins, isLoading: adminsLoading } = useGetAvailableAdminsQuery()
  const [updateUser] = useUpdateUserMutation()

  const handleAdminChange = (profId: string, adminId: string | null) => {
    setPendingAdmin(prev => ({ ...prev, [profId]: adminId }))
    if (editedRow !== profId) setEditedRow(profId)
  }

  const handleSaveAdmin = async (profId: string) => {
    try {
      await updateUser({ id: profId, admin_id: pendingAdmin[profId] || null }).unwrap()
      setEditedRow(null)
      setPendingAdmin(prev => { const { [profId]: _, ...rest } = prev; return rest })
      refetch()
    } catch (err: any) {
      alert(`Erreur : ${err?.data?.detail || 'Échec de la mise à jour'}`)
    }
  }

  const handleCancelEdit = (profId: string) => {
    setEditedRow(null)
    setPendingAdmin(prev => { const { [profId]: _, ...rest } = prev; return rest })
  }

  const columns = [
    {
      key: 'display_name',
      label: 'Nom',
      render: (u: User) => (
        <div>
          <p className="font-medium text-neutral-900">{u.display_name || u.email}</p>
          <p className="text-xs text-neutral-500">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'is_active',
      label: 'Statut',
      render: (u: User) => (
        <span className={`px-2 py-0.5 rounded text-xs ${u.is_active ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'}`}>
          {u.is_active ? 'Actif' : 'Inactif'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Inscrit le',
      render: (u: User) => new Date(u.created_at).toLocaleDateString('fr-FR'),
    },
    {
      key: 'admin',
      label: 'Administrateur',
      render: (u: User) => {
        const isEditing = editedRow === u.id
        const currentAdminId = pendingAdmin[u.id] !== undefined ? pendingAdmin[u.id] : u.admin_id

        return isEditing ? (
          <select
            value={currentAdminId || ''}
            onChange={e => handleAdminChange(u.id, e.target.value || null)}
            className="form-select text-sm w-40 border-primary-300 focus:ring-primary-500"
            autoFocus
          >
            <option value="">Aucun</option>
            {adminsLoading ? (
              <option disabled>Chargement...</option>
            ) : (
              availableAdmins?.map((admin: User) => (
                <option key={admin.id} value={admin.id}>{admin.display_name || admin.email}</option>
              ))
            )}
          </select>
        ) : (
          <span
            className="text-sm text-neutral-700 cursor-pointer hover:text-primary-600 hover:underline"
            onClick={() => handleAdminChange(u.id, u.admin_id || null)}
            title="Cliquer pour modifier"
          >
            {u.admin_nom || (u.admin_id ? 'Admin assigné' : 'Aucun')}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (u: User) => (
        <div className="flex gap-2 items-center flex-wrap">
          {/* ✅ MODIFIÉ : ouvre le modal au lieu de naviguer */}
          <button
            onClick={() => setClassesModal(u)}
            className="text-xs bg-neutral-100 text-neutral-700 px-2 py-1 rounded hover:bg-neutral-200"
          >
            📚 Classes
          </button>

          {editedRow === u.id && (
            <>
              <button
                onClick={() => handleSaveAdmin(u.id)}
                className="text-xs bg-success-600 text-white px-2 py-1 rounded hover:bg-success-700 transition"
              >
                ✅ OK
              </button>
              <button
                onClick={() => handleCancelEdit(u.id)}
                className="text-xs bg-neutral-200 text-neutral-700 px-2 py-1 rounded hover:bg-neutral-300 transition"
              >
                ✕
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-neutral-900">👨‍🏫 Gestion des Professeurs</h1>
          <span className="text-sm text-neutral-500">{usersData?.count || 0} professeur(s)</span>
        </div>

        <input
          type="search"
          placeholder="Rechercher un professeur..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input max-w-md"
        />

        <DataTable<User>
          data={usersData?.results || []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="Aucun professeur trouvé"
        />
      </div>

      {/* Modal Classes */}
      {classesModal && (
        <ClassesModal
          prof={classesModal}
          onClose={() => setClassesModal(null)}
        />
      )}
    </>
  )
}