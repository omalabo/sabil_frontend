import { useState,useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { useGetClassesQuery, usePauseClassMutation, useGetUsersQuery,useGetUserQuery } from '../../store/apiSlice'
import DataTable from '../../components/shared/DataTable'
import StatusBadge from '../../components/shared/StatusBadge'
import { Class } from '../../types'
import api from '../../config/axios'

export default function DirectionProfesseurClasses() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAppSelector(selectAuth)
  
  const [search, setSearch] = useState('')
  
  // 🆕 États pour la création de classe
  const [showCreateClass, setShowCreateClass] = useState(false)

  const [classForm, setClassForm] = useState({
    nom: '',
    programme: '',
    niveau: '',
    taux_horaire: '',
    statut: 'active' as const,
    admin:'',
  })
  

  // Ajouter la query pour récupérer les admins
  const { data: adminsData } = useGetUsersQuery({ role: 'admin', page: 1 })
  const admins = adminsData?.results || []
  
  const {  data: classesData, isLoading, refetch } = useGetClassesQuery({ 
    page: 1, 
    search,
    professeur_id: id  // ← Filtre par ce professeur (backend doit le supporter)
  })


    // ✅ NOUVEAU : Récupère le profil DU professeur (objet direct)
  const { data: profData, isLoading: profLoading } = useGetUserQuery(id!, {
    skip: !id  // ← Ne pas fetch si pas d'ID
  })

  // ✅ EFFET : Pré-remplir l'admin QUAND profData est chargé
  useEffect(() => {
    if (profData?.admin_id) {
      setClassForm(prev => ({
        ...prev,
        admin: profData.admin_id
      }))
    }
  }, [profData])  // ← Important : dépendance sur profData
  
  const [pauseClass] = usePauseClassMutation()

  const profClasses = classesData?.results || []

  // 🆕 Fonction de création de classe
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    // ✅ Validation : un admin doit être assigné
    if (!classForm.admin) {
      alert('⚠️ Ce professeur n\'a pas d\'admin assigné. Contactez la direction.')
      return
    }
    try {
      await api.post('/classes/', {  // ← Endpoint DRF (sans /api/ prefix grâce au proxy Vite)
        ...classForm,
        professeur: id,              // ← Assigner automatiquement à ce professeur
        admin: classForm.admin,  // ✅ déjà dans classForm via le spread, mais explicite c'est plus clair
        created_by: user?.id,
        jitsi_room_id: `sabil-${id}-${Date.now()}`,
        creneau_confirme_prof: true  // ← Confirmé par défaut car créé par Direction
      })
      setShowCreateClass(false)
      setClassForm({
        nom: '', programme: '', niveau: '', taux_horaire: '',
        statut: 'active',
        admin: '',  // ✅ reset aussi
      })
      refetch()
      alert('✅ Classe créée avec succès !')
    } catch (err: any) {
      console.error(err.response?.data) // ← Affiche l'erreur détaillée dans la console
      alert(err.response?.data?.nom?.[0] || err.response?.data?.professeur?.[0] || 'Erreur lors de la création')
      //console.error(err)
      //alert(err.response?.data?.error || err.response?.data?.non_field_errors?.[0] || 'Erreur lors de la création')
    }
  }

  const handleAction = async (classId: string, action: 'pause' | 'flag' | 'delete') => {
    try {
      if (action === 'pause') {
        await pauseClass(classId).unwrap()
      } else if (action === 'flag') {
        await api.post(`/classes/${classId}/flag-delete/`)
      } else if (action === 'delete') {
        if (confirm('⚠️ Supprimer DÉFINITIVEMENT cette classe ?')) {
          await api.delete(`/classes/${classId}/delete-permanently/`)
        }
      }
      refetch()
    } catch (err) { 
      console.error('Action failed', err) 
    }
  }

  const columns = [
    { 
      key: 'nom', 
      label: 'Classe', 
      sortable: true,
      render: (c: Class) => (
        <div>
          <p className="font-medium text-neutral-900">{c.nom}</p>
          <p className="text-xs text-neutral-500">{c.programme || '-'}</p>
        </div>
      )
    },
    { 
      key: 'programme', 
      label: 'Programme/Niveau',
      render: (c: Class) => (
        <span className="text-sm text-neutral-600">
          {c.programme || '-'} • {c.niveau || '-'}
        </span>
      )
    },
    { 
      key: 'creneau', 
      label: 'Créneau',
      render: (c: Class) => {
        const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        const jour = c.jour_semaine ? jours[c.jour_semaine - 1] : '-'
        return (
          <span className="text-sm font-mono">
            {jour} {c.heure_debut?.substring(0, 5) || '-'}
          </span>
        )
      }
    },
    { 
      key: 'eleves', 
      label: 'Élèves',
      render: (c: Class) => (
        <span className="text-sm">{c.nb_inscrits || 0} inscrit(s)</span>
      )
    },
    { 
      key: 'statut', 
      label: 'Statut',
      render: (c: Class) => (
        <StatusBadge status={c.statut} color={c.couleur} />
      )
    },
    { 
      key: 'actions', 
      label: 'Actions',
      render: (c: Class) => (
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => navigate(`/direction/classe/${c.id}`)}
            className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded hover:bg-primary-200 whitespace-nowrap"
          >
            👁️ Détails
          </button>
          <button 
            onClick={() => handleAction(c.id, 'pause')}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap transition-colors ${
              c.couleur === 'orange' 
                ? 'bg-success-100 text-success-700 hover:bg-success-200' 
                : 'bg-warning-100 text-warning-700 hover:bg-warning-200'
            }`}
          >
            {c.couleur === 'orange' ? '✅ Reprendre' : '⏸️ Pause'}
          </button>
          <button 
            onClick={() => handleAction(c.id, 'flag')}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap transition-colors ${
              c.couleur === 'rouge' 
                ? 'bg-neutral-200 text-neutral-600 cursor-not-allowed' 
                : 'bg-danger-100 text-danger-700 hover:bg-danger-200'
            }`}
            disabled={c.couleur === 'rouge'}
          >
            🚩 Supprimer
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">📚 Classes du Professeur</h1>
          <p className="text-sm text-neutral-600 mt-1">ID: {id?.substring(0, 8)}...</p>
        </div>
        <button 
          onClick={() => navigate(-1)} 
          className="text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
        >
          ← Retour
        </button>
      </div>

      {/* 🆕 Bouton Créer une classe */}
      <div className="flex justify-between items-center">
        <input 
          type="search" 
          placeholder="Rechercher une classe..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="form-input w-64" 
        />
        <button 
          onClick={() => setShowCreateClass(true)}
          className="btn-primary flex items-center gap-2"
        >
          ➕ Créer une classe
        </button>
      </div>

      {/* 🆕 Formulaire modal de création */}
      {showCreateClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form 
            onSubmit={handleCreateClass} 
            className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
          >
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              ➕ Nouvelle classe pour ce professeur
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nom de la classe *</label>
                <input
                  type="text"
                  placeholder="Ex: ABD20, Loub1..."
                  value={classForm.nom}
                  onChange={e => setClassForm({...classForm, nom: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Programme</label>
                <input
                  type="text"
                  placeholder="Ex: Arabe mouqadima ba"
                  value={classForm.programme}
                  onChange={e => setClassForm({...classForm, programme: e.target.value})}
                  className="form-input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Niveau</label>
                <input
                  type="text"
                  placeholder="Ex: Débutant, Intermédiaire..."
                  value={classForm.niveau}
                  onChange={e => setClassForm({...classForm, niveau: e.target.value})}
                  className="form-input"
                />
              </div>
              
              
              
          

              
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Taux horaire (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={classForm.taux_horaire}
                  onChange={e => setClassForm({...classForm, taux_horaire: e.target.value})}
                  className="form-input"
                  placeholder="Ex: 15.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Admin responsable
                </label>
                
                <div className="relative">
                  <input
                    type="text"
                    value={
                      profLoading 
                        ? 'Chargement...' 
                        : profData?.admin_nom 
                          ? `${profData.admin_nom}` 
                          : profData?.admin_id 
                            ? 'Admin assigné' 
                            : 'Aucun admin'
                    }
                    readOnly
                    className="form-input bg-neutral-50 text-neutral-600 cursor-not-allowed pr-10"
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                
                {/* Message d'aide contextuel */}
                {!classForm.admin && (
                  <p className="mt-1 text-xs text-warning-600 bg-warning-50 px-2 py-1 rounded">
                    ⚠️ Ce professeur n'a pas d'admin assigné. 
                    <button 
                      onClick={() => navigate(`/direction/professeurs`)}
                      className="underline ml-1 hover:text-warning-700"
                    >
                      Lui en assigner un →
                    </button>
                  </p>
                )}
              </div>
          </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-neutral-200 mt-6">
              <button 
                type="button" 
                onClick={() => setShowCreateClass(false)}
                className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button type="submit" className="btn-primary">
                ✅ Créer la classe
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-sm text-neutral-500">
          {profClasses.length} classe(s) trouvée(s)
        </span>
      </div>

      <DataTable<Class> 
        data={profClasses} 
        columns={columns} 
        isLoading={isLoading} 
        emptyMessage="Aucune classe trouvée pour ce professeur. Cliquez sur ➕ pour en créer une." 
      />

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <p className="text-sm text-primary-800">
          💡 <strong>Info Direction :</strong> Vous pouvez mettre en pause, signaler ou supprimer définitivement les classes de ce professeur.
        </p>
      </div>
    </div>
  )
}