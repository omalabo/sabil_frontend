import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import {
  useGetEleveDashboardQuery,
  useGetEleveStatsQuery,
  useGetClassesQuery,
} from '../../store/apiSlice'
import { format, isToday, isTomorrow, addDays, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useMemo, useState, useEffect } from 'react'
import api from '../../config/axios'

interface Seance {
  id: string
  date_seance: string | null
  jour_seance: string | null
  heure_debut_reelle: string | null
  duree_reelle_minutes: number | null
  statut: string | null
}

interface Classe {
  id: string
  nom: string
  programme?: string
  niveau?: string
  professeur?: any
  statut?: string
}

const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const DAYS_ORDER = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

function calcHeureFin(heure: string | null, duree: number | null): string {
  if (!heure || !duree) return '--:--'
  const [h, m] = heure.split(':').map(Number)
  const total = h * 60 + m + duree
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function EleveDashboard() {
  const { user } = useAppSelector(selectAuth)
  const navigate = useNavigate()
  const { data: dashboard, isLoading } = useGetEleveDashboardQuery(undefined, { skip: !user })
  const { data: stats, isLoading: statsLoading } = useGetEleveStatsQuery(undefined, { skip: !user })
  const { data: classesData, isLoading: classesLoading } = useGetClassesQuery({}, { skip: !user })

  const [seancesSemaine, setSeancesSemaine] = useState<Array<{
    seance: Seance
    classe: Classe
    jourLabel: string
    dateLabel: string
    isToday: boolean
    isTomorrow: boolean
  }>>([])
  const [loadingSeances, setLoadingSeances] = useState(false)

  // Charger les séances de la semaine (du jour actuel à dimanche)
  useEffect(() => {
    if (!classesData?.results || !user) return

    const loadSeances = async () => {
      setLoadingSeances(true)
      try {
        const today = new Date()
        const todayDayIndex = getDay(today) // 0=dim, 1=lun, ..., 6=sam
        const currentDayName = DAYS_FR[todayDayIndex].toLowerCase()
        const currentIndex = DAYS_ORDER.indexOf(currentDayName)

        // Jours restants de la semaine (inclus aujourd'hui jusqu'à dimanche)
        const remainingDays = DAYS_ORDER.slice(currentIndex >= 0 ? currentIndex : 0)

        const allSeances: Array<{
          seance: Seance
          classe: Classe
          jourLabel: string
          dateLabel: string
          isToday: boolean
          isTomorrow: boolean
        }> = []

        await Promise.all(
          classesData.results.map(async (cls: Classe) => {
            try {
              const res = await api.get(`/classes/${cls.id}/seances/`)
              const seances: Seance[] = res.data.results || []

              seances.forEach((seance) => {
                if (seance.statut === 'supprimer') return
                const jourSeance = seance.jour_seance?.toLowerCase()
                if (!jourSeance || !remainingDays.includes(jourSeance)) return

                const jourIndex = DAYS_ORDER.indexOf(jourSeance)
                const daysUntil = jourIndex - (currentIndex >= 0 ? currentIndex : 0)
                const seanceDate = addDays(today, daysUntil >= 0 ? daysUntil : 7 + daysUntil)

                let jourLabel = ''
                if (isToday(seanceDate)) {
                  jourLabel = "Aujourd'hui"
                } else if (isTomorrow(seanceDate)) {
                  jourLabel = 'Demain'
                } else {
                  jourLabel = format(seanceDate, 'EEE d MMM', { locale: fr })
                }

                allSeances.push({
                  seance,
                  classe: cls,
                  jourLabel,
                  dateLabel: format(seanceDate, 'yyyy-MM-dd'),
                  isToday: isToday(seanceDate),
                  isTomorrow: isTomorrow(seanceDate),
                })
              })
            } catch {}
          })
        )

        // Trier par date puis par heure
        allSeances.sort((a, b) => {
          if (a.dateLabel !== b.dateLabel) return a.dateLabel.localeCompare(b.dateLabel)
          return (a.seance.heure_debut_reelle || '').localeCompare(b.seance.heure_debut_reelle || '')
        })

        setSeancesSemaine(allSeances)
      } catch {}
      finally {
        setLoadingSeances(false)
      }
    }

    loadSeances()
  }, [classesData, user])

  const programmes = stats?.programmes || []
  const montantAPayer = Number(stats?.montant_a_payer ?? 0)
  const nbFacturesEnAttente = stats?.nb_factures_en_attente ?? 0

  if (isLoading || statsLoading || classesLoading)
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* ═══════════════════════════════════════════════════════════════
          HEADER — Votre espace en ligne
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-12 md:px-10 md:py-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)'
        }} />
        <div className="relative z-10 max-w-7xl mx-auto">
          <p className="text-sm text-slate-400 mb-2">
            {format(new Date(), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold">
            Votre espace en ligne
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Bienvenue, {user?.display_name || user?.prenom || 'Élève'} 👋
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 -mt-8 space-y-6">
        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1 — Mes programmes (cards colorées comme l'image)
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📖</span>
            <h2 className="text-lg font-bold text-slate-900">Mes programmes</h2>
          </div>
          {programmes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programmes.map((prog: string, i: number) => {
                // Couleurs alternées comme dans l'image
                const colors = [
                  'from-blue-50 to-blue-100 border-blue-200',
                  'from-emerald-50 to-emerald-100 border-emerald-200',
                  'from-amber-50 to-amber-100 border-amber-200',
                ]
                const colorClass = colors[i % colors.length]
                const iconBg = [
                  'bg-blue-500',
                  'bg-emerald-500',
                  'bg-amber-500',
                ][i % 3]

                return (
                  <div
                    key={i}
                    className={`bg-gradient-to-br ${colorClass} rounded-2xl border p-5 hover:shadow-lg transition-all cursor-default`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-md`}>
                        {prog.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{prog}</p>
                        <p className="text-xs text-slate-600 mt-1">Programme actif</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500 italic">Aucun programme inscrit</p>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2 — Prochains cours + Paiements (layout 2 colonnes comme l'image)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Prochains cours */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg"></span>
              <h2 className="text-lg font-bold text-slate-900">Prochains cours</h2>
            </div>

            {loadingSeances ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : seancesSemaine.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🌙</div>
                <p className="text-slate-600 font-medium">Aucun cours prévu cette semaine</p>
                <p className="text-xs text-slate-400 mt-1">Reposez-vous bien !</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {seancesSemaine.map((item, idx) => {
                  const heureDebut = item.seance.heure_debut_reelle?.substring(0, 5) || '--:--'
                  const heureFin = calcHeureFin(item.seance.heure_debut_reelle, item.seance.duree_reelle_minutes)
                  const profNom = typeof item.classe.professeur === 'object'
                    ? item.classe.professeur?.display_name || 'Professeur'
                    : 'Professeur'

                  return (
                    <div
                      key={`${item.seance.id}-${idx}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md ${
                        item.isToday
                          ? 'bg-blue-50 border-blue-200'
                          : item.isTomorrow
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Jour/Heure */}
                      <div className="flex-shrink-0 w-20">
                        <p className={`text-xs font-bold ${
                          item.isToday ? 'text-blue-600' : item.isTomorrow ? 'text-emerald-600' : 'text-slate-700'
                        }`}>
                          {item.jourLabel}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {heureDebut} – {heureFin}
                        </p>
                      </div>

                      {/* Séparateur */}
                      <div className="w-px h-10 bg-slate-200 flex-shrink-0" />

                      {/* Cours */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {item.classe.nom}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          👤 {profNom}
                        </p>
                      </div>

                      {/* Bouton */}
                      <button
                        onClick={() => navigate(`/eleve/classes/${item.classe.id}?tab=salle`)}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          item.isToday
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {item.isToday ? '🎥 Rejoindre' : 'Voir'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Paiements & factures */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💳</span>
              <h2 className="text-lg font-bold text-slate-900">Paiements & factures</h2>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 p-5 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700 font-medium mb-1">Montant à régler</p>
                  <p className="text-3xl font-bold text-amber-900">
                    {montantAPayer.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    {nbFacturesEnAttente > 0 ? `${nbFacturesEnAttente} facture en attente` : '✓ À jour'}
                  </p>
                </div>
                <div className="text-4xl">💰</div>
              </div>
            </div>

            <button
              onClick={() => navigate('/eleve/classes?tab=infos')}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              Voir les détails <span>→</span>
            </button>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3 — Stats rapides (cards colorées)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Classes actives */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-5 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white text-xl shadow-md">
                
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Classes actives</p>
                <p className="text-xs text-slate-600">Inscriptions en cours</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-900">
              {stats?.nb_classes_actives ?? '—'}
            </p>
            <button
              onClick={() => navigate('/eleve/classes')}
              className="mt-3 text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
            >
              Voir mes classes <span>→</span>
            </button>
          </div>

          {/* Séances */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200 p-5 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-xl shadow-md">
                📅
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Séances actives</p>
                <p className="text-xs text-slate-600">Toutes classes confondues</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-900">
              {stats?.nb_seances ?? '—'}
            </p>
            <button
              onClick={() => navigate('/eleve/classes')}
              className="mt-3 text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
            >
              Voir le planning <span>→</span>
            </button>
          </div>

          {/* Programmes */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl border border-amber-200 p-5 hover:shadow-lg transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-white text-xl shadow-md">
                🎓
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Programmes</p>
                <p className="text-xs text-slate-600">Inscriptions actives</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-900">
              {programmes.length}
            </p>
            <button
              onClick={() => navigate('/eleve/classes')}
              className="mt-3 text-xs text-amber-600 font-medium hover:text-amber-700 flex items-center gap-1"
            >
              Voir les détails <span>→</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
