import React, { useState, useMemo, useEffect } from 'react'
import {
  useGetDirectionDashboardQuery,
  useGetProfesseursQuery,
  useGetClassesDashQuery,
} from '../../store/apiSlice'
import {
  DirectionDashboardData,
  EvolutionPoint,
  ProfesseurDue,
  ProfesseurOption,
  ClasseOption,
  EleveOption,
} from '../../types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Types filtres ─────────────────────────────────────────────────────────────

interface Filters {
  professor_id: string
  eleve_id: string
  class_id: string
  programme: string
  start_date: string
  end_date: string
}

const INITIAL_FILTERS: Filters = {
  professor_id: '',
  eleve_id: '',
  class_id: '',
  programme: '',
  start_date: '',
  end_date: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtEur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6',
]
function getColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function formatChartData(data: EvolutionPoint[]) {
  const map = new Map<string, Record<string, any>>()
  data.forEach(d => {
    if (!map.has(d.date)) map.set(d.date, { date: d.date })
    const row = map.get(d.date)!
    row[d.professeur] = (row[d.professeur] || 0) + d.heures
  })
  return Array.from(map.values())
}

function getUniqueProfs(data: EvolutionPoint[]) {
  return Array.from(new Set(data.map(d => d.professeur)))
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string
  value: string
  sub?: string
  color?: string
  border?: string
  loading?: boolean
  badge?: string
  badgeColor?: string
  action?: React.ReactNode
}

function KPICard({ title, value, sub, color = 'text-neutral-900', border = 'border-neutral-200', loading, badge, badgeColor, action }: KPICardProps) {
  return (
    <div className={`bg-white p-4 rounded-xl border ${border} shadow-sm hover:shadow-md transition`}>
      <div className="flex items-start justify-between mb-1 gap-1">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider leading-tight">{title}</p>
        <div className="flex items-center gap-1 shrink-0">
          {badge && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ml-1 ${badgeColor ?? 'bg-neutral-100 text-neutral-500'}`}>
              {badge}
            </span>
          )}
          {action}
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-neutral-100 rounded-lg animate-pulse mt-1" />
      ) : (
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
      )}
      {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Modal : Élèves à payer ──────────────────────────────────────────────────────

interface EleveAPayer {
  eleve_nom: string
  classe_nom: string
  cours: string
  montant_a_payer: number
  professeur_nom: string
  telephone: string
}

function EleveAPayerModal({ open, onClose, items, loading }: {
  open: boolean
  onClose: () => void
  items: EleveAPayer[]
  loading?: boolean
}) {
  if (!open) return null
  const total = items.reduce((acc, it) => acc + (it.montant_a_payer || 0), 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-gradient-to-r from-amber-50 to-white">
          <div>
            <h3 className="text-base font-bold text-neutral-900">💰 Élèves avec factures à payer</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {items.length} élève{items.length > 1 ? 's' : ''} concerné{items.length > 1 ? 's' : ''} · Total {fmtEur(total)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition text-lg"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-sm text-neutral-400 italic">
              Aucune facture élève en attente pour ces filtres.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">Élève</th>
                  <th className="text-left font-semibold px-4 py-2.5">Téléphone</th>
                  <th className="text-left font-semibold px-4 py-2.5">Classe</th>
                  <th className="text-left font-semibold px-4 py-2.5">Cours</th>
                  <th className="text-left font-semibold px-4 py-2.5">Professeur</th>
                  <th className="text-right font-semibold px-4 py-2.5">Montant à payer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/50 transition">
                    <td className="px-4 py-2.5 font-medium text-neutral-800 whitespace-nowrap">{it.eleve_nom || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">{it.telephone || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">{it.classe_nom || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">{it.cours || '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600 whitespace-nowrap">{it.professeur_nom || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-700 whitespace-nowrap">{fmtEur(it.montant_a_payer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-100 bg-neutral-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section titre ─────────────────────────────────────────────────────────────

function SectionTitle({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{icon}</span>
      <div>
        <h2 className="text-sm font-bold text-neutral-800">{title}</h2>
        {sub && <p className="text-xs text-neutral-400">{sub}</p>}
      </div>
    </div>
  )
}

// ── Insights automatiques ─────────────────────────────────────────────────────

function buildInsights(evolution: EvolutionPoint[]) {
  if (!evolution.length) return []
  const dates = Array.from(new Set(evolution.map(e => e.date))).sort()
  const mid = Math.floor(dates.length / 2)
  const recent = new Set(dates.slice(mid))
  const groups: Record<string, { nom: string; ancien: number; recent: number }> = {}
  evolution.forEach(d => {
    if (!groups[d.professeur_id]) groups[d.professeur_id] = { nom: d.professeur, ancien: 0, recent: 0 }
    if (recent.has(d.date)) groups[d.professeur_id].recent += d.heures
    else groups[d.professeur_id].ancien += d.heures
  })
  return Object.values(groups).map(g => {
    const total = g.ancien + g.recent
    if (total < 5) return { status: 'faible', msg: `⚠️ ${g.nom} : volume très faible (<5h)` }
    const ratio = g.recent / (g.ancien || 1)
    if (ratio > 1.15) return { status: 'hausse', msg: `✅ ${g.nom} : progression marquée` }
    if (ratio < 0.85) return { status: 'baisse', msg: `🔻 ${g.nom} : baisse d'activité` }
    return { status: 'stable', msg: `➡️ ${g.nom} : activité stable` }
  })
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function DirectionDashboard() {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  const [activeFilters, setActiveFilters] = useState<Filters>(INITIAL_FILTERS)
  const [showElevesAPayer, setShowElevesAPayer] = useState(false)

  const { data: profs = [], isLoading: loadingProfs } = useGetProfesseursQuery()
  const { data: classes = [], isLoading: loadingClasses } = useGetClassesDashQuery()

  // Construire les params actifs (ignorer les vides)
  const params = useMemo(
    () => Object.fromEntries(Object.entries(activeFilters).filter(([_, v]) => v !== '')) as Record<string, string>,
    [activeFilters]
  )

  const { data, isLoading, isFetching } = useGetDirectionDashboardQuery(params)

  // Quand prof change → reset filtre élève car la liste change
  useEffect(() => {
    setFilters(prev => ({ ...prev, eleve_id: '' }))
  }, [filters.professor_id])

  function handleChange(key: keyof Filters, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function applyFilters() {
    setActiveFilters({ ...filters })
  }

  function resetFilters() {
    setFilters(INITIAL_FILTERS)
    setActiveFilters(INITIAL_FILTERS)
  }

  const eleveOptions: EleveOption[] = data?.eleves_options ?? []
  const insights = useMemo(() => buildInsights(data?.evolution_heures ?? []), [data])
  const chartData = useMemo(() => formatChartData(data?.evolution_heures ?? []), [data])
  const uniqueProfs = useMemo(() => getUniqueProfs(data?.evolution_heures ?? []), [data])

  const hasActiveFilter = Object.values(activeFilters).some(v => v !== '')

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">📊 Supervision Direction</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Vue consolidée de toute la plateforme</p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilter && (
            <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">
              Filtres actifs
            </span>
          )}
          <button
            onClick={resetFilters}
            className="text-sm px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition text-neutral-700 font-medium"
          >
            ↻ Réinitialiser
          </button>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Filtres</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

          {/* Professeur */}
          <select
            className="col-span-2 md:col-span-1 w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white"
            value={filters.professor_id}
            onChange={e => handleChange('professor_id', e.target.value)}
          >
            <option value="">Tous les profs</option>
            {loadingProfs ? (
              <option disabled>Chargement…</option>
            ) : (
              (Array.isArray(profs) ? profs : []).map((p: ProfesseurOption) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))
            )}
          </select>

          {/* Élève — dynamique selon prof */}
          <select
            className="col-span-2 md:col-span-1 w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white"
            value={filters.eleve_id}
            onChange={e => handleChange('eleve_id', e.target.value)}
          >
            <option value="">Tous les élèves</option>
            {eleveOptions.map((e: EleveOption) => (
              <option key={e.id} value={e.id}>
                {e.display_name ?? e.email}
              </option>
            ))}
          </select>

          {/* Classe */}
          <select
            className="col-span-2 md:col-span-1 w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none bg-white"
            value={filters.class_id}
            onChange={e => handleChange('class_id', e.target.value)}
          >
            <option value="">Toutes les classes</option>
            {loadingClasses ? (
              <option disabled>Chargement…</option>
            ) : (
              (Array.isArray(classes) ? classes : []).map((c: ClasseOption) => (
                <option key={c.id} value={c.id}>
                  {c.nom}{c.programme ? ` (${c.programme})` : ''}
                </option>
              ))
            )}
          </select>

          {/* Programme */}
          {/* <input
            type="text"
            placeholder="Programme"
            value={filters.programme}
            onChange={e => handleChange('programme', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
          /> */}

          {/* Dates */}
          <input
            type="date"
            value={filters.start_date}
            onChange={e => handleChange('start_date', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={e => handleChange('end_date', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>

        <div className="flex justify-end mt-3">
          <button
            onClick={applyFilters}
            disabled={isFetching}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
          >
            {isFetching ? '⏳ Chargement…' : '🔍 Appliquer'}
          </button>
        </div>
      </div>


      {/* ── Bloc 2 : Classes & Élèves ── */}
      {/* <div>
        <SectionTitle icon="🏫" title="Classes & Élèves" sub={hasActiveFilter ? 'Global · Filtré' : 'Toute la plateforme'} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4"> */}
          {/* <KPICard
            title="Classes actives (global)"
            value={String(data?.nb_classes_global ?? 0)}
            color="text-blue-600"
            loading={isLoading}
          /> */}
          {/* <KPICard
            title="Classes (filtrées)"
            value={String(data?.nb_classes_filtre ?? 0)}
            sub={hasActiveFilter ? 'Selon filtres actifs' : 'Idem global'}
            color="text-blue-600"
            border="border-blue-200"
            loading={isLoading}
          /> */}
          {/* <KPICard
            title="Élèves inscrits (global)"
            value={String(data?.nb_eleves_global ?? 0)}
            color="text-emerald-600"
            loading={isLoading}
          /> */}
          {/* <KPICard
            title="Élèves (filtrés)"
            value={String(data?.nb_eleves_filtre ?? 0)}
            sub={hasActiveFilter ? 'Selon filtres actifs' : 'Idem global'}
            color="text-emerald-600"
            border="border-emerald-200"
            loading={isLoading}
          /> */}
        {/* </div>
      </div> */}


      {/* ── Bloc 3 : Factures élèves & Séances ── */}
      <div>
        <SectionTitle icon="💳" title="Paiements Élèves & Séances" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
          <KPICard
            title="Classes (filtrées)"
            value={String(data?.nb_classes_filtre ?? 0)}
            sub={hasActiveFilter ? 'Selon filtres actifs' : 'Idem global'}
            color="text-blue-600"
            border="border-blue-200"
            loading={isLoading}
          />
          <KPICard
            title="Élèves (filtrés)"
            value={String(data?.nb_eleves_filtre ?? 0)}
            sub={hasActiveFilter ? 'Selon filtres actifs' : 'Idem global'}
            color="text-emerald-600"
            border="border-emerald-200"
            loading={isLoading}
          />
          <KPICard
            title="Séances actives"
            value={String(data?.nb_seances_actives ?? 0)}
            sub="Toutes classes filtrées"
            color="text-violet-700"
            border="border-violet-200"
            loading={isLoading}
          />
          <KPICard
            title="À payer (élèves)"
            value={fmtEur(data?.montant_eleve_a_payer ?? 0)}
            sub="Factures en attente / partiel"
            color="text-amber-700"
            border="border-amber-200"
            loading={isLoading}
            action={
              <button
                onClick={() => setShowElevesAPayer(true)}
                title="Voir le détail des élèves concernés"
                className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 hover:bg-amber-200 text-amber-700 transition text-xs"
              >
                👁
              </button>
            }
          />
          <KPICard
            title="Déjà payé (élèves)"
            value={fmtEur(data?.montant_eleve_paye ?? 0)}
            sub="Factures payées / confirmées"
            color="text-emerald-700"
            border="border-emerald-200"
            loading={isLoading}
          />
          
          

        </div>
      </div>

      {/* ── Bloc 1 : Finances profs ── */}
      <div>
        <SectionTitle icon="💼" title="Finances Professeurs" sub="Basé sur les factures envoyées et payées" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            title="Montant dû profs"
            value={fmtEur(data?.montant_due_prof_total ?? 0)}
            sub={`${data?.professeurs_concernes?.length ?? 0} prof(s) concerné(s)`}
            color="text-blue-700"
            border="border-blue-200"
            loading={isLoading}
          />
          <KPICard
            title="Commission direction"
            value={fmtEur(data?.montant_due_directrice ?? 0)}
            sub="Part direction des factures"
            color="text-violet-700"
            border="border-violet-200"
            loading={isLoading}
          />
          <KPICard
            title="Factures envoyées"
            value={String(data?.nb_factures_envoyees ?? 0)}
            sub="En attente de paiement"
            color="text-amber-700"
            border="border-amber-200"
            loading={isLoading}
          />
          <KPICard
            title="Factures payées"
            value={String(data?.nb_factures_payees ?? 0)}
            sub={fmtEur(data?.montant_total_factures ?? 0) + ' total'}
            color="text-emerald-700"
            border="border-emerald-200"
            loading={isLoading}
          />
        </div>
      </div>

      

      

      {/* ── Bloc 4 : Répartition profs + Graph ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Liste profs */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <SectionTitle icon="👥" title="Répartition par Professeur" sub="Part prof · Part direction" />
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />
              ))
            ) : data?.professeurs_concernes?.length ? (
              data.professeurs_concernes.map((prof: ProfesseurDue) => (
                <div key={prof.id} className="p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-neutral-800 truncate max-w-[140px]">
                      {prof.nom_complet || '—'}
                    </span>
                    <span className="text-xs font-bold text-neutral-500">
                      {prof.nb_factures} fact.
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-blue-600 font-medium">
                      Prof : {fmtEur(prof.part_prof)}
                    </span>
                    <span className="text-violet-600 font-medium">
                      Dir : {fmtEur(prof.part_dir)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-400 text-center py-6 italic">
                Aucun résultat pour ces filtres.
              </p>
            )}
          </div>
        </div>

        {/* Graph heures */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
          <SectionTitle
            icon="📈"
            title="Évolution des Heures Réalisées"
            sub="Présences validées — logique identique au calcul de factures"
          />

          {isLoading ? (
            <div className="h-56 bg-neutral-50 rounded-xl animate-pulse" />
          ) : chartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-neutral-400 text-sm">
              Aucune donnée pour ces filtres
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={d => format(parseISO(d), 'dd/MM', { locale: fr })}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    label={{ value: 'h', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(2)} h`]}
                    labelFormatter={l => format(parseISO(l), 'dd MMM yyyy', { locale: fr })}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0/0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {uniqueProfs.map(prof => (
                    <Line
                      key={prof}
                      type="monotone"
                      dataKey={prof}
                      stroke={getColor(prof)}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg text-xs border-l-4 ${
                    ins.status === 'hausse' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' :
                    ins.status === 'baisse' ? 'bg-amber-50 border-amber-500 text-amber-800' :
                    ins.status === 'faible' ? 'bg-rose-50 border-rose-500 text-rose-800' :
                    'bg-blue-50 border-blue-500 text-blue-800'
                  }`}
                >
                  {ins.msg}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <EleveAPayerModal
        open={showElevesAPayer}
        onClose={() => setShowElevesAPayer(false)}
        items={(data as any)?.eleves_a_payer_detail ?? []}
        loading={isLoading}
      />
    </div>
  )
}