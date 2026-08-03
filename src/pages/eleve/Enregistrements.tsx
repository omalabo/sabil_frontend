import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
// import { useGetEnregistrementsQuery } from '../../store/apiSlice' // À ajouter dans apiSlice si besoin

export default function EleveEnregistrements() {
  const { user } = useAppSelector(selectAuth)
  const navigate = useNavigate()
  // const { data: enregs, isLoading } = useGetEnregistrementsQuery(undefined, { skip: !user })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">🎥 Enregistrements de Cours</h1>
        <button onClick={() => navigate(-1)} className="text-neutral-600 hover:text-neutral-900">← Retour</button>
      </div>
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        {[1,2,3].map((i) => (
          <div key={i} className="flex items-center justify-between p-4 border-b border-neutral-100 hover:bg-neutral-50">
            <div>
              <p className="font-medium text-neutral-900">Cours Tajwid - {format(new Date(2024, 0, 15 + i), 'dd MMMM', { locale: fr })}</p>
              <p className="text-sm text-neutral-500">Durée: 45 min • Prof: Loubna</p>
            </div>
            <button className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm hover:bg-primary-200">▶ Lire</button>
          </div>
        ))}
        <div className="p-8 text-center text-neutral-500">Aucun enregistrement pour le moment</div>
      </div>
    </div>
  )
}