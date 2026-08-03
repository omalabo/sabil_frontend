import { useState } from 'react'
import {
  useGetCatalogueCoursQuery,
  useCreateCoursMutation,
  useUpdateCoursMutation,
  useDeleteCoursMutation,
} from '../../store/apiSlice'
import DataTable from '../../components/shared/DataTable'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Cours {
  id: string
  nom: string
  description: string | null
  niveau: number | null
  created_at: string
}

type CoursEdits = Partial<Pick<Cours, 'nom' | 'description' | 'niveau'>>

const NIVEAUX = [1, 2, 3, 4, 5, 6]

// ─── Component ────────────────────────────────────────────────────────────────
export default function CatalogueCours() {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingEdits, setPendingEdits] = useState<Record<string, CoursEdits>>({})

  // Queries
  const { data: coursData, isLoading, refetch } = useGetCatalogueCoursQuery({
    search: search || undefined,
  })

  // Mutations
  const [createCours] = useCreateCoursMutation()
  const [updateCours] = useUpdateCoursMutation()
  const [deleteCours] = useDeleteCoursMutation()

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const startEdit = (cours: Cours) => {
    if (editingId) cancelEdit(editingId)
    setEditingId(cours.id)
    setPendingEdits(prev => ({ ...prev, [cours.id]: { ...cours } }))
  }

  const handleFieldChange = (id: string, field: keyof CoursEdits, value: string | number | null) => {
    setPendingEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  const cancelEdit = (id: string) => {
    setEditingId(null)
    setPendingEdits(prev => {
      const { [id]: _, ...rest } = prev
      return rest
    })
  }

  const handleSave = async (id: string) => {
    const edits = pendingEdits[id]
    if (!edits?.nom?.trim()) {
      alert('Le nom du cours est requis.')
      return
    }

    try {
      if (id === '__new__') {
        await createCours(edits).unwrap()
      } else {
        await updateCours({ id, ...edits }).unwrap()
      }
      cancelEdit(id)
      refetch()
    } catch (err: any) {
      alert(`Erreur : ${err?.data?.detail || 'Échec de la mise à jour'}`)
    }
  }

  const handleDelete = async (cours: Cours) => {
    if (!confirm(`Supprimer le cours "${cours.nom}" ?`)) return
    try {
      await deleteCours(cours.id).unwrap()
      refetch()
    } catch (err: any) {
      alert(`Erreur : ${err?.data?.detail || 'Échec de la suppression'}`)
    }
  }

  // ─── Add new row (appended at top of list) ──────────────────────────────────

  const handleAddNew = () => {
    if (editingId) return
    const newId = '__new__'
    setEditingId(newId)
    setPendingEdits(prev => ({
      ...prev,
      [newId]: { nom: '', description: '', niveau: null },
    }))
  }

  // ─── Local list: prepend virtual "__new__" row when adding ──────────────────

  const rows: Cours[] = editingId === '__new__'
    ? [
        { id: '__new__', nom: '', description: null, niveau: null, created_at: new Date().toISOString() },
        ...(coursData?.results ?? []),
      ]
    : (coursData?.results ?? [])

  // ─── Columns ─────────────────────────────────────────────────────────────────

  const columns = [
    {
      key: 'nom',
      label: 'Nom',
      render: (c: Cours) => {
        const isEditing = editingId === c.id
        const ed = pendingEdits[c.id] ?? c
        return isEditing ? (
          <input
            autoFocus
            className="form-input text-sm w-full"
            value={ed.nom ?? ''}
            placeholder="Nom du cours *"
            onChange={e => handleFieldChange(c.id, 'nom', e.target.value)}
          />
        ) : (
          <div>
            <p
              className="font-medium text-neutral-900 cursor-pointer hover:text-primary-600 hover:underline"
              title="Cliquer pour modifier"
              onClick={() => startEdit(c)}
            >
              {c.nom}
            </p>
            <p className="text-xs text-neutral-400 font-mono">{c.id.slice(0, 8)}…</p>
          </div>
        )
      },
    },
    {
      key: 'description',
      label: 'Description',
      render: (c: Cours) => {
        const isEditing = editingId === c.id
        const ed = pendingEdits[c.id] ?? c
        return isEditing ? (
          <textarea
            className="form-input text-sm w-full resize-y min-h-[56px]"
            value={ed.description ?? ''}
            placeholder="Description (optionnel)"
            onChange={e => handleFieldChange(c.id, 'description', e.target.value)}
          />
        ) : (
          <span
            className={`text-sm block max-w-xs truncate ${
              c.description ? 'text-neutral-600' : 'text-neutral-400 italic'
            }`}
            title={c.description ?? ''}
          >
            {c.description ?? 'Aucune description'}
          </span>
        )
      },
    },
    {
      key: 'niveau',
      label: 'Niveau',
      render: (c: Cours) => {
        const isEditing = editingId === c.id
        const ed = pendingEdits[c.id] ?? c
        return isEditing ? (
          <select
            className="form-select text-sm w-28"
            value={ed.niveau ?? ''}
            onChange={e =>
              handleFieldChange(c.id, 'niveau', e.target.value === '' ? null : Number(e.target.value))
            }
          >
            <option value="">—</option>
            {NIVEAUX.map(n => (
              <option key={n} value={n}>
                Niveau {n}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              c.niveau != null
                ? 'bg-primary-100 text-primary-700'
                : 'bg-neutral-100 text-neutral-400'
            }`}
          >
            {c.niveau != null ? `Niveau ${c.niveau}` : '—'}
          </span>
        )
      },
    },
    {
      key: 'created_at',
      label: 'Créé le',
      render: (c: Cours) =>
        c.id === '__new__' ? (
          <span className="text-neutral-400 text-xs italic">—</span>
        ) : (
          <span className="text-xs font-mono text-neutral-400">
            {new Date(c.created_at).toLocaleDateString('fr-FR')}
          </span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (c: Cours) => {
        const isEditing = editingId === c.id
        return (
          <div className="flex gap-2 items-center flex-wrap">
            {isEditing ? (
              <>
                <button
                  onClick={() => handleSave(c.id)}
                  className="text-xs bg-success-600 text-white px-2 py-1 rounded hover:bg-success-700 transition flex items-center gap-1"
                >
                  ✅ OK
                </button>
                <button
                  onClick={() => cancelEdit(c.id)}
                  className="text-xs bg-neutral-200 text-neutral-700 px-2 py-1 rounded hover:bg-neutral-300 transition"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEdit(c)}
                  className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="text-xs bg-danger-100 text-danger-700 px-2 py-1 rounded hover:bg-danger-200"
                >
                  🗑️ Supprimer
                </button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900">📚 Catalogue des Cours</h1>
        <span className="text-sm text-neutral-500">{coursData?.count ?? 0} cours</span>
      </div>

      <div className="flex gap-3 items-center">
        <input
          type="search"
          placeholder="Rechercher un cours..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input max-w-md"
        />
        <button
          onClick={handleAddNew}
          disabled={!!editingId}
          className="text-sm bg-primary-600 text-white px-3 py-2 rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          ＋ Ajouter un cours
        </button>
      </div>

      <DataTable<Cours>
        data={rows}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="Aucun cours trouvé"
      />
    </div>
  )
}