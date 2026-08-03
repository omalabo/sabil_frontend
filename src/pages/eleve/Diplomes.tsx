import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
// Note: Remplace par ton endpoint catalogue-cours si ajouté à apiSlice
// import { useGetCatalogueQuery } from '../../store/apiSlice'

export default function EleveDiplomes() {
  const { user } = useAppSelector(selectAuth)
  // const { data: parcours, isLoading } = useGetCatalogueQuery(undefined, { skip: !user })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">🎓 Parcours & Diplômes</h1>
      
      <div className="bg-white p-6 rounded-lg border border-neutral-200 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Arabe Mouqadima Ba → Tajwid Avancé</h2>
        <div className="space-y-4">
          {/* Exemple statique basé sur ta logique métier */}
          {[
            { nom: 'Arabe Mouqadima Ba', pct: 100, statut: 'Acquis', couleur: 'bg-success-500' },
            { nom: 'Coran Juz Amma', pct: 45, statut: 'En cours', couleur: 'bg-warning-500' },
            { nom: 'Tajwid Avancé', pct: 0, statut: 'Verrouillé', couleur: 'bg-neutral-300' }
          ].map((cours, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-neutral-800">{cours.nom}</span>
                <span className="text-neutral-500">{cours.pct}% • {cours.statut}</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2.5">
                <div className={`${cours.couleur} h-2.5 rounded-full transition-all`} style={{ width: `${cours.pct}%` }}></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-4">💡 Les diplômes sont générés automatiquement par votre professeur à la fin du niveau.</p>
      </div>
    </div>
  )
}