import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGetClassQuery } from '../../store/apiSlice'
import StatusBadge from '../../components/shared/StatusBadge'
import { Class } from '../../types'

export default function DirectionClasseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const {  data: classe, isLoading } = useGetClassQuery(id!, { skip: !id })

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div></div>
  }

  if (!classe) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600">Classe non trouvée</p>
        <button onClick={() => navigate(-1)} className="btn-primary mt-4">← Retour</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">📚 Détail de la classe</h1>
        <button onClick={() => navigate(-1)} className="text-neutral-600 hover:text-neutral-900">← Retour</button>
      </div>

      {/* 📋 Fiche classe */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">{classe.nom}</h2>
            <p className="text-neutral-600">{classe.programme} • Niveau {classe.niveau}</p>
          </div>
          <StatusBadge status={classe.statut} color={classe.couleur} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-200">
          <div>
            <p className="text-sm text-neutral-500">Professeur</p>
            <p className="font-medium">{classe.professeur?.display_name || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Administrateur</p>
            <p className="font-medium">{classe.admin?.display_name || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Créneau</p>
            <p className="font-medium">
              {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][classe.jour_semaine! - 1] || '-'} 
              {' '}{classe.heure_debut?.substring(0, 5) || '-'} 
              {' • '}{classe.duree_minutes || 60} min
            </p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Taux horaire</p>
            <p className="font-medium">{classe.taux_horaire || '-'} €</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Début de session</p>
            <p className="font-medium">{classe.date_debut_session ? new Date(classe.date_debut_session).toLocaleDateString('fr-FR') : '-'}</p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Dernière activité</p>
            <p className="font-medium">{classe.derniere_activite_at ? new Date(classe.derniere_activite_at).toLocaleString('fr-FR') : 'Jamais'}</p>
          </div>
        </div>

        {/* 🔗 Liens d'action */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-neutral-200">
          <button 
            onClick={() => navigate(`/direction/professeur/${classe.professeur?.id}/classes`)}
            className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 text-sm"
          >
             Voir le professeur
          </button>
          <button 
            onClick={() => navigate(`/direction/gestion-inscriptions/${classe.id}`)}
            className="px-4 py-2 bg-success-100 text-success-700 rounded-lg hover:bg-success-200 text-sm"
          >
            👥 Gérer les inscriptions
          </button>
          <button 
            onClick={() => navigate(`/admin/classe/${classe.id}/surveillance`)}
            className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 text-sm"
          >
            👁️ Surveiller le chat
          </button>
        </div>
      </div>

      {/* 📊 Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-neutral-200 text-center">
          <p className="text-3xl font-bold text-primary-700">-</p>
          <p className="text-sm text-neutral-500">Élèves inscrits</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200 text-center">
          <p className="text-3xl font-bold text-success-600">-</p>
          <p className="text-sm text-neutral-500">Séances réalisées</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200 text-center">
          <p className="text-3xl font-bold text-neutral-900">{classe.taux_horaire || 0} €</p>
          <p className="text-sm text-neutral-500">Taux horaire</p>
        </div>
      </div>
    </div>
  )
}
