import { useState, useMemo } from 'react';
import { useGetPlanningQuery, useCreateSeanceDispoMutation, useUpdateSeanceMutation, useGetClassesQuery, usePauseClassMutation, useFlagDeleteClassMutation, useReactivateClassMutation } from '../../store/apiSlice';
import { useAppSelector } from '../../store/hooks';
import { selectAuth } from '../../store/authSlice';
import { PlanningFilters, PlanningItem } from '../../types';
import { Calendar, List, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, Filter, BookOpen, PauseCircle, Trash2, ChevronRight, X } from 'lucide-react';


import type { UpdateSeancePayload } from '../../components/shared/AddSeanceOverlay';
import { WeekViewWithAdd } from '../../components/shared/AddSeanceOverlay';

interface PlanningProProps {
  professorId?: string        // si fourni, filtre + masque le header admin
  hideHeader?: boolean        // optionnel : masquer titre "📊 Planning"
}

// 🔧 Mapping des jours (case-insensitive & sécurisé)
const JOUR_TO_INDEX: Record<string, number> = {
  'lundi': 0, 'mardi': 1, 'mercredi': 2, 'jeudi': 3,
  'vendredi': 4, 'samedi': 5, 'dimanche': 6
};

// 📅 Récupère l'index du jour (0=Lun...6=Dim) depuis une date ou jour_seance
const resolveWeekdayIndex = (item: PlanningItem): number => {
  if (item.date_seance) {
    const [y, m, d] = item.date_seance.split('-').map(Number);
    if (!y || !m || !d) return -1;
    const date = new Date(y, m - 1, d);
    return date.getDay() === 0 ? 6 : date.getDay() - 1;
  }
  if (item.jour_seance) {
    return JOUR_TO_INDEX[item.jour_seance.toLowerCase().trim()] ?? -1;
  }
  return -1;
};

// 🕒 Extrait "HH:MM" proprement
const extractTimeKey = (timeStr: string | null): string => {
  return timeStr?.match(/\d{2}:\d{2}/)?.[0] || '';
};

// 🔄 Calcule la date réelle d'une séance récurrente dans la semaine de référence
const resolveDisplayDate = (item: PlanningItem, referenceDate: string): string | null => {
  if (item.date_seance) return item.date_seance;
  if (!item.jour_seance) return null;

  const targetIdx = JOUR_TO_INDEX[item.jour_seance.toLowerCase().trim()];
  if (targetIdx === undefined) return null;

  const [ry, rm, rd] = referenceDate.split('-').map(Number);
  const refDate = new Date(ry, rm - 1, rd);
  const refIdx = refDate.getDay() === 0 ? 6 : refDate.getDay() - 1;

  // Lundi de la semaine de référence
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - refIdx);

  // Date cible = Lundi + index du jour
  const target = new Date(monday);
  target.setDate(monday.getDate() + targetIdx);

  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
};


// 📅 Utilitaire de formatage
const formatDate = (dateStr: string): string => {
  try {
    const [y, m, d] = dateStr.split('-');
    if (!m || !d) return `${m}/${y}`; // Format mois seul
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  } catch {
    return dateStr;
  }
};

type StatutKey = 'active' | 'en_pause' | 'a_supprimer' | 'disponibilite'| 'horaire_valide' | 'horaire_non_valide';

const STATUT_COLORS: Record<string, string> = {
  active: 'bg-blue-50 border-blue-300 text-blue-800',
  en_pause: 'bg-green-50 border-green-300 text-green-800',
  disponibilite: 'bg-gray-50 border-gray-300 text-gray-700',
  a_supprimer: 'bg-red-50 border-red-300 text-red-800',
  horaire_valide: 'bg-emerald-50 border-emerald-400 text-emerald-800',
  horaire_non_valide: 'bg-red-50 border-red-400 text-red-800',
  // statut_realisation
  planned: 'bg-gray-50 border-gray-300 text-gray-700',
  in_progress: 'bg-blue-50 border-blue-300 text-blue-800',
  completed: 'bg-green-50 border-green-300 text-green-800',
  absent: 'bg-red-50 border-red-300 text-red-800',
  late: 'bg-orange-50 border-orange-300 text-orange-800',
  deleted: 'bg-gray-100 border-gray-300 text-gray-400',
};

