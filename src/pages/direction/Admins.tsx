import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGetUsersQuery, useResetUserPasswordMutation } from '../../store/apiSlice'
import DataTable from '../../components/shared/DataTable'
import { User } from '../../types'

export default function DirectionAdmins() {
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const navigate = useNavigate()
  const { data: usersData, isLoading, refetch } = useGetUsersQuery({ 
    role: 'admin', 
    page: 1, 
    search: search || undefined 
  })
  const [resetPw] = useResetUserPasswordMutation()

  const handleReset = async (id: string) => {
    if (confirm('Réinitialiser le mot de passe à "sabil" ?')) {
      await resetPw(id).unwrap()
      refetch()
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    // Ici tu pourrais ouvrir un modal ou naviguer vers une page d'édition
    navigate(`/direction/comptes?edit=${user.id}&role=admin`)
  }

  const columns = [
    { 
      key: 'display_name', 
      label: 'Nom affiché',
      render: (u: User) => (
        <div>
          <p className="font-medium">{u.display_name || u.email}</p>
          <p className="text-xs text-neutral-500">{u.email}</p>
        </div>
      )
    },
    { key: 'email', label: 'Email', className: 'hidden md:table-cell' },
    { 
      key: 'is_active', 
      label: 'Statut', 
      render: (u: User) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          u.is_active ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'
        }`}>
          {u.is_active ? 'Actif' : 'Inactif'}
        </span>
      )
    },
    { 
      key: 'created_at', 
      label: 'Créé le', 
      render: (u: User) => new Date(u.created_at).toLocaleDateString('fr-FR'),
      className: 'hidden lg:table-cell'
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (u: User) => (
        <div className="flex gap-2">
          <button 
            onClick={() => handleEdit(u)}
            className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200 transition-colors"
            title="Modifier"
          >
            ✏️
          </button>
          <button 
            onClick={() => handleReset(u.id)}
            className="text-xs bg-warning-100 text-warning-700 px-2 py-1 rounded hover:bg-warning-200 transition-colors"
            title="Réinitialiser mot de passe"
          >
            🔑
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900">🔧 Gestion des Administrateurs</h1>
        <span className="text-sm text-neutral-500">{usersData?.count || 0} administrateur(s)</span>
      </div>
      
      <input 
        type="search" 
        placeholder="Rechercher un admin..." 
        value={search} 
        onChange={e => setSearch(e.target.value)} 
        className="form-input w-full md:w-72" 
      />
      
      <DataTable<User> 
        data={usersData?.results || []} 
        columns={columns} 
        isLoading={isLoading} 
        emptyMessage="Aucun administrateur trouvé" 
      />
    </div>
  )
}