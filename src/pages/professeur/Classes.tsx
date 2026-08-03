import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { 
  useGetClassesQuery, 
  usePauseClassMutation, 
  useFlagDeleteClassMutation,
  useUpdateClassMutation,
  useGetClassStudentsQuery,
  useUpdateStudentMutation,
  useGetClassSeancesQuery,
  useCreateSeanceMutation,
  useUpdateSeanceMutation,
} from '../../store/apiSlice'
import DataTable from '../../components/shared/DataTable'
import StatusBadge from '../../components/shared/StatusBadge'
import Modal from '../../components/shared/Modal'
import { Class, User, Inscription, Seance } from '../../types'
import { format } from 'date-fns'

// ─── Types locaux ─────────────────────────────────────────────────────────────

type SeanceRow = {
  id: string
  date_seance: string | null        // ← rendu nullable
  jour_seance: string | null        // ← nouveau
  heure_debut_reelle: string | null
  duree_reelle_minutes: number | null
  statut: string | null
  isNew?: boolean
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ProfClasses() {
  const { user } = useAppSelector(selectAuth)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  // ── États édition classes ──────────────────────────────────────────────────
  const [editedRow, setEditedRow] = useState<string | null>(null)
  const [rowChanges, setRowChanges] = useState<Record<string, Partial<Class>>>({})

  // ── États modal élèves ─────────────────────────────────────────────────────
  const [studentsModal, setStudentsModal] = useState<{ open: boolean; classId: string | null }>({ open: false, classId: null })
  const [editedStudents, setEditedStudents] = useState<Record<string, string>>({})

  // ── États modal séances ────────────────────────────────────────────────────
  const [seancesModal, setSeancesModal] = useState<{ open: boolean; classId: string | null; className: string }>({
    open: false,
    classId: null,
    className: '',
  })
  // Stocke les modifications en cours sur les séances (id → champs modifiés)
  const [editedSeances, setEditedSeances] = useState<Record<string, Partial<SeanceRow>>>({})
  // Lignes nouvelles (pas encore persistées)
  const [newSeances, setNewSeances] = useState<SeanceRow[]>([])
  const [seanceSaving, setSeanceSaving] = useState<Record<string, boolean>>({})

  // ── RTK Query ──────────────────────────────────────────────────────────────
  const { data: classesData, isLoading, refetch } = useGetClassesQuery({ page: 1, search })
  const [pauseClass] = usePauseClassMutation()
  const [flagDelete] = useFlagDeleteClassMutation()
  const [updateClass] = useUpdateClassMutation()
  const [updateStudent] = useUpdateStudentMutation()

  const { data: studentsData, isLoading: studentsLoading } = useGetClassStudentsQuery(
    studentsModal.classId!,
    { skip: !studentsModal.classId }
  )

  const { data: seancesData, isLoading: seancesLoading, refetch: refetchSeances } = useGetClassSeancesQuery(
    seancesModal.classId!,
    { skip: !seancesModal.classId }
  )

  const [createSeance] = useCreateSeanceMutation()
  const [updateSeance] = useUpdateSeanceMutation()


  const JOURS_SEANCE_OPTIONS = [
  { value: '', label: 'Sélectionner...' },
  { value: 'lundi',    label: 'Lundi' },
  { value: 'mardi',    label: 'Mardi' },
  { value: 'mercredi', label: 'Mercredi' },
  { value: 'jeudi',    label: 'Jeudi' },
  { value: 'vendredi', label: 'Vendredi' },
  { value: 'samedi',   label: 'Samedi' },
  { value: 'dimanche', label: 'Dimanche' },
]

  // ─── Handlers classes ────────────────────────────────────────────────────────

  const handleCellEdit = (classId: string, field: keyof Class, value: any) => {
    setRowChanges(prev => ({ ...prev, [classId]: { ...prev[classId], [field]: value } }))
    if (editedRow !== classId) setEditedRow(classId)
  }

  const handleSaveRow = async (classId: string) => {
    try {
      await updateClass({ id: classId, ...rowChanges[classId] }).unwrap()
      setEditedRow(null)
      setRowChanges(prev => { const { [classId]: _, ...rest } = prev; return rest })
      refetch()
    } catch (err) {
      console.error('Save class failed', err)
      alert('Erreur lors de la mise à jour')
    }
  }

  const handleCancelEdit = (classId: string) => {
    setEditedRow(null)
    setRowChanges(prev => { const { [classId]: _, ...rest } = prev; return rest })
  }

  // ─── Handlers élèves ─────────────────────────────────────────────────────────

  const handleStudentEdit = (studentId: string, currentName: string) => {
    setEditedStudents(prev => ({ ...prev, [studentId]: currentName }))
  }

  const handleSaveStudent = async (studentId: string) => {
    try {
      await updateStudent({ id: studentId, display_name: editedStudents[studentId] }).unwrap()
      setEditedStudents(prev => { const { [studentId]: _, ...rest } = prev; return rest })
    } catch (err) {
      console.error('Save student failed', err)
      alert("Erreur lors de la mise à jour de l'élève")
    }
  }

  // ─── Handlers séances ────────────────────────────────────────────────────────

  /** Marque un champ d'une séance existante comme modifié */
  const handleSeanceFieldChange = (seanceId: string, field: keyof SeanceRow, value: any) => {
    setEditedSeances(prev => ({
      ...prev,
      [seanceId]: { ...prev[seanceId], [field]: value },
    }))
  }

  /** Sauvegarde une séance existante */
  const handleSaveSeance = async (seanceId: string) => {
    const changes = editedSeances[seanceId]
    if (!changes) return
    setSeanceSaving(prev => ({ ...prev, [seanceId]: true }))
    try {
      await updateSeance({ id: seanceId, ...changes }).unwrap()
      setEditedSeances(prev => { const { [seanceId]: _, ...rest } = prev; return rest })
      refetchSeances()
    } catch (err) {
      console.error('Save seance failed', err)
      alert('Erreur lors de la mise à jour de la séance')
    } finally {
      setSeanceSaving(prev => ({ ...prev, [seanceId]: false }))
    }
  }

  const handleCancelSeanceEdit = (seanceId: string) => {
    setEditedSeances(prev => { const { [seanceId]: _, ...rest } = prev; return rest })
  }

  /** Ajoute une ligne vide pour une nouvelle séance */
  const handleAddSeance = () => {
    const tempId = `new-${Date.now()}`
    const today = new Date().toISOString().split('T')[0]
    setNewSeances(prev => [
      ...prev,
      { id: tempId, date_seance: null,jour_seance: null, heure_debut_reelle: '08:00', duree_reelle_minutes: 60, statut: 'planifiee', isNew: true },
    ])
  }

  /** Change un champ d'une nouvelle séance (pas encore persistée) */
  const handleNewSeanceFieldChange = (tempId: string, field: keyof SeanceRow, value: any) => {
    setNewSeances(prev => prev.map(s => s.id === tempId ? { ...s, [field]: value } : s))
  }

  /** Persiste une nouvelle séance */
  const handleSaveNewSeance = async (tempId: string) => {
    const seance = newSeances.find(s => s.id === tempId)
    if (!seance || !seancesModal.classId) return
    setSeanceSaving(prev => ({ ...prev, [tempId]: true }))
    try {
      await createSeance({
        classe: seancesModal.classId,
        date_seance: seance.date_seance,
        jour_seance: seance.jour_seance,
        heure_debut_reelle: seance.heure_debut_reelle,
        duree_reelle_minutes: seance.duree_reelle_minutes,
        statut: seance.statut,
      }).unwrap()
      setNewSeances(prev => prev.filter(s => s.id !== tempId))
      refetchSeances()
    } catch (err) {
      console.error('Create seance failed', err)
      alert('Erreur lors de la création de la séance')
    } finally {
      setSeanceSaving(prev => ({ ...prev, [tempId]: false }))
    }
  }

  const handleCancelNewSeance = (tempId: string) => {
    setNewSeances(prev => prev.filter(s => s.id !== tempId))
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const handleAction = async (id: string, action: 'pause' | 'flag') => {
    try {
      if (action === 'pause') await pauseClass(id).unwrap()
      else await flagDelete(id).unwrap()
      refetch()
    } catch (err) { console.error('Action failed', err) }
  }

  const PROGRAMME_OPTIONS = [
    { value: '', label: 'Sélectionner...' },
    { value: 'maths', label: 'Mathématiques' },
    { value: 'physique', label: 'Physique' },
    { value: 'chimie', label: 'Chimie' },
    { value: 'svt', label: 'SVT' },
    { value: 'histoire', label: 'Histoire-Géo' },
    { value: 'francais', label: 'Français' },
    { value: 'anglais', label: 'Anglais' },
    { value: 'autre', label: 'Autre' },
  ]

  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  const STATUT_SEANCE_OPTIONS = [
    { value: 'planifiee', label: 'Planifiée' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'terminee', label: 'Terminée' },
    { value: 'annulee', label: 'Annulée' },
  ]

  const statutSeanceBadge = (statut: string | null) => {
    switch (statut) {
      case 'planifiee': return 'bg-blue-100 text-blue-700'
      case 'en_cours': return 'bg-warning-100 text-warning-700'
      case 'terminee': return 'bg-success-100 text-success-700'
      case 'annulee': return 'bg-danger-100 text-danger-700'
      default: return 'bg-neutral-100 text-neutral-600'
    }
  }

  // ─── Colonnes tableau classes ─────────────────────────────────────────────────

  const columns = [
    {
      key: 'nom',
      label: 'Classe',
      sortable: true,
      render: (c: Class) => <span className="font-medium">{c.nom}</span>,
    },
    {
      key: 'programme',
      label: 'Programme',
      render: (c: Class) => {
        const isEditing = editedRow === c.id
        const value = rowChanges[c.id]?.programme ?? c.programme ?? ''
        return isEditing ? (
          <select
            value={value}
            onChange={e => handleCellEdit(c.id, 'programme', e.target.value)}
            className="form-select text-sm w-full border-primary-300 focus:ring-primary-500"
            autoFocus
          >
            {PROGRAMME_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        ) : (
          <span
            className="text-sm text-neutral-600 cursor-pointer hover:text-primary-600 hover:underline"
            onClick={() => handleCellEdit(c.id, 'programme', c.programme)}
            title="Cliquer pour modifier"
          >
            {PROGRAMME_OPTIONS.find(o => o.value === c.programme)?.label || c.programme || '-'}
          </span>
        )
      },
    },

    {
      key: 'eleves',
      label: 'Élèves',
      render: (c: Class) => <span className="text-sm">{c.nb_inscrits || 0} inscrit(s)</span>,
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (c: Class) => <StatusBadge status={c.statut} color={c.couleur} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (c: Class) => (
        <div className="flex flex-wrap gap-1 items-center">
          {/* <button onClick={() => navigate(`/professeur/classe/${c.id}`)} className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 transition">
            Accéder
          </button> */}

          {editedRow === c.id && (
            <>
              <button onClick={() => handleSaveRow(c.id)} className="text-xs bg-success-600 text-white px-2 py-1 rounded hover:bg-success-700 transition flex items-center gap-1">
                ✅ OK
              </button>
              <button onClick={() => handleCancelEdit(c.id)} className="text-xs bg-neutral-200 text-neutral-700 px-2 py-1 rounded hover:bg-neutral-300 transition">
                ✕
              </button>
            </>
          )}

          {/* <button
            onClick={() => setStudentsModal({ open: true, classId: c.id })}
            className="text-xs bg-primary-600 text-white px-2 py-1 rounded hover:bg-primary-700 transition"
          >
            Élèves
          </button> */}

          {/* ── NOUVEAU : bouton Séances ── */}
          {/* <button
            onClick={() => {
              setSeancesModal({ open: true, classId: c.id, className: c.nom })
              setNewSeances([])
              setEditedSeances({})
            }}
            className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition"
          >
            📅 Séances
          </button> */}

          <button
            onClick={() => navigate(`/professeur/classe/${c.id}/devoirs`)}
            className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 transition"
          >
            📝 Devoirs
          </button>

          {/* <button
            onClick={() => handleAction(c.id, 'pause')}
            className={`text-xs px-2 py-1 rounded transition ${c.couleur === 'orange' ? 'bg-neutral-200 text-neutral-600 cursor-not-allowed' : 'bg-warning-100 text-warning-700 hover:bg-warning-200'}`}
            disabled={c.couleur === 'orange'}
          >
            {c.couleur === 'orange' ? '🟢 Reprise' : '⏸️ Pause'}
          </button>
          <button
            onClick={() => handleAction(c.id, 'flag')}
            className={`text-xs px-2 py-1 rounded transition ${c.couleur === 'rouge' ? 'bg-neutral-200 text-neutral-600 cursor-not-allowed' : 'bg-danger-100 text-danger-700 hover:bg-danger-200'}`}
            disabled={c.couleur === 'rouge'}
          >
            🗑️ Fin
          </button> */}
        </div>
      ),
    },
  ]

  // ─── Rendu d'une ligne de séance (existante ou nouvelle) ─────────────────────

  const renderSeanceRow = (seance: SeanceRow, isNew = false) => {
  const edits = isNew ? seance : (editedSeances[seance.id] ?? {})
  const hasChanges = isNew || Object.keys(editedSeances[seance.id] ?? {}).length > 0
  const isSaving = seanceSaving[seance.id] ?? false

  // Résolution des valeurs courantes (édition locale prioritaire)
  const date   = 'date_seance'          in edits ? edits.date_seance          : seance.date_seance
  const jour   = 'jour_seance'          in edits ? edits.jour_seance          : seance.jour_seance
  const heure  = 'heure_debut_reelle'   in edits ? edits.heure_debut_reelle   : seance.heure_debut_reelle ?? ''
  const duree  = 'duree_reelle_minutes' in edits ? edits.duree_reelle_minutes : seance.duree_reelle_minutes ?? ''
  const statut = edits.statut ?? seance.statut ?? 'planifiee'

  // Exclusivité mutuelle
  const dateDisabled = !!jour   // un jour est sélectionné → date désactivée
  const jourDisabled = !!date   // une date est saisie    → jour désactivé

  const onChange = (field: keyof SeanceRow, value: any) =>
    isNew
      ? handleNewSeanceFieldChange(seance.id, field, value)
      : handleSeanceFieldChange(seance.id, field, value)

  return (
    <tr key={seance.id} className={`border-b border-neutral-100 hover:bg-neutral-50 transition ${isNew ? 'bg-indigo-50' : ''}`}>

      {/* ── Date ── */}
      <td className="px-3 py-2">
        <input
          type="date"
          value={date ?? ''}
          disabled={dateDisabled}
          onChange={e => {
            onChange('date_seance', e.target.value || null)
            // Si on tape une date, on efface le jour
            if (e.target.value) onChange('jour_seance', null)
          }}
          className={`form-input text-sm w-full min-w-[130px] transition ${
            dateDisabled ? 'opacity-40 cursor-not-allowed bg-neutral-100' : ''
          }`}
          title={dateDisabled ? 'Désactivé car un jour récurrent est sélectionné' : ''}
        />
      </td>

      {/* ── Jour de séance (récurrent) ── */}
      <td className="px-3 py-2">
        <select
          value={jour ?? ''}
          disabled={jourDisabled}
          onChange={e => {
            onChange('jour_seance', e.target.value || null)
            // Si on choisit un jour, on efface la date
            if (e.target.value) onChange('date_seance', null)
          }}
          className={`form-select text-sm w-full min-w-[120px] transition ${
            jourDisabled ? 'opacity-40 cursor-not-allowed bg-neutral-100' : ''
          }`}
          title={jourDisabled ? 'Désactivé car une date précise est saisie' : ''}
        >
          {JOURS_SEANCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>

      {/* ── Heure début ── */}
      <td className="px-3 py-2">
        <input
          type="time"
          value={heure ?? ''}
          onChange={e => onChange('heure_debut_reelle', e.target.value)}
          className="form-input text-sm w-28"
        />
      </td>

      {/* ── Durée ── */}
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={5}
          value={duree ?? ''}
          placeholder="min"
          onChange={e => onChange('duree_reelle_minutes', parseInt(e.target.value) || null)}
          className="form-input text-sm w-20"
        />
      </td>

      {/* ── Statut ── */}
      <td className="px-3 py-2">
        <select
          value={statut}
          onChange={e => onChange('statut', e.target.value)}
          className="form-select text-sm w-full min-w-[120px]"
        >
          {STATUT_SEANCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>

      {/* ── Actions ── */}
      <td className="px-3 py-2">
        <div className="flex gap-1">
          {isNew ? (
            <>
              <button
                onClick={() => handleSaveNewSeance(seance.id)}
                disabled={isSaving}
                className="text-xs bg-success-600 text-white px-2 py-1 rounded hover:bg-success-700 transition disabled:opacity-50"
              >
                {isSaving ? '…' : '✅'}
              </button>
              <button
                onClick={() => handleCancelNewSeance(seance.id)}
                className="text-xs bg-neutral-200 text-neutral-700 px-2 py-1 rounded hover:bg-neutral-300 transition"
              >
                ✕
              </button>
            </>
          ) : hasChanges ? (
            <>
              <button
                onClick={() => handleSaveSeance(seance.id)}
                disabled={isSaving}
                className="text-xs bg-success-600 text-white px-2 py-1 rounded hover:bg-success-700 transition disabled:opacity-50"
              >
                {isSaving ? '…' : '✅ OK'}
              </button>
              <button
                onClick={() => handleCancelSeanceEdit(seance.id)}
                className="text-xs bg-neutral-200 text-neutral-700 px-2 py-1 rounded hover:bg-neutral-300 transition"
              >
                ✕
              </button>
            </>
          ) : (
            <span className={`text-xs px-2 py-1 rounded-full ${statutSeanceBadge(seance.statut)}`}>
              {STATUT_SEANCE_OPTIONS.find(o => o.value === seance.statut)?.label || seance.statut || '-'}
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

  // ─── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">📚 Mes Classes</h1>
        <input
          type="search"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input w-64 max-w-full"
        />
      </div>

      <DataTable<Class>
        data={classesData?.results || []}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="Aucune classe assignée"
      />

      {/* ── Modal élèves ───────────────────────────────────────────────────────── */}
      {studentsModal.open && (
        <Modal
          onClose={() => { setStudentsModal({ open: false, classId: null }); setEditedStudents({}) }}
          title="👥 Élèves de la classe"
          size="lg"
        >
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {studentsLoading ? (
              <div className="text-center py-8 text-neutral-500">Chargement...</div>
            ) : studentsData?.results?.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">Aucun élève inscrit</div>
            ) : (
              studentsData?.results?.map((inscription: Inscription) => {
                const student = inscription.eleve as User
                const studentId = student?.id
                if (!studentId) return null
                const isEditing = editedStudents[studentId] !== undefined
                const currentName = isEditing ? editedStudents[studentId] : student.display_name || student.nom_complet || 'Sans nom'

                return (
                  <div key={studentId} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition group">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-sm flex-shrink-0">
                        {(student.display_name || student.nom_complet || '?').charAt(0).toUpperCase()}
                      </div>
                      {isEditing ? (
                        <input
                          value={currentName}
                          onChange={e => setEditedStudents(prev => ({ ...prev, [studentId]: e.target.value }))}
                          className="form-input text-sm flex-1 min-w-0"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveStudent(studentId)
                            if (e.key === 'Escape') setEditedStudents(prev => { const p = { ...prev }; delete p[studentId]; return p })
                          }}
                        />
                      ) : (
                        <span
                          className="text-sm font-medium text-neutral-800 cursor-pointer hover:text-primary-600 truncate"
                          onClick={() => handleStudentEdit(studentId, student.display_name || student.nom_complet || '')}
                          title="Cliquer pour modifier le nom"
                        >
                          {currentName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {isEditing && (
                        <button onClick={() => handleSaveStudent(studentId)} className="text-xs bg-success-600 text-white px-2 py-1 rounded hover:bg-success-700 transition">
                          ✅
                        </button>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${inscription.statut_inscription === 'actif' ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-600'}`}>
                        {inscription.statut_inscription || 'Inscrit'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-200 flex justify-end">
            <button onClick={() => { setStudentsModal({ open: false, classId: null }); setEditedStudents({}) }} className="btn btn-secondary">
              Fermer
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal séances ──────────────────────────────────────────────────────── */}
      {seancesModal.open && (
        <Modal
          onClose={() => { setSeancesModal({ open: false, classId: null, className: '' }); setNewSeances([]); setEditedSeances({}) }}
          title={`📅 Séances — ${seancesModal.className}`}
          size="xl"
        >
          <div className="space-y-4">
            {/* Bouton Ajouter créneau */}
            <div className="flex justify-end">
              <button
                onClick={handleAddSeance}
                className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition flex items-center gap-2"
              >
                + Ajouter un créneau
              </button>
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              {seancesLoading ? (
                <div className="text-center py-10 text-neutral-500">Chargement des séances...</div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b-2 border-neutral-200">
                      <th className="text-left px-3 py-2 text-neutral-600 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 text-neutral-600 font-semibold">Jour récurrent</th>  {/* ← nouveau */}
                      <th className="text-left px-3 py-2 text-neutral-600 font-semibold">Heure début</th>
                      <th className="text-left px-3 py-2 text-neutral-600 font-semibold">Durée (min)</th>
                      <th className="text-left px-3 py-2 text-neutral-600 font-semibold">Statut</th>
                      <th className="text-left px-3 py-2 text-neutral-600 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Nouvelles lignes en attente */}
                    {newSeances.map(s => renderSeanceRow(s, true))}

                    {/* Séances existantes */}
                    {seancesData?.results?.length === 0 && newSeances.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-neutral-400">
                          Aucune séance pour cette classe.<br />
                          <span className="text-indigo-500 cursor-pointer hover:underline" onClick={handleAddSeance}>
                            Ajouter le premier créneau →
                          </span>
                        </td>
                      </tr>
                    ) : (
                      seancesData?.results?.map((s: SeanceRow) => renderSeanceRow(s, false))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-neutral-200 flex justify-between items-center">
            <span className="text-xs text-neutral-400">
              {seancesData?.results?.length ?? 0} séance(s) enregistrée(s)
            </span>
            <button
              onClick={() => { setSeancesModal({ open: false, classId: null, className: '' }); setNewSeances([]); setEditedSeances({}) }}
              className="btn btn-secondary"
            >
              Fermer
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}