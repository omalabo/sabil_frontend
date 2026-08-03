import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useGetUsersQuery, useCreateUserMutation, useResetUserPasswordMutation,useReactivateUserMutation } from '../../store/apiSlice'
import DataTable from '../../components/shared/DataTable'
import { User } from '../../types'
import api from '../../config/axios'

export default function DirectionGestionComptes() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  // Formulaire de création/édition
  const [form, setForm] = useState({
    email: '',
    role: 'eleve',
    display_name: '',
    nom_diplome: '',
    nom_parent: '',
    telephone: '',
    indicatif: '',
    lien_paypal: '',
    rib: '',
    code_prof: '',
    homme_femme: ''
  })
  
  const [reactivateUser] = useReactivateUserMutation()
  const [activeTab, setActiveTab] = useState<'actifs' | 'inactifs'>('actifs')

  const { data: usersData, isLoading, refetch } = useGetUsersQuery({ 
    page: 1,
    search: search || undefined,
    role: roleFilter === 'all' ? undefined : roleFilter,
    is_active: activeTab === 'actifs'
  })
  const [createUser] = useCreateUserMutation()
  const [resetPw] = useResetUserPasswordMutation()

  // 🔍 Détecter les paramètres d'édition dans l'URL
  const editId = searchParams.get('edit')
  const editRole = searchParams.get('role')
  const [addParent, setAddParent] = useState(false)
  // Charger les données de l'utilisateur à éditer
  useEffect(() => {
    if (editId) {
      const userToEdit = usersData?.results?.find((u: User) => u.id === editId)
      if (userToEdit) {
        setEditingUser(userToEdit)
        setForm({
          email: userToEdit.email,
          role: userToEdit.role,
          display_name: userToEdit.display_name || '',
          nom_diplome: userToEdit.nom_diplome || '',
          nom_parent: userToEdit.nom_parent || '',          // 👈 nouveau
          telephone: userToEdit.telephone || '',
          indicatif: userToEdit.indicatif,
          lien_paypal: userToEdit.lien_paypal || '',         // 👈 nouveau
          rib: userToEdit.rib || '',                  // 👈 nouveau
          code_prof: userToEdit.code_prof || '',
          homme_femme: userToEdit.homme_femme || '',

        })
        setShowCreate(true)
      }
    }
  }, [editId, usersData])

  // Création d'un nouveau compte
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createUser(form).unwrap()
      setShowCreate(false)
      setForm({
        email: '',
        role: 'eleve',
        display_name: '',
        nom_diplome: '',
        nom_parent: '',
        telephone:'',
        indicatif:'',
        lien_paypal: '',
        rib: '',
        code_prof: '',
        homme_femme: ''
      })
      setAddParent(false)
      setSearchParams({}) // Nettoyer les paramètres URL
      refetch()
    } catch (err: any) {
      alert(err.data?.error || 'Erreur lors de la création')
    }
  }

  // Mise à jour d'un compte existant
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      // Appel API pour mettre à jour (tu devras créer cet endpoint si pas existant)
      await api.patch(`/users/${editingUser.id}/`, {
        display_name: form.display_name,
        nom_diplome: form.nom_diplome,
        role: form.role,
        telephone: form.telephone,
        indicatif: form.indicatif,
        lien_paypal: form.lien_paypal,
        rib: form.rib,
        code_prof: form.code_prof,
        homme_femme: form.homme_femme
      })
      
      setShowCreate(false)
      setEditingUser(null)
      setForm({
        email: '',
        role: 'eleve',
        display_name: '',
        nom_diplome: '',
        nom_parent: '',
        telephone:'',
        indicatif:'',
        lien_paypal: '',
        rib: '',
        code_prof: '',
        homme_femme: ''
      })
      setAddParent(false)
      setSearchParams({}) // Nettoyer les paramètres URL
      refetch()
      alert('Compte mis à jour avec succès')
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erreur lors de la mise à jour')
    }
  }

  // Réinitialisation mot de passe
  const handleReset = async (id: string) => {
    if (confirm('Réinitialiser le mot de passe à "sabil" ?')) {
      await resetPw(id).unwrap()
      refetch()
    }
  }

  const handleDelete = async (id: string) => {
  if (!confirm('Désactiver ce compte ?')) return

  try {
    await api.delete(`/users/${id}/`)
    refetch()
  } catch (err) {
    alert('Erreur lors de la désactivation')
  }
}

  // Annuler édition
  const handleCancel = () => {
    setShowCreate(false)
    setEditingUser(null)
    setForm({
      email: '',
      role: 'eleve',
      display_name: '',
      nom_diplome: '',
      nom_parent: '',
      telephone:'',
      indicatif:'',
      lien_paypal: '',
      rib: '',
      code_prof: '',
      homme_femme: ''
    })
    setAddParent(false)
    setSearchParams({})
  }



  // Colonnes du tableau
  const columns = [
    { 
      key: 'display_name', 
      label: 'Nom',
      render: (u: User) => (
        <div>
          <p className="font-medium text-neutral-900">{u.display_name || u.email}</p>
          {/* 👇 uniquement pour élève avec parent */}
            {u.role === 'eleve' && u.parent_email && (
              <p className="text-xs text-neutral-500">
                Adresse email parent : {u.parent_email}
              </p>
            )}
        </div>
      )
    },
    { key: 'email', label: 'Email', className: 'hidden md:table-cell' },
    { 
      key: 'role', 
      label: 'Rôle',
      render: (u: User) => (
        <span className={`px-2 py-0.5 rounded text-xs ${
          u.role === 'direction' ? 'bg-purple-100 text-purple-700' :
          u.role === 'admin' ? 'bg-blue-100 text-blue-700' :
          u.role === 'professeur' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {u.role}
        </span>
      )
    },
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
            onClick={() => {
              setSearchParams({ edit: u.id, role: u.role })
            }}
            className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200 transition-colors"
            title="Modifier"
          >
            ✏️
          </button>
          {/* <button 
            onClick={() => handleReset(u.id)}
            className="text-xs bg-warning-100 text-warning-700 px-2 py-1 rounded hover:bg-warning-200 transition-colors"
            title="Réinitialiser mot de passe"
          >
            🔑
          </button>
          <button 
            onClick={() => handleDelete(u.id)}
            className="text-xs bg-danger-100 text-danger-700 px-2 py-1 rounded hover:bg-danger-200 transition-colors"
          >
            🗑️
          </button> */}

            {u.is_active ? (
        <>
          <button onClick={() => handleReset(u.id)}>🔑</button>
          <button onClick={() => handleDelete(u.id)}>🗑️</button>
        </>
      ) : (
        <button
          onClick={async () => {
            await reactivateUser(u.id)
          }}
          className="text-xs bg-success-100 text-success-700 px-2 py-1 rounded"
        >
          ♻️ Réactiver
        </button>
      )}

        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-neutral-900">👥 Gestion des Comptes</h1>
        <button 
          onClick={() => {
            setEditingUser(null)
            setForm({
              email: '',
              role: 'eleve',
              display_name: '',
              nom_diplome: '',
              nom_parent: '',
              lien_paypal: '',
              rib: '',
              code_prof: '',
              homme_femme: ''
            })
            setShowCreate(true)
            setSearchParams({})
          }} 
          className="btn-primary"
        >
          ➕ Créer un compte
        </button>
      </div>
      
      {/* Formulaire Création/Édition */}
      {showCreate && (
        <form 
          onSubmit={editingUser ? handleUpdate : handleCreate} 
          className="bg-white p-6 rounded-lg border border-neutral-200 shadow-sm space-y-4"
        >
          <h2 className="text-lg font-semibold text-neutral-900">
            {editingUser ? '✏️ Modifier le compte' : '➕ Créer un nouveau compte'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Rôle *</label>
              <select 
                value={form.role} 
                onChange={e => setForm({...form, role: e.target.value})} 
                className="form-input"
                required
              >
                <option value="eleve">Élève</option>
                <option value="professeur">Professeur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email *</label>
              <input 
                type="email" 
                required 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                className="form-input" 
                disabled={!!editingUser} // Email non modifiable en édition
                placeholder="exemple@email.com"
              />
              {editingUser && (
                <p className="text-xs text-neutral-500 mt-1">L'email ne peut pas être modifié</p>
              )}
            </div>
            
            
            
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nom</label>
              <input 
                type="text" 
                value={form.display_name} 
                onChange={e => setForm({...form, display_name: e.target.value})} 
                className="form-input" 
                placeholder="Nom d'affichage"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Sexe
              </label>

              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="homme_femme"
                    value="homme"
                    checked={form.homme_femme === 'homme'}
                    onChange={(e) =>
                      setForm({ ...form, homme_femme: e.target.value })
                    }
                  />
                  Homme
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="homme_femme"
                    value="femme"
                    checked={form.homme_femme === 'femme'}
                    onChange={(e) =>
                      setForm({ ...form, homme_femme: e.target.value })
                    }
                  />
                  Femme
                </label>
              </div>
            </div>
            
            
            
            {form.role === 'eleve' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Nom sur diplôme
                </label>
                <input 
                  type="text"
                  value={form.nom_diplome}
                  onChange={e => setForm({...form, nom_diplome: e.target.value})}
                  className="form-input"
                />

                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Téléphone
                </label>

                <div className="flex gap-2">
                  <select
                    value={form.indicatif}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        indicatif: e.target.value
                      })
                    }
                    className="form-input w-32"
                  >
                    <option value="+227">🇳🇪 +227</option>
                    <option value="+221">🇸🇳 +221</option>
                    <option value="+223">🇲🇱 +223</option>
                    <option value="+225">🇨🇮 +225</option>
                    <option value="+226">🇧🇫 +226</option>
                    <option value="+228">🇹🇬 +228</option>
                    <option value="+229">🇧🇯 +229</option>
                    <option value="+33">🇫🇷 +33</option>
                  </select>

                  <input
                    type="tel"
                    value={form.telephone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        telephone: e.target.value
                      })
                    }
                    className="form-input flex-1"
                    placeholder="90 00 00 00"
                  />
                </div>

              </div>
              
            )}
            
            {form.role === 'eleve' && (
              
              <div className="space-y-2">
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="addParent"
                    checked={addParent}
                    onChange={(e) => setAddParent(e.target.checked)}
                  />

                  <label
                    htmlFor="addParent"
                    className="text-sm font-medium text-neutral-700"
                  >
                    Ajouter un parent
                  </label>
                </div>

                {addParent && (
                  <div>
                    <input
                      type="text"
                      value={form.nom_parent}
                      onChange={e =>
                        setForm({ ...form, nom_parent: e.target.value })
                      }
                      className="form-input"
                      placeholder="Nom du parent"
                    />
                  </div>
                )}
                
              </div>
            )}
            
            

            {form.role === 'professeur' && (
              <>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Code classe / Prof
                  </label>

                  <input
                    type="text"
                    value={form.code_prof}
                    onChange={e => setForm({...form, code_prof: e.target.value})}
                    className="form-input"
                    placeholder="ex: MATH-6A"
                  />
                </div>

                <div>
                  <label>Lien PayPal</label>
                  <input 
                    type="text"
                    value={form.lien_paypal}
                    onChange={e => setForm({...form, lien_paypal: e.target.value})}
                    className="form-input"
                  />
                </div>

                <div>
                  <label>RIB</label>
                  <textarea
                    value={form.rib}
                    onChange={e => setForm({...form, rib: e.target.value})}
                    className="form-input"
                  />
                </div>
              </>
            )}

          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <button 
              type="button" 
              onClick={handleCancel} 
              className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              {editingUser ? '💾 Mettre à jour' : '✅ Créer le compte'}
            </button>
          </div>
        </form>
      )}

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input 
          type="search" 
          placeholder="Rechercher par nom ou email..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="form-input w-full sm:w-64" 
        />
        <select 
          value={roleFilter} 
          onChange={e => setRoleFilter(e.target.value)} 
          className="form-input w-full sm:w-48"
        >
          <option value="all">Tous les rôles</option>
          <option value="eleve">Élèves</option>
          <option value="professeur">Professeurs</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('actifs')}
          className={`px-3 py-1 rounded ${activeTab === 'actifs' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}
        >
          Actifs
        </button>
        <button
          onClick={() => setActiveTab('inactifs')}
          className={`px-3 py-1 rounded ${activeTab === 'inactifs' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}
        >
          Inactifs
        </button>
      </div>

      {/* Tableau des comptes */}
      <DataTable<User> 
        data={usersData?.results || []} 
        columns={columns} 
        isLoading={isLoading} 
        emptyMessage="Aucun compte trouvé" 
      />
      
      <div className="text-sm text-neutral-500">
        Total: {usersData?.count || 0} compte(s)
      </div>
    </div>
  )
}