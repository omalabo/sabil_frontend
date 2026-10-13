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
const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
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
          HEADER — Bienvenue
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-8 md:px-10 md:py-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)'
        }} />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">
                {format(new Date(), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
              <h1 className="text-2xl md:text-3xl font-bold">
                Bienvenue, {user?.display_name || user?.prenom || 'Élève'} 👋
              </h1>
            </div>
            <button
              onClick={() => navigate('/eleve/classes')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-medium transition-all backdrop-blur-sm"
            >
              📚 Mes classes
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 space-y-8">
        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1 — Mes programmes
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📖</span>
            <h2 className="text-lg font-bold text-slate-900">Mes programmes</h2>
          </div>
          {programmes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {programmes.map((prog: string, i: number) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-default"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {prog.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{prog}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Programme actif</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500 italic">Aucun programme inscrit</p>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2 — Mes prochains cours (liste semaine)
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h2 className="text-lg font-bold text-slate-900">Mes prochains cours</h2>
            </div>
            <span className="text-xs text-slate-500">
              {seancesSemaine.length} cours cette semaine
            </span>
          </div>

          {loadingSeances ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : seancesSemaine.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <div className="text-4xl mb-3">🌙</div>
              <p className="text-slate-600 font-medium">Aucun cours prévu cette semaine</p>
              <p className="text-xs text-slate-400 mt-1">Reposez-vous bien !</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="divide-y divide-slate-100">
                {seancesSemaine.map((item, idx) => {
                  const heureDebut = item.seance.heure_debut_reelle?.substring(0, 5) || '--:--'
                  const heureFin = calcHeureFin(item.seance.heure_debut_reelle, item.seance.duree_reelle_minutes)
                  const profNom = typeof item.classe.professeur === 'object'
                    ? item.classe.professeur?.display_name || 'Professeur'
                    : 'Professeur'

                  return (
                    <div
                      key={`${item.seance.id}-${idx}`}
                      className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${
                        item.isToday ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      {/* Colonne jour/date */}
                      <div className="flex-shrink-0 w-28 md:w-32">
                        <p className={`text-sm font-bold ${
                          item.isToday ? 'text-indigo-600' : item.isTomorrow ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {item.jourLabel}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {heureDebut} – {heureFin}
                        </p>
                      </div>

                      {/* Séparateur vertical */}
                      <div className="w-px h-10 bg-slate-200 flex-shrink-0" />

                      {/* Colonne cours */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {item.classe.nom}
                          {item.classe.programme && (
                            <span className="text-slate-500 font-normal"> — {item.classe.programme}</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          👤 {profNom}
                        </p>
                      </div>

                      {/* Bouton Rejoindre */}
                      <button
                        onClick={() => navigate(`/eleve/classes/${item.classe.id}?tab=salle`)}
                        className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          item.isToday
                            ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-md'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {item.isToday ? '🎥 Rejoindre' : ' Voir'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3 — Paiements & factures + Stats rapides
        ═══════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Paiements & factures */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl">
                💳
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Paiements & factures</p>
                <p className="text-xs text-slate-500">
                  {nbFacturesEnAttente > 0 ? `${nbFacturesEnAttente} facture en attente` : 'À jour'}
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">
                {montantAPayer.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </span>
              <span className="text-xs text-slate-500">à régler</span>
            </div>
            <button
              onClick={() => navigate('/eleve/classes?tab=infos')}
              className="mt-3 text-xs text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1"
            >
              Voir les détails <span>→</span>
            </button>
          </div>

          {/* Classes actives */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl">
                📚
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Classes actives</p>
                <p className="text-xs text-slate-500">Inscriptions en cours</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {stats?.nb_classes_actives ?? '—'}
            </p>
            <button
              onClick={() => navigate('/eleve/classes')}
              className="mt-3 text-xs text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1"
            >
              Voir mes classes <span>→</span>
            </button>
          </div>

          {/* Séances */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">
                📅
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Séances actives</p>
                <p className="text-xs text-slate-500">Toutes classes confondues</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {stats?.nb_seances ?? '—'}
            </p>
            <button
              onClick={() => navigate('/eleve/classes')}
              className="mt-3 text-xs text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1"
            >
              Voir le planning <span>→</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