const STATUT_LABELS: Record<string, string> = {
  active: '📅 Prévu',
  en_pause: '🔴 En pause',
  disponibilite: '✅ Disponibilité',
  a_supprimer: '❌ A supprimer',
  horaire_valide: '✅ Validé',
  horaire_non_valide: '✗ Rejeté',
  planned: '📅 Prévu',
  in_progress: '🔵 En cours',
  completed: '✅ Terminé',
  absent: '❌ Absent',
  late: '⚠️ Retard',
  deleted: 'Supprimé',
};

export default function PlanningPro({ professorId, hideHeader }: PlanningProProps) {
  const { user } = useAppSelector(selectAuth);
  const effectiveProfesseurId = professorId ?? user?.id;

  const { data: classesData, refetch: refetchClasses } = useGetClassesQuery({});
  const [createSeance, { isLoading: isCreating }] = useCreateSeanceDispoMutation();
  const [updateSeance, { isLoading: isUpdating }] = useUpdateSeanceMutation();
  const [pauseClass]        = usePauseClassMutation();
  const [flagDeleteClass]   = useFlagDeleteClassMutation();
  const [reactivateClass]   = useReactivateClassMutation();

  // ── Panel état ──────────────────────────────────────────────
  const [classPanelOpen, setClassPanelOpen] = useState(false);
  const [panelTab, setPanelTab]             = useState<'active' | 'pause' | 'delete'>('active');
  const [actionLoading, setActionLoading]   = useState<Record<string, string>>({});

  // Toutes les classes du prof (on affiche aussi celles en pause / signalées)
  const allClasses: any[] = classesData?.results || [];
  const classesByStatut = {
    active: allClasses.filter(c => c.statut === 'active' || c.statut === 'actif' || !c.statut),
    pause:  allClasses.filter(c => c.statut === 'en_pause'),
    delete: allClasses.filter(c => c.statut === 'fin_session' || c.statut === 'a_supprimer'),
  };

  const totalAll = allClasses.filter(c => c.statut !== 'supprimer').length;

  // ── Actions ─────────────────────────────────────────────────
  const doAction = async (classId: string, action: string, fn: () => Promise<any>) => {
    setActionLoading(prev => ({ ...prev, [classId]: action }));
    try { await fn(); refetchClasses(); }
    catch (e) { console.error(e); }
    finally { setActionLoading(prev => { const n = { ...prev }; delete n[classId]; return n; }); }
  };

  const handlePause      = (id: string) => doAction(id, 'pause',      () => pauseClass(id).unwrap());
  const handleFlagDelete = (id: string) => {
    if (!window.confirm('Signaler pour suppression ? La direction sera notifiée.')) return Promise.resolve();
    return doAction(id, 'delete', () => flagDeleteClass(id).unwrap());
  };
  const handleReactivate = (id: string) => doAction(id, 'active',     () => reactivateClass(id).unwrap());

  // ── Config couleurs / labels par statut ─────────────────────
  const STATUT_CFG = {
    active: { label: '● Active',    badge: 'bg-blue-100 text-blue-700 border-blue-300',    card: 'border-blue-200 bg-blue-50/30' },
    pause:  { label: '⏸ En pause',  badge: 'bg-orange-100 text-orange-700 border-orange-300', card: 'border-orange-200 bg-orange-50/40' },
    delete: { label: '🔴 Signalée', badge: 'bg-red-100 text-red-700 border-red-300',       card: 'border-red-200 bg-red-50/40' },
  };

  type TabKey = 'active' | 'pause' | 'delete';
  const TABS: { key: TabKey; label: string; color: string; activeColor: string }[] = [
    { key: 'active', label: 'Actives',   color: 'text-blue-600',   activeColor: 'bg-blue-600 text-white' },
    { key: 'pause',  label: 'En pause',  color: 'text-orange-600', activeColor: 'bg-orange-500 text-white' },
    { key: 'delete', label: 'Signalées', color: 'text-red-600',    activeColor: 'bg-red-500 text-white' },
  ];

  // Actions disponibles selon le statut courant de la carte
  const actionsFor = (classe: any): { label: string; icon: any; handler: () => void; style: string; key: string }[] => {
    const id = classe.id;
    const s  = classe.statut === 'en_pause' ? 'pause' : (classe.statut === 'fin_session' || classe.statut === 'a_supprimer') ? 'delete' : 'active';
    if (s === 'active') return [
      { key: 'pause',  label: 'Mettre en pause', icon: PauseCircle, handler: () => handlePause(id), style: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200' },
      { key: 'delete', label: 'Signaler suppression', icon: Trash2, handler: () => handleFlagDelete(id), style: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' },
    ];
    if (s === 'pause') return [
      { key: 'active', label: 'Remettre active',  icon: CheckCircle, handler: () => handleReactivate(id), style: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' },
      { key: 'delete', label: 'Signaler suppression', icon: Trash2, handler: () => handleFlagDelete(id), style: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' },
    ];
    // delete
    return [
      { key: 'active', label: 'Remettre active', icon: CheckCircle, handler: () => handleReactivate(id), style: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' },
      { key: 'pause',  label: 'Mettre en pause', icon: PauseCircle, handler: () => handlePause(id),      style: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200' },
    ];
  };

  const displayedClasses = classesByStatut[panelTab];



  const [filters, setFilters] = useState<PlanningFilters>({
    view: 'week',
    ...(professorId ? { professeur_id: professorId } : {}),   // ← injecter dès le init
  });
  const [selectedItem, setSelectedItem] = useState<PlanningItem | null>(null);
  
  const { data, isLoading, isFetching, refetch } = useGetPlanningQuery(filters);
  const items = data?.results || [];

  // 🔷 Handlers typés (fini les "implicit any")
  const handleViewChange = (view: PlanningFilters['view']) => setFilters(prev => ({ ...prev, view }));
  const handleDateChange = (dates: { start_date?: string; end_date?: string }) => setFilters(prev => ({ ...prev, ...dates }));
  const handleStatusChange = (status: PlanningFilters['statut_realisation']) => setFilters(prev => ({ ...prev, statut_realisation: status }));

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  // Dériver la date courante depuis les filtres (ou aujourd'hui par défaut)
  const currentDate = filters.start_date || new Date().toISOString().split('T')[0];
  const currentMonth = currentDate.substring(0, 7); // "YYYY-MM"
  return (
    <div className="space-y-4 max-w-7xl mx-auto p-4">
      
      {/* 🎛️ Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
        <h1 className="text-xl font-bold text-gray-900">📊 Planning</h1>
        <div className="flex flex-wrap gap-2">
          <ViewToggle current={filters.view} onChange={handleViewChange} />
          {/* <DateRangePicker value={filters} onChange={handleDateChange} /> */}
          <StatusFilter value={filters.statut_realisation} onChange={handleStatusChange} />
          <button onClick={() => refetch()} disabled={isFetching} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          {/* ── Bouton Mes Classes ── */}
          <button
            onClick={() => setClassPanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium border border-indigo-200 transition"
          >
            <BookOpen className="w-4 h-4" />
            Mes Classes
            {totalAll > 0 && (
              <span className="ml-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-bold px-1.5 py-0.5 leading-none">
                {totalAll}
              </span>
            )}
          </button>
        </div>
      </div>

      <StatsBar data={items} />

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[400px]">
        {filters.view === 'week' && (
          <WeekViewWithAdd
            items={items}
            onSelect={setSelectedItem}
            classes={classesData?.results || []}
            isCreating={isCreating}
            isUpdating={isUpdating}
            professeurId={effectiveProfesseurId}
            onConfirm={async (payload) => {
              await createSeance(payload).unwrap();
              refetch();
            }}
            onUpdate={async (payload: UpdateSeancePayload) => {
              await updateSeance(payload).unwrap();
              refetch();
            }}
          />
        )}
        
        {filters.view === 'day' && (
          <DayView items={items} onSelect={setSelectedItem} currentDate={currentDate} />
        )}
        
        {filters.view === 'month' && (
          <MonthView items={items} onSelect={setSelectedItem} currentMonth={currentMonth} />
        )}
        
        {filters.view === 'list' && <ListView items={items} onSelect={setSelectedItem} />}
      </div>

      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}

      {/* ── Panneau latéral "Mes Classes" ── */}
      {classPanelOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setClassPanelOpen(false)} />

          <div
            className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col"
            style={{ animation: 'slideInRight .22s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            {/* ── Header ── */}
            <div className="px-5 py-4 border-b bg-gradient-to-r from-indigo-600 to-violet-600 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-white">
                  <BookOpen className="w-5 h-5" />
                  <span className="font-bold text-base">Mes Classes</span>
                </div>
                <button onClick={() => setClassPanelOpen(false)} className="text-white/70 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ── Onglets ── */}
              <div className="flex gap-1 bg-white/15 rounded-lg p-1">
                {TABS.map(tab => {
                  const count = classesByStatut[tab.key].length;
                  const isActive = panelTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setPanelTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        isActive ? tab.activeColor : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tab.label}
                      {count > 0 && (
                        <span className={`text-[9px] font-bold px-1.5 rounded-full leading-none py-0.5 ${
                          isActive ? 'bg-white/30' : 'bg-white/20'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Corps ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {displayedClasses.length === 0 && (
                <div className="text-center py-14 text-gray-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm font-medium">Aucune classe</p>
                  <p className="text-xs mt-1 opacity-70">dans cet onglet</p>
                </div>
              )}

              {displayedClasses.map((classe: any) => {
                const cfg     = STATUT_CFG[panelTab];
                const loading = actionLoading[classe.id];
                const actions = actionsFor(classe);

                return (
                  <div
                    key={classe.id}
                    className={`rounded-xl border p-3.5 transition-all ${cfg.card} ${loading ? 'opacity-70' : ''}`}
                  >
                    {/* Infos + badge statut */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{classe.nom}</p>
                        {classe.niveau && <p className="text-xs text-gray-500 mt-0.5">Niveau {classe.niveau}</p>}
                        {classe.matiere && <p className="text-xs text-gray-400 truncate">{classe.matiere}</p>}
                      </div>
                      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex gap-2">
                      {actions.map(action => {
                        const Icon = action.icon;
                        const isThisLoading = loading === action.key;
                        return (
                          <button
                            key={action.key}
                            onClick={action.handler}
                            disabled={!!loading}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${action.style}`}
                          >
                            {isThisLoading
                              ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              : <Icon className="w-3.5 h-3.5" />
                            }
                            {action.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Footer légende ── */}
            <div className="border-t px-4 py-3 bg-gray-50 shrink-0">
              <div className="flex items-center justify-around text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Active</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> En pause</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Signalée</span>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); opacity: 0; }
              to   { transform: translateX(0);    opacity: 1; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

// 🔷 SOUS-COMPOSANTS (tous définis & typés)

function ViewToggle({ current, onChange }: { current?: string; onChange: (v: PlanningFilters['view']) => void }) {
  const views: { id: PlanningFilters['view']; icon: any; label: string }[] = [
    { id: 'week', icon: Calendar, label: 'Semaine' },
    /* { id: 'day', icon: Calendar, label: 'Jour' },
    { id: 'month', icon: Calendar, label: 'Mois' },
    { id: 'list', icon: List, label: 'Liste' }, */
  ];
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      {views.map(({ id, icon: Icon, label }) => (
        <button key={id} onClick={() => onChange(id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${current === id ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}>
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function DateRangePicker({ value, onChange }: { value: PlanningFilters; onChange: (dates: { start_date?: string; end_date?: string }) => void }) {
  return (
    <div className="flex gap-2 items-center">
      <input type="date" value={value.start_date || ''} onChange={e => onChange({ ...value, start_date: e.target.value })} className="text-xs border rounded px-2 py-1" />
      <input type="date" value={value.end_date || ''} onChange={e => onChange({ ...value, end_date: e.target.value })} className="text-xs border rounded px-2 py-1" />
    </div>
  );
}

// 🔷 Composant StatusFilter corrigé
function StatusFilter({ value, onChange }: { value?: string; onChange: (s: PlanningFilters['statut_realisation']) => void }) {
  const options: StatutKey[] = ['active', 'en_pause', 'a_supprimer', 'disponibilite'];
  
  return (
    <select 
      value={value || ''} 
      onChange={e => onChange(e.target.value as PlanningFilters['statut_realisation'])} 
      className="text-xs border rounded px-2 py-1"
    >
      <option value="">Tous les statuts</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{STATUT_LABELS[opt]}</option>
      ))}
    </select>
  );
}

function StatsBar({ data }: { data: PlanningItem[] }) {
  const stats = useMemo(() => ({
    total: data.length,
    completed: data.filter(i => i.statut_realisation === 'completed').length,
    in_progress: data.filter(i => i.statut_realisation === 'in_progress').length,
    absent: data.filter(i => i.statut_realisation === 'absent').length,
    late: data.filter(i => i.statut_realisation === 'late').length,
  }), [data]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: 'Total', value: stats.total, color: 'bg-gray-50 text-gray-700' },
        { label: '✅ Terminés', value: stats.completed, color: 'bg-green-50 text-green-700' },
        { label: '🔴 En cours', value: stats.in_progress, color: 'bg-blue-50 text-blue-700' },
        { label: '⚠️ Retards', value: stats.late, color: 'bg-orange-50 text-orange-700' },
        { label: '❌ Absents', value: stats.absent, color: 'bg-red-50 text-red-700' },
      ].map(({ label, value, color }) => (
        <div key={label} className={`p-3 rounded-lg text-center ${color}`}>
          <div className="text-lg font-bold">{value}</div>
          <div className="text-xs opacity-80">{label}</div>
        </div>
      ))}
    </div>
  );
}

function WeekView({ items, onSelect }: { items: PlanningItem[]; onSelect: (item: PlanningItem) => void }) {
  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const HEURES = Array.from({ length: 14 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);

  // ✅ Grille basée sur l'index résolu (date_seance OU jour_seance)
  const grid = useMemo(() => {
    const map: Record<string, PlanningItem[]> = {};
    items.forEach(item => {
      const jourIdx = resolveWeekdayIndex(item);
      const heure = extractTimeKey(item.heure_debut_reelle);
      if (jourIdx === -1 || !heure) return;
      const key = `${jourIdx}-${heure}`;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [items]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            <th className="p-3 text-left font-medium text-gray-600 border-b w-16">Heure</th>
            {JOURS.map(j => <th key={j} className="p-3 text-center font-medium text-gray-700 border-b min-w-[140px]">{j}</th>)}
          </tr>
        </thead>
        <tbody>
          {HEURES.map(heure => (
            <tr key={heure} className="border-b hover:bg-gray-50/50">
              <td className="p-3 font-mono text-gray-500 border-r bg-gray-50/30">{heure}</td>
              {JOURS.map((_, jourIdx) => {
                const key = `${jourIdx}-${heure}`;
                const dayItems = grid[key] || [];
                return (
                  <td key={key} className="p-2 min-h-[80px] align-top border-r last:border-r-0">
                    {dayItems.map(item => (
                      <PlanningCard key={item.id} item={item} onClick={() => onSelect(item)} compact />
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayView({ items, onSelect, currentDate }: {
  items: PlanningItem[];
  onSelect: (item: PlanningItem) => void;
  currentDate: string;
}) {
  const HEURES = Array.from({ length: 14 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);
  const PX_PAR_HEURE = 70;
  
  const dayItems = useMemo(() =>
    items.filter(item => resolveDisplayDate(item, currentDate) === currentDate),
    [items, currentDate]
  );

  const grouped = useMemo(() => {
    const map: Record<string, PlanningItem[]> = {};
    dayItems.forEach(item => {
      const hour = extractTimeKey(item.heure_debut_reelle);
      if (!hour) return;
      if (!map[hour]) map[hour] = [];
      map[hour].push(item);
    });
    return map;
  }, [dayItems]);

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4 capitalize">📅 {formatDate(currentDate)}</h3>
      {dayItems.length === 0 && (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">Aucune séance ce jour.</div>
      )}
      <div className="space-y-1">
        {HEURES.map(heure => {
          const slots = grouped[heure] || [];
          return (
            <div key={heure} className="flex gap-3 border-b border-gray-100 pb-1">
              <span className="w-14 text-sm font-mono text-gray-400 pt-2">{heure}</span>
              <div className="flex-1 relative" style={{ minHeight: `${PX_PAR_HEURE}px` }}>
                {slots.map(item => {
                  const duration = item.duree_reelle_minutes || 60;
                  const heightPx = Math.max(50, (duration / 60) * PX_PAR_HEURE);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelect(item)}
                      className={`absolute inset-x-0 top-0 text-left p-2 rounded-lg border-l-4 transition hover:shadow-sm ${STATUT_COLORS[item.statut_realisation]}`}
                      style={{ height: `${heightPx}px` }}
                    >
                      <div className="font-medium text-xs">{item.classe.nom}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">
                        {item.classe.professeur?.display_name} • {duration}min
                        {item.jour_seance && <span className="ml-1 text-gray-400">({item.jour_seance})</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ items, onSelect, currentMonth }: { 
  items: PlanningItem[]; 
  onSelect: (item: PlanningItem) => void; 
  currentMonth: string; // Format: "YYYY-MM"
}) {
  const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const [year, month] = currentMonth.split('-').map(Number);
  
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Lundi = 0

  // Regrouper les séances par date
  const itemsByDate = useMemo(() => {
    const map: Record<string, PlanningItem[]> = {};
    items.forEach(item => {
      if (item.date_seance) {
        if (!map[item.date_seance]) map[item.date_seance] = [];
        map[item.date_seance].push(item);
      }
    });
    return map;
  }, [items]);

  // Générer les cellules du calendrier
  const calendarCells: React.ReactNode[] = [];
  const totalCells = startWeekday + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  for (let i = 0; i < rows * 7; i++) {
    const dayNum = i - startWeekday + 1;
    const isCurrentMonth = dayNum > 0 && dayNum <= daysInMonth;
    const dateStr = isCurrentMonth ? `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}` : '';
    const dayItems = isCurrentMonth ? (itemsByDate[dateStr] || []) : [];

    calendarCells.push(
      <div key={i} className={`min-h-[90px] border-r border-b p-1 ${!isCurrentMonth ? 'bg-gray-50/50' : ''}`}>
        {isCurrentMonth && (
          <>
            <div className={`text-xs font-medium mb-1 ${dayNum === new Date().getDate() && month === new Date().getMonth() + 1 ? 'text-primary-600 font-bold' : 'text-gray-500'}`}>
              {dayNum}
            </div>
            {dayItems.slice(0, 2).map(item => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className={`w-full text-left px-1.5 py-0.5 mb-0.5 rounded text-[10px] truncate border-l-2 ${STATUT_COLORS[item.statut_realisation]}`}
              >
                {item.classe.nom}
              </button>
            ))}
            {dayItems.length > 2 && (
              <div className="text-[10px] text-gray-500 pl-1.5">+{dayItems.length - 2} autres</div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold capitalize">📆 {formatDate(currentMonth)}</h3>
      </div>
      <div className="grid grid-cols-7 border-l border-t">
        {JOURS.map(j => (
          <div key={j} className="p-2 text-center font-medium text-gray-600 bg-gray-50 border-b border-r text-xs">
            {j}
          </div>
        ))}
        {calendarCells}
      </div>
    </div>
  );
}

function ListView({ items, onSelect }: { items: PlanningItem[]; onSelect: (item: PlanningItem) => void }) {
  return (
    <div className="divide-y">
      {items.map(item => (
        <div key={item.id} onClick={() => onSelect(item)} className="p-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center">
          <div>
            <div className="font-medium">{item.classe.nom}</div>
            <div className="text-sm text-gray-600">{item.date_seance} • {item.heure_debut_reelle} • {item.duree_reelle_minutes}min</div>
          </div>
          <StatusBadge statut={item.statut_realisation} />
        </div>
      ))}
    </div>
  );
}

function PlanningCard({ item, onClick, compact = false }: { item: PlanningItem; onClick: () => void; compact?: boolean }) {

// PlanningCard
const colorClass = STATUT_COLORS[item.statut ?? ''] 
  || STATUT_COLORS[item.statut_realisation] 
  || STATUT_COLORS['planned'];

  const showEcart = item.ecart_minutes !== null && Math.abs(item.ecart_minutes) >= 5;

  return (
    <button onClick={onClick} className={`w-full text-left p-2 rounded-lg border-l-4 mb-1.5 transition hover:shadow-sm ${colorClass}`}>
      <div className="font-medium truncate">{item.classe.nom}</div>
      {!compact && <div className="text-gray-600 truncate text-[10px]">{item.classe.professeur?.display_name}</div>}
      <div className="flex items-center justify-between mt-1">
        <StatusBadge statut={item.statut_realisation} compact={compact} />
        {item.is_today && <span className="text-[9px] text-blue-600 font-medium ml-1">Aujourd'hui</span>}
      </div>
      {showEcart && !compact && (
        <div className={`text-[9px] mt-0.5 ${item.ecart_minutes! > 0 ? 'text-green-700' : 'text-red-700'}`}>
          {item.ecart_minutes! > 0 ? '▲' : '▼'} {Math.abs(item.ecart_minutes!)}min
        </div>
      )}
    </button>
  );
}

function StatusBadge({ statut, compact = false }: { statut: string; compact?: boolean }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    planned: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Prévu' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En cours' },
    completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Terminé' },
    absent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Absent' },
    late: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Retard' },
    horaire_valide:     { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '✅ Validé' },
    horaire_non_valide: { bg: 'bg-red-100',     text: 'text-red-700',     label: '✗ Rejeté' },
    disponibilite:      { bg: 'bg-gray-100',    text: 'text-gray-600',    label: 'Disponibilité' },
  };
  const c = config[statut] || config.planned;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.text}`}>
      {compact ? '•' : c.label}
    </span>
  );
}

function DetailModal({ item, onClose }: { item: PlanningItem; onClose: () => void }) {
  const isDispo = !item.classe;
  const profName = isDispo
    ? (item as any).professeur_disponible?.display_name ?? '—'
    : item.classe?.professeur?.display_name ?? '—';
  const titre = isDispo ? '🟢 Disponibilité' : item.classe?.nom ?? '—';

  // Résoudre le label du statut
  const statutKey = item.statut ?? '';
  const statutLabel =
    STATUT_LABELS[statutKey] ??
    STATUT_LABELS[item.statut_realisation] ??
    statutKey ??
    '—';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{titre}</h3>
            <p className="text-gray-600 text-sm">{profName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Badge statut bien visible */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${STATUT_COLORS[statutKey] || STATUT_COLORS['planned']}`}>
          {statutLabel}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Date" value={item.date_seance ?? item.jour_seance ?? '—'} />
          <InfoRow label="Horaire" value={`${item.heure_debut_reelle ?? '—'} • ${item.duree_reelle_minutes ?? '—'}min`} />
          {!isDispo && (
            <InfoRow label="Réalisation" value={STATUT_LABELS[item.statut_realisation] ?? item.statut_realisation ?? '—'} />
          )}
          {item.ecart_minutes !== null && item.ecart_minutes !== undefined && (
            <div className="col-span-2">
              <span className="text-gray-500 text-xs">Écart prévu/réel</span>
              <p className={`font-semibold ${item.ecart_minutes > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {item.ecart_minutes > 0 ? '+' : ''}{item.ecart_minutes} min
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div><span className="text-gray-500 text-xs">{label}</span><p className="font-medium">{value || '—'}</p></div>;
}