import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { useGetUsersQuery } from '../../store/apiSlice'
import { User } from '../../types'

export default function AdminProfesseurs() {
  const { user } = useAppSelector(selectAuth)
  const navigate = useNavigate()
  const { data: usersData, isLoading } = useGetUsersQuery({ role: 'professeur', page: 1 }, { skip: user?.role !== 'admin' })
  const [selectedProf, setSelectedProf] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const profs = (usersData?.results || []).filter((u: User) => 
    u.display_name?.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">👨‍🏫 Professeurs Assignés</h1>
      <input type="search" placeholder="Rechercher un professeur..." value={search} onChange={e => setSearch(e.target.value)} className="form-input max-w-md" />
      <div className="flex flex-wrap gap-2">
        {profs.map(p => (
          <button key={p.id} onClick={() => setSelectedProf(p.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedProf === p.id ? 'bg-primary-600 text-white' : 'bg-white border border-neutral-200 hover:bg-neutral-50'}`}>
            {p.display_name || p.email}
          </button>
        ))}
      </div>
      {selectedProf ? (
        <div className="bg-white p-6 rounded-lg border border-neutral-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Classes de {profs.find(p => p.id === selectedProf)?.display_name}</h2>
            <button onClick={() => navigate(`/admin/professeur/${selectedProf}/classes`)} className="btn-primary">📋 Voir le tableau complet</button>
          </div>
          <p className="text-sm text-neutral-500">Sélectionnez "Voir le tableau complet" pour accéder aux fonctionnalités de surveillance, pause et suppression.</p>
        </div>
      ) : (
        <div className="text-center py-12 text-neutral-500">Sélectionnez un professeur pour voir ses classes</div>
      )}
    </div>
  )
}