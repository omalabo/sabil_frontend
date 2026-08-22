import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { useGetSeanceJourQuery,useGetProfStatsQuery  } from '../../store/apiSlice'
import { SeancesToday } from '../../types/index'


export default function ProfDashboard() {
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)
  // RTK Query gère automatiquement le chargement, le cache et le re-fetch
  const { data: seancesToday = [], isLoading } =
  useGetSeanceJourQuery()
  const { data: stats, isLoading: statsLoading } = useGetProfStatsQuery()

  const handleStartClass = (classeId: string, seanceId: string) => {
    // Ouvre ClasseDetail avec la séance sélectionnée et l'onglet salle actif
    navigate(`/professeur/classe/${classeId}?seance_id=${seanceId}&tab=salle`)
  }

  const formatTime = (time: string | null) => time ? time.substring(0, 5) : '--:--'

  const getStatusBadge = (status: string | null) => {
    const map: Record<string, string> = {
      en_cours: 'bg-green-100 text-green-700 border-green-200',
      terminee: 'bg-neutral-100 text-neutral-600 border-neutral-200',
      planifiee: 'bg-blue-100 text-blue-700 border-blue-200',
    }
    return map[status ?? ''] ?? 'bg-neutral-50 text-neutral-500 border-neutral-200'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900"> Tableau de bord Professeur</h1>
      
      {/* Compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Classes actives */}
        <div className="bg-white p-5 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Classes actives</p>
          {statsLoading
            ? <div className="h-9 w-12 bg-neutral-100 rounded animate-pulse mt-1" />
            : <p className="text-3xl font-bold text-blue-600">{stats?.nb_classes_actives ?? '—'}</p>
          }
        </div>

        {/* Élèves inscrits */}
        <div className="bg-white p-5 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Élèves inscrits</p>
          {statsLoading
            ? <div className="h-9 w-12 bg-neutral-100 rounded animate-pulse mt-1" />
            : <p className="text-3xl font-bold text-emerald-600">{stats?.nb_inscrits ?? '—'}</p>
          }
        </div>

        {/* Factures envoyées */}
        <div className="bg-white p-5 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Factures envoyées</p>
          {statsLoading
            ? <div className="h-9 w-12 bg-neutral-100 rounded animate-pulse mt-1" />
            : <p className="text-3xl font-bold text-amber-600">{stats?.nb_factures_envoyees ?? '—'}</p>
          }
          <p className="text-xs text-neutral-400 mt-1">En attente de paiement</p>
        </div>

        {/* Factures payées */}
        <div className="bg-white p-5 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Factures payées</p>
          {statsLoading
            ? <div className="h-9 w-12 bg-neutral-100 rounded animate-pulse mt-1" />
            : <p className="text-3xl font-bold text-violet-600">{stats?.nb_factures_payees ?? '—'}</p>
          }
          {stats?.montant_total_paye != null && (
            <p className="text-xs text-neutral-400 mt-1">
              {Number(stats.montant_total_paye).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
          )}
        </div>

      </div>

      {/* 📅 Bloc Séances du Jour */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 bg-gradient-to-r from-blue-50 to-white">
          <h2 className="text-lg font-semibold text-neutral-900">Séances du jour</h2>
          <p className="text-sm text-neutral-500 mt-1">Gérez vos cours prévus aujourd'hui</p>
        </div>
        
        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="w-6 h-6 border-2 border-neutral-300 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : seancesToday.length === 0 ? (
            <p className="text-center text-neutral-500 py-6 italic">Aucune séance prévue aujourd'hui. Profitez de votre temps libre ! ☕</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
              {seancesToday.map(seance => (
                <div key={seance.id} className="p-4 rounded-xl border border-neutral-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all bg-white group shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
                      {seance.classe_nom?.substring(0, 2).toUpperCase() || 'CL'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors">
                        {seance.classe_nom}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-neutral-600">
                        <span className="flex items-center gap-1">🕐 {formatTime(seance.heure_debut_reelle)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(seance.statut)}`}>
                          {seance.statut || 'Planifié'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleStartClass(seance.classe_id, seance.id)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
                  >
                    🚀 Démarrer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Liens rapides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={() => navigate('/professeur/cours')} className="class-card text-left hover:border-primary-300 p-5 bg-white border border-neutral-200 rounded-lg shadow-sm transition-all">
          <h3 className="font-semibold">📚 Gérer mes cours</h3>
          <p className="text-sm text-neutral-600">Créneaux, pauses, signalements, supports</p>
        </button>
        {/* <button onClick={() => navigate('/professeur/planning')} className="class-card text-left hover:border-primary-300 p-5 bg-white border border-neutral-200 rounded-lg shadow-sm transition-all">
          <h3 className="font-semibold">📅 Mon Planning</h3>
          <p className="text-sm text-neutral-600">Disponibilités, synchronisation créneaux</p>
        </button> */}
      </div>
    </div>
  )
}
