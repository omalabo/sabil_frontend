import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { useGetClassesQuery } from '../../store/apiSlice'
import DataTable from '../../components/shared/DataTable'
import StatusBadge from '../../components/shared/StatusBadge'
import { Class } from '../../types'

/**
 * 👤 Espace Élève : Page "Mes Classes"
 * 
 * Affiche un tableau des classes de l'élève avec :
 * - Nom, programme, prof, créneau, statut couleur
 * - Actions : rejoindre classe, voir chat, accès support/devoirs
 * - Filtres et recherche
 */
export default function EleveClasses() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const navigate = useNavigate()
  const { user } = useAppSelector(selectAuth)

  // 📡 Fetch des classes avec pagination
  const { data: classesData, isLoading, refetch } = useGetClassesQuery({
    page: 1,
    search: searchTerm || undefined,
  }, {
    skip: !user,
  })

  const classes = classesData?.results || []

  // 🔍 Filtrage côté frontend (complément à la recherche API)
  const filteredClasses = classes.filter((classe: Class) => {
    if (filterStatus === 'all') return true
    return classe.statut === filterStatus
  })

  // 📋 Définition des colonnes du tableau
  const columns = [
    {
      key: 'nom',
      label: 'Classe',
      sortable: true,
      render: (c: Class) => (
        <div className="font-medium text-neutral-900">{c.nom}</div>
      ),
    },
    {
      key: 'programme',
      label: 'Programme',
      render: (c: Class) => (
        <span className="text-sm text-neutral-600">{c.programme || '-'}</span>
      ),
    },
    {
      key: 'professeur',
      label: 'Professeur',
      render: (c: Class) => (
        <span className="text-sm">{c.professeur?.display_name || '-'}</span>
      ),
    },
    {
      key: 'creneau',
      label: 'Créneau',
      render: (c: Class) => {
        const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
        const jour = c.jour_semaine ? jours[c.jour_semaine - 1] : '-'
        return (
          <span className="text-sm">
            {jour} {c.heure_debut?.substring(0, 5) || '-'}
          </span>
        )
      },
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (c: Class) => (
        <StatusBadge status={c.statut} color={c.couleur} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (c: Class) => (
        <div className="flex items-center gap-2">
          {/* 🎥 Rejoindre la salle de cours */}
          <button
            onClick={() => navigate(`/eleve/classe/${c.id}`)}
            className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded-lg transition-colors"
            disabled={c.statut !== 'actif'}
            title={c.statut !== 'actif' ? 'Classe non active' : 'Rejoindre le cours'}
          >
            {c.statut === 'actif' ? '🎥 Rejoindre' : '⏸️ En pause'}
          </button>
          
          {/* 💬 Accès rapide au chat */}
          <button
            onClick={() => navigate(`/eleve/classe/${c.id}?tab=chat`)}
            className="p-1.5 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 rounded transition-colors"
            title="Voir le chat de la classe"
          >
            💬
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* 🏷️ En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">📚 Mes Classes</h1>
        <p className="text-neutral-600 mt-1">
          Retrouvez toutes vos classes et accédez aux cours en direct
        </p>
      </div>

      {/* 🔍 Barre de filtres */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-lg border border-neutral-200">
        
        {/* Recherche */}
        <div className="relative w-full sm:w-64">
          <input
            type="search"
            placeholder="Rechercher une classe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input pl-10"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
        </div>

        {/* Filtre statut */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">Statut :</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="form-input w-auto py-1.5"
          >
            <option value="all">Tous</option>
            <option value="actif">Actives</option>
            <option value="en_pause">En pause</option>
            <option value="fin_session">Terminées</option>
          </select>
        </div>

        {/* 🔄 Bouton rafraîchir */}
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-sm transition-colors"
          title="Rafraîchir la liste"
        >
          🔄 Actualiser
        </button>
      </div>

      {/* 📊 Tableau des classes */}
      <DataTable<Class>
        data={filteredClasses}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="Vous n'êtes inscrit à aucune classe pour le moment"
        onRowClick={(classe) => navigate(`/eleve/classe/${classe.id}`)}
      />

      {/* ℹ️ Note pédagogique */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <p className="text-sm text-primary-800">
          💡 <strong>Le saviez-vous ?</strong> Vous pouvez accéder à l'historique complet des conversations 
          même si vous rejoignez une classe en cours d'année. Tous les messages, supports et devoirs 
          sont conservés pour votre suivi pédagogique.
        </p>
      </div>
    </div>
  )
}