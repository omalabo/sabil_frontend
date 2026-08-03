import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import {
  useGetEleveDashboardQuery,
  useGetEleveStatsQuery,
} from '../../store/apiSlice'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function EleveDashboard() {
  const { user } = useAppSelector(selectAuth)
  const navigate = useNavigate()

  const { data: dashboard, isLoading } = useGetEleveDashboardQuery(undefined, { skip: !user })
  const { data: stats, isLoading: statsLoading } = useGetEleveStatsQuery(undefined, { skip: !user })

  if (isLoading || statsLoading)
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">
          👋 Bienvenue, {user?.display_name}
        </h1>
        <button onClick={() => navigate('/eleve/classes')} className="btn-primary">
          📚 Voir mes classes
        </button>
      </div>

      {/* ── Ligne 1 : classes + programmes + prochain cours ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Classes actives */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500 mb-1">Classes actives</p>
          <p className="text-3xl font-bold text-primary-700">
            {stats?.nb_classes_actives ?? '—'}
          </p>
        </div>

        {/* Programmes inscrits */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500 mb-2">Mes programmes</p>
          {stats?.programmes && stats.programmes.length > 0 ? (
            <ul className="space-y-1">
              {stats.programmes.map((prog, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-neutral-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                  {prog}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400 italic">Aucun programme</p>
          )}
        </div>

        {/* Prochain cours */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500 mb-1">Prochain cours</p>
          <p className="text-base font-medium text-neutral-900">
            {dashboard?.prochain_cours
              ? format(new Date(dashboard.prochain_cours.date_seance), 'd MMMM', { locale: fr })
                + ' à '
                + dashboard.prochain_cours.heure_debut_reelle?.substring(0, 5)
              : 'Aucun cours planifié'}
          </p>
        </div>

      </div>

      {/* ── Ligne 2 : finances + séances ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Montant à payer */}
        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm">
          <p className="text-sm text-amber-600 font-medium mb-1">💳 À payer</p>
          <p className="text-2xl font-bold text-amber-700">
            {Number(stats?.montant_a_payer ?? 0).toLocaleString('fr-FR', {
              style: 'currency', currency: 'EUR'
            })}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Factures en attente</p>
        </div>

        {/* Montant payé */}
        <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm">
          <p className="text-sm text-emerald-600 font-medium mb-1">✅ Déjà payé</p>
          <p className="text-2xl font-bold text-emerald-700">
            {Number(stats?.montant_paye ?? 0).toLocaleString('fr-FR', {
              style: 'currency', currency: 'EUR'
            })}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Factures confirmées</p>
        </div>

        {/* Séances */}
        <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm">
          <p className="text-sm text-blue-600 font-medium mb-1">📅 Séances</p>
          <p className="text-2xl font-bold text-blue-700">
            {stats?.nb_seances ?? '—'}
          </p>
          <p className="text-xs text-neutral-400 mt-1">Séances actives toutes classes</p>
        </div>

      </div>

      {/* ── Accès rapide ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/eleve/diplomes')}
          className="class-card text-left hover:border-primary-300"
        >
          <h3 className="font-semibold text-neutral-900">🎓 Mes Diplômes & Progression</h3>
          <p className="text-sm text-neutral-600 mt-1">Suivez votre avancement et validez vos niveaux</p>
        </button>
        <button
          onClick={() => navigate('/eleve/chat-admin')}
          className="class-card text-left hover:border-primary-300"
        >
          <h3 className="font-semibold text-neutral-900">💬 Contacter l'Administration</h3>
          <p className="text-sm text-neutral-600 mt-1">Questions administratives, absences, paiements</p>
        </button>
      </div>
    </div>
  )
}