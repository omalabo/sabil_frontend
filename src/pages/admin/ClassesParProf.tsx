import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGetClassesQuery, usePauseClassMutation } from '../../store/apiSlice'
import DataTable from '../../components/shared/DataTable'
import StatusBadge from '../../components/shared/StatusBadge'
import { Class } from '../../types'

export default function AdminClassesParProf() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const { data: classesData, isLoading, refetch } = useGetClassesQuery({ page: 1, search })
  const [pauseClass] = usePauseClassMutation()

  const columns = [
    { key: 'nom', label: 'Classe', sortable: true },
    { key: 'programme', label: 'Programme' },
    { key: 'creneau', label: 'Créneau', render: (c: Class) => <span className="text-sm">{c.jour_semaine} {c.heure_debut?.substring(0,5)}</span> },
    { key: 'absences', label: 'Absences Élèves', render: () => <span className="text-sm text-neutral-600">2</span> },
    { key: 'paiement', label: 'Paiement', render: () => <span className="text-sm text-warning-600">⚠️ En retard</span> },
    { key: 'statut', label: 'Statut', render: (c: Class) => <StatusBadge status={c.statut} color={c.couleur} /> },
    { key: 'actions', label: 'Actions', render: (c: Class) => (
      <div className="flex gap-2">
        <button onClick={() => navigate(`/admin/classe/${c.id}/surveillance`)} className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200">👁️ Surveiller</button>
        <button onClick={async () => { await pauseClass(c.id).unwrap(); refetch() }} className="text-xs bg-warning-100 text-warning-700 px-2 py-1 rounded hover:bg-warning-200">⏸️ Pause</button>
        <button onClick={() => alert('Signalé à la direction')} className="text-xs bg-danger-100 text-danger-700 px-2 py-1 rounded hover:bg-danger-200">🗑️ Supprimer</button>
      </div>
    )}
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">📋 Classes du Professeur</h1>
      <div className="flex justify-between">
        <input type="search" placeholder="Rechercher classe..." value={search} onChange={e => setSearch(e.target.value)} className="form-input w-64" />
      </div>
      <DataTable<Class> data={classesData?.results || []} columns={columns} isLoading={isLoading} emptyMessage="Aucune classe" />
    </div>
  )
}