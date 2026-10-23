// ── src/pages/Dashboard.tsx ─────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import {
  useGetEleveDashboardQuery,
  useGetEleveStatsQuery,
  useGetClassesQuery,
  useGetMyDiplomesQuery, // 🆕
} from '../../store/apiSlice'
import { format, isToday, isTomorrow, addDays, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useState, useEffect } from 'react'
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
  // 🆕 Récupérer les diplômes pour compter
  const { data: diplomesData } = useGetMyDiplomesQuery(undefined, { skip: !user })
  const nbDiplomes = Array.isArray(diplomesData) ? diplomesData.length : 0

  const [seancesSemaine, setSeancesSemaine] = useState<Array<{
    seance: Seance
    classe: Classe
    jourLabel: string
    dateLabel: string
    isToday: boolean
    isTomorrow: boolean
  }>>([])
  const [loadingSeances, setLoadingSeances] = useState(false)

  // Charger les séances de la semaine
  useEffect(() => {
    if (!classesData?.results || !user) return
    const loadSeances = async () => {
      setLoadingSeances(true)
      try {
        const today = new Date()
        const todayDayIndex = getDay(today)
        const currentDayName = DAYS_FR[todayDayIndex].toLowerCase()
        const currentIndex = DAYS_ORDER.indexOf(currentDayName)
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
                if (isToday(seanceDate)) jourLabel = "Aujourd'hui"
                else if (isTomorrow(seanceDate)) jourLabel = 'Demain'
                else jourLabel = format(seanceDate, 'EEE d MMM', { locale: fr })
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

        allSeances.sort((a, b) => {
          if (a.dateLabel !== b.dateLabel) return a.dateLabel.localeCompare(b.dateLabel)
          return (a.seance.heure_debut_reelle || '').localeCompare(b.seance.heure_debut_reelle || '')
        })
        setSeancesSemaine(allSeances)
      } catch {} finally {
        setLoadingSeances(false)
      }
    }
    loadSeances()
  }, [classesData, user])

  const programmes = stats?.programmes || []
  const montantAPayer = Number(stats?.montant_a_payer ?? 0)
  const nbFacturesEnAttente = stats?.nb_factures_en_attente ?? 0
  const nbClassesActives = stats?.nb_classes_actives ?? 0

  if (isLoading || statsLoading || classesLoading)
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* ═══════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-12 md:px-10 md:py-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10 max-w-7xl mx-auto">
          <p className="text-sm text-slate-400 mb-2">
            {format(new Date(), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold">Votre espace en ligne</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Bienvenue, {user?.display_name || user?.prenom || 'Élève'} 👋
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 -mt-8 space-y-6">
        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1 — Cards principales (Classes, Factures, Diplômes)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ── 1.1 Classes actives ── */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-5 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white text-xl shadow-md">
                  🎓
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Classes actives</p>
                  <p className="text-xs text-slate-600">Inscriptions en cours</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-900">{nbClassesActives || '—'}</p>
            </div>
            {/* 🆕 Bouton d'accès */}
            <button
              onClick={() => navigate('/eleve/classes')}
              className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2"
            >
              📚 Voir mes classes →
            </button>
          </div>

          {/* ── 1.2 Factures ── */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl border border-amber-200 p-5 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-white text-xl shadow-md">
                  💰
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">À régler</p>
                  <p className="text-xs text-slate-600">
                    {nbFacturesEnAttente > 0
                      ? `${nbFacturesEnAttente} facture${nbFacturesEnAttente > 1 ? 's' : ''}`
                      : '✓ À jour'}
                  </p>
                </div>
              </div>
              <p className="text-2xl font-bold text-amber-900">
                {montantAPayer.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            {/* 🆕 Bouton d'accès */}
            <button
              onClick={() => navigate('/eleve/factures')}
              className="w-full mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2"
            >
              💳 Voir mes factures →
            </button>
          </div>

          {/* ── 1.3 Diplômes (NOUVEAU) ── */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl border border-purple-200 p-5 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center text-white text-xl shadow-md">
                  🏆
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">Mes diplômes</p>
                  <p className="text-xs text-slate-600">Attestations obtenues</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-purple-900">{nbDiplomes}</p>
            </div>
            {/* 🆕 Bouton d'accès */}
            <button
              onClick={() => navigate('/eleve/diplomes')}
              className="w-full mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition shadow-md flex items-center justify-center gap-2"
            >
              🎖️ Voir mes diplômes →
            </button>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2 — Programmes (liste à puces)
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📖</span>
                <h2 className="text-lg font-bold text-slate-900">Mes programmes</h2>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {programmes.length} inscription{programmes.length > 1 ? 's' : ''} active{programmes.length > 1 ? 's' : ''}
              </span>
            </div>

            {programmes.length > 0 ? (
              <ul className="space-y-2">
                {programmes.map((prog: string, i: number) => {
                  const colors = [
                    { dot: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' },
                    { dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900' },
                    { dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' },
                    { dot: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900' },
                    { dot: 'bg-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900' },
                  ]
                  const c = colors[i % colors.length]
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${c.bg} ${c.border} transition hover:shadow-sm`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot} flex-shrink-0`} />
                      <span className={`text-sm font-semibold ${c.text} flex-1`}>{prog}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                        Actif
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm text-slate-500 italic">Aucun programme inscrit pour le moment</p>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3 — Prochains cours
        ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📅</span>
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
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {seancesSemaine.map((item, idx) => {
                  const heureDebut = item.seance.heure_debut_reelle?.substring(0, 5) || '--:--'
                  const heureFin = calcHeureFin(
                    item.seance.heure_debut_reelle,
                    item.seance.duree_reelle_minutes
                  )
                  const profNom =
                    typeof item.classe.professeur === 'object'
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
                        <p
                          className={`text-xs font-bold ${
                            item.isToday
                              ? 'text-blue-600'
                              : item.isTomorrow
                              ? 'text-emerald-600'
                              : 'text-slate-700'
                          }`}
                        >
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
                        <p className="text-xs text-slate-500 mt-0.5">👤 {profNom}</p>
                      </div>
                      {/* Bouton : redirige vers ClasseDetail onglet Salle */}
                      <button
                        onClick={() => navigate(`/eleve/classe/${item.classe.id}?tab=salle`)}
                        className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          item.isToday
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {item.isToday ? '🎥 Rejoindre' : '👁️ Voir'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
