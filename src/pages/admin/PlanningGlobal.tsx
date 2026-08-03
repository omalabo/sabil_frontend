import { Fragment, useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, RefreshCw, X,
  AlertCircle, CheckCircle, Clock, BookOpen,
  PauseCircle, Trash2, RotateCcw, ShieldAlert,
  Receipt, Users, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useGetAdminAbsenceCalendarQuery,
  useSignalerAbsenceMutation,
  useRevoquerAbsenceMutation,
  useGetUsersQuery,
  useGetClassesQuery,
  useGetPlanningQuery,
  useGetClassStudentsQuery,
  usePauseClassMutation,
  useFlagDeleteClassMutation,
  useReactivateClassMutation,
  useDeleteClassMutation,
  useGetFacturesEmisesQuery,
  useGetFactureEleveByFactureQuery,
  useConfirmerFactureEleveMutation,
  useConfirmerToutFactureEleveMutation,
  useSendFactureReminderMutation,
  useCreateFactureMutation,
  usePreviewFactureMutation,
  useLazyGetFactureParticipantsQuery,
  useUpdateParticipantsPaymentMutation,
  useGetProfFacturePresencesQuery,
  useGetAdminFacturesEmisesQuery,
  useGetAdminFacturePresencesQuery,
  usePreviewAdminFactureMutation,
} from '../../store/apiSlice';
import {
  Facture, FacturePreview, FactureLigne,
  FactureParticipant, ParticipantsPaymentData,
  ParticipantPaymentInput, FactureElevePayeItem,
} from '../../types';
import { AbsenceSignaler, SeanceManquee } from '../../types';
import { PlanningItem, User } from '../../types';
import SubmitFactureModal from '../../components/shared/Submitfacturemodal';
// Changer l'import
import { WeekViewWithAdd } from '../../components/shared/AddSeanceOverlay';
import type { UpdateSeancePayload } from '../../components/shared/AddSeanceOverlay';
// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const ABSENCE_DATE_MIN = '2026-05-15'; // ← modifier ici si besoin

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAYS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

const STATUT_COLORS_PLANNING: Record<string, string> = {
  planned:     'bg-blue-50 border-blue-400 text-blue-800',
  in_progress: 'bg-indigo-50 border-indigo-400 text-indigo-800',
  completed:   'bg-green-50 border-green-400 text-green-800',
  absent:      'bg-red-50 border-red-400 text-red-800',
  late:        'bg-orange-50 border-orange-400 text-orange-800',
};

const JOUR_TO_IDX: Record<string, number> = {
  lundi: 0, mardi: 1, mercredi: 2, jeudi: 3,
  vendredi: 4, samedi: 5, dimanche: 6,
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
}
function dayIdx(date: Date) { const d = date.getDay(); return d === 0 ? 6 : d - 1; }
function isoDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
const todayStr = isoDate(new Date());

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'dd MMM yyyy', { locale: fr }); }
  catch { return iso; }
}

// Résout la date affichée d'un PlanningItem dans le mois courant
function resolveItemDate(item: PlanningItem, year: number, month: number): string | null {
  if (item.date_seance) {
    const [y, m] = item.date_seance.split('-').map(Number);
    if (y === year && m === month) return item.date_seance;
    return null;
  }
  if (item.jour_seance) {
    const idx = JOUR_TO_IDX[item.jour_seance.toLowerCase().trim()];
    if (idx === undefined) return null;
    // Trouver la prochaine occurrence dans le mois — on retourne toutes les occurrences plus bas
    return null; // géré séparément
  }
  return null;
}

function getOccurrencesInMonth(jourSeance: string, year: number, month: number): string[] {
  const idx = JOUR_TO_IDX[jourSeance.toLowerCase().trim()];
  if (idx === undefined) return [];
  const days = getDaysInMonth(year, month);
  return days.filter(d => dayIdx(d) === idx).map(isoDate);
}

// ─────────────────────────────────────────────────────────────
// PROF SELECTOR
// ─────────────────────────────────────────────────────────────
function ProfSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data } = useGetUsersQuery({ role: 'professeur', page_size: 200 } as any);
  const profs: User[] = data?.results ?? [];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white pr-8 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 appearance-none cursor-pointer font-medium"
        style={{ minWidth: 200 }}
      >
        <option value="">— Choisir un professeur —</option>
        {profs.map(p => <option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CLASSE TABS (filtre calendrier par classe)
// ─────────────────────────────────────────────────────────────
function ClasseTabs({
  profId,
  selectedClasseId,
  onSelect,
}: {
  profId: string;
  selectedClasseId: string;
  onSelect: (id: string) => void;
}) {
  const { data: classesData } = useGetClassesQuery({ professeur_id: profId } as any, { skip: !profId });
  const classes: any[] = classesData?.results ?? [];

  if (!profId || classes.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Filtrer par classe</p>
      <div className="flex flex-wrap gap-2">
        {/* Onglet "Toutes" */}
        <button
          onClick={() => onSelect('')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
            selectedClasseId === ''
              ? 'bg-slate-700 text-white border-slate-700'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          Toutes
        </button>
        {classes.map(c => (
          <ClasseTab key={c.id} classe={c} active={selectedClasseId === c.id} onClick={() => onSelect(c.id)} />
        ))}
      </div>
    </div>
  );
}

function ClasseTab({ classe, active, onClick }: { classe: any; active: boolean; onClick: () => void }) {
  const { data } = useGetClassStudentsQuery(classe.id, { skip: false });
  const count = (data as any)?.count ?? (data as any)?.results?.length ?? 0;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
      }`}
    >
      <span className="truncate max-w-[120px]">{classe.nom}</span>
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${
        active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
      }`}>
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// ACTION MODAL (signaler / révoquer)
// ─────────────────────────────────────────────────────────────
type DayEntry =
  | { kind: 'manquee';  item: SeanceManquee }
  | { kind: 'signalee'; item: AbsenceSignaler }
  | { kind: 'planning'; item: PlanningItem };

function ActionModal({
  date, entries, onSignaler, onRevoquer, onClose, loading,
}: {
  date: string;
  entries: DayEntry[];
  onSignaler: (seanceId: string, date: string) => void;
  onRevoquer: (absenceId: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [d, m, y] = [date.slice(8,10), date.slice(5,7), date.slice(0,4)];
  const absEntries = entries.filter(e => e.kind !== 'planning');
  const planEntries = entries.filter(e => e.kind === 'planning');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: '_pop .2s cubic-bezier(.34,1.56,.64,1) both' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-gradient-to-r from-slate-700 to-slate-800 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">{`${d}/${m}/${y}`}</p>
            <p className="text-white/60 text-xs">{entries.length} entrée{entries.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="divide-y max-h-[480px] overflow-y-auto">
          {/* Séances planning (bleues, info only) */}
          {planEntries.map((e, i) => {
            const p = (e as any).item as PlanningItem;
            const colorCls = STATUT_COLORS_PLANNING[p.statut_realisation] ?? STATUT_COLORS_PLANNING.planned;
            return (
              <div key={`plan-${p.id}`} className={`p-3 border-l-4 ${colorCls} mx-4 my-2 rounded-lg`}>
                <p className="font-semibold text-xs">{p.classe?.nom ?? '—'}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {p.heure_debut_reelle ? String(p.heure_debut_reelle).slice(0,5) : ''}
                  {p.duree_reelle_minutes ? ` · ${p.duree_reelle_minutes}min` : ''}
                  {' · '}{p.statut_realisation}
                </p>
              </div>
            );
          })}

          {/* Absences à signaler / signalées */}
          {absEntries.map(e => {
            if (e.kind === 'manquee') {
              const m = e.item;
              return (
                <div key={`manquee-${m.seance_id}-${m.date}`} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                      <p className="font-semibold text-gray-900 text-sm truncate">{m.classe_nom ?? '—'}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {m.jour_seance ?? ''}{m.heure ? ` · ${m.heure}` : ''}{m.duree ? ` · ${m.duree}min` : ''}
                    </p>
                    <span className="inline-block mt-1 text-[10px] bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5 font-medium">À signaler</span>
                  </div>
                  <button
                    disabled={loading}
                    onClick={() => onSignaler(m.seance_id, m.date)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition disabled:opacity-50"
                  >
                    <AlertCircle className="w-3.5 h-3.5" /> Signaler
                  </button>
                </div>
              );
            } else {
              const a = e.item;
              return (
                <div key={`signalee-${a.id}`} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <p className="font-semibold text-gray-900 text-sm truncate">{a.seance_classe_nom ?? '—'}</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {a.seance_jour ?? ''}{a.seance_heure ? ` · ${a.seance_heure}` : ''}{a.seance_duree ? ` · ${a.seance_duree}min` : ''}
                    </p>
                    {a.remarque && <p className="text-[10px] text-gray-400 mt-0.5 truncate">💬 {a.remarque}</p>}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5 font-medium">Signalée</span>
                      <span className="text-[10px] text-gray-400">par {a.admin_display_name}</span>
                    </div>
                  </div>
                  <button
                    disabled={loading}
                    onClick={() => onRevoquer(a.id)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Révoquer
                  </button>
                </div>
              );
            }
          })}
        </div>

        <div className="px-5 py-3 border-t">
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium">Fermer</button>
        </div>
      </div>
      <style>{`@keyframes _pop{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PANNEAU CLASSES ADMIN
// ─────────────────────────────────────────────────────────────
function ClassesAdminPanel({ onClose }: { onClose: () => void }) {
  const [panelTab, setPanelTab] = useState<'active' | 'pause' | 'signalees'>('active');
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});

  const { data: classesData, refetch: refetchClasses } = useGetClassesQuery({});
  const [pauseClass]      = usePauseClassMutation();
  const [flagDeleteClass] = useFlagDeleteClassMutation();
  const [reactivate]      = useReactivateClassMutation();
  const [deleteClass]     = useDeleteClassMutation();

  const allClasses: any[] = classesData?.results ?? [];
  const classesByTab = {
    active:    allClasses.filter(c => c.statut === 'active' || c.statut === 'actif' || !c.statut),
    pause:     allClasses.filter(c => c.statut === 'en_pause'),
    signalees: allClasses.filter(c => c.statut === 'fin_session' || c.statut === 'a_supprimer'),
  };

  const TABS = [
    { key: 'active' as const,    label: 'Actives',   activeColor: 'bg-blue-600 text-white' },
    { key: 'pause' as const,     label: 'En pause',  activeColor: 'bg-orange-500 text-white' },
    { key: 'signalees' as const, label: 'Signalées', activeColor: 'bg-red-500 text-white' },
  ];
  const CARD_STYLE = {
    active: 'border-blue-200 bg-blue-50/30', pause: 'border-orange-200 bg-orange-50/40', signalees: 'border-red-200 bg-red-50/40',
  };
  const BADGE_STYLE = {
    active: 'bg-blue-100 text-blue-700 border-blue-300', pause: 'bg-orange-100 text-orange-700 border-orange-300', signalees: 'bg-red-100 text-red-700 border-red-300',
  };
  const BADGE_LABEL = { active: '● Active', pause: '⏸ En pause', signalees: '🔴 Signalée' };

  const doAction = async (id: string, key: string, fn: () => Promise<any>) => {
    setActionLoading(p => ({ ...p, [id]: key }));
    try { await fn(); refetchClasses(); } catch (e) { console.error(e); }
    finally { setActionLoading(p => { const n = { ...p }; delete n[id]; return n; }); }
  };

  const actionsFor = (c: any) => {
    const id = c.id;
    if (panelTab === 'active') return [
      { key: 'pause', label: 'Mettre en pause', icon: PauseCircle, style: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200', handler: () => doAction(id, 'pause', () => pauseClass(id).unwrap()) },
      { key: 'flag', label: 'Marquer à supprimer', icon: ShieldAlert, style: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200', handler: () => { if (window.confirm('Marquer pour suppression ?')) doAction(id, 'flag', () => flagDeleteClass(id).unwrap()); } },
    ];
    if (panelTab === 'pause') return [
      { key: 'active', label: 'Remettre active', icon: RotateCcw, style: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200', handler: () => doAction(id, 'active', () => reactivate(id).unwrap()) },
      { key: 'flag', label: 'Marquer à supprimer', icon: ShieldAlert, style: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200', handler: () => { if (window.confirm('Marquer pour suppression ?')) doAction(id, 'flag', () => flagDeleteClass(id).unwrap()); } },
    ];
    return [
      { key: 'active', label: 'Remettre active', icon: RotateCcw, style: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200', handler: () => doAction(id, 'active', () => reactivate(id).unwrap()) },
      { key: 'delete', label: 'Supprimer définitivement', icon: Trash2, style: 'bg-red-600 hover:bg-red-700 text-white border-red-600', handler: () => { if (window.confirm(`Supprimer "${c.nom}" ? Irréversible.`)) doAction(id, 'delete', () => deleteClass(id).unwrap()); } },
    ];
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col" style={{ animation: 'slideInRight .22s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div className="px-5 py-4 border-b bg-gradient-to-r from-indigo-600 to-violet-600 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white"><BookOpen className="w-5 h-5" /><span className="font-bold text-base">Gestion des classes</span></div>
            <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex gap-1 bg-white/15 rounded-lg p-1">
            {TABS.map(tab => {
              const count = classesByTab[tab.key].length;
              const isAct = panelTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setPanelTab(tab.key)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all ${isAct ? tab.activeColor : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                  {tab.label}
                  {count > 0 && <span className={`text-[9px] font-bold px-1.5 rounded-full py-0.5 ${isAct ? 'bg-white/30' : 'bg-white/20'}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {classesByTab[panelTab].length === 0 && (
            <div className="text-center py-14 text-gray-400"><BookOpen className="w-10 h-10 mx-auto mb-3 opacity-25" /><p className="text-sm">Aucune classe</p></div>
          )}
          {classesByTab[panelTab].map((c: any) => {
            const loading = actionLoading[c.id];
            return (
              <div key={c.id} className={`rounded-xl border p-3.5 ${CARD_STYLE[panelTab]} ${loading ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{c.nom}</p>
                    {c.niveau && <p className="text-xs text-gray-500 mt-0.5">Niveau {c.niveau}</p>}
                    {c.professeur?.display_name && <p className="text-xs text-gray-400 truncate mt-0.5">👤 {c.professeur.display_name}</p>}
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${BADGE_STYLE[panelTab]}`}>{BADGE_LABEL[panelTab]}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {actionsFor(c).map(action => {
                    const Icon = action.icon;
                    return (
                      <button key={action.key} onClick={action.handler} disabled={!!loading} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${action.style} disabled:opacity-50`}>
                        {loading === action.key ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t bg-gray-50 shrink-0">
          <p className="text-[10px] text-gray-400 text-center">Total : {allClasses.filter(c => c.statut !== 'supprimer').length} classe(s)</p>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// PANNEAU FACTURES
// ─────────────────────────────────────────────────────────────
interface PresenceFacturable { id: string; created_at: string; classe: string; classe_nom: string; seance: string; seance_titre: string; nb_participants: number; nb_inscrits: number; }

const FACTURE_TABS = [
  { key: 'brouillon', label: 'Brouillons', color: 'bg-gray-600 text-white' },
  { key: 'envoyee',   label: 'En attente', color: 'bg-amber-500 text-white' },
  { key: 'payee',     label: 'Payées',     color: 'bg-emerald-600 text-white' },
] as const;
type FactureTab = typeof FACTURE_TABS[number]['key'];

function FacturesPanel({ profId, onClose }: { profId: string; onClose: () => void }) {
  const [factureTab, setFactureTab] = useState<FactureTab>('envoyee');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState<Record<string, boolean>>({});
  const [confirmingSingle, setConfirmingSingle] = useState<Record<string, boolean>>({});
  const [factureASoumettre, setFactureASoumettre] = useState<Facture | null>(null);

  // Form génération
  const [form, setForm] = useState({ classe_id: '', date_debut: '', date_fin: '', lien_paypal: '', rib: '' });
  const [preview, setPreview] = useState<FacturePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<FactureParticipant[]>([]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [allAmountsFilled, setAllAmountsFilled] = useState(true);
  const [participantsPaymentData, setParticipantsPaymentData] = useState<ParticipantsPaymentData | null>(null);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: facturesData, refetch } = useGetAdminFacturesEmisesQuery(
    { professeur_id: profId },
    { skip: !profId }
  );

  const { data: factureEleveData, isLoading: eleveLoading } = useGetFactureEleveByFactureQuery(
  expandedId ?? '',
  { skip: !expandedId }
);

  const { data: presencesData } = useGetAdminFacturePresencesQuery(
    profId,
    { skip: !profId }
  );
  const presences: PresenceFacturable[] = (presencesData as any)?.results ?? presencesData ?? [];

  const [confirmerFactureEleve] = useConfirmerFactureEleveMutation();
  const [confirmerToutFactureEleve] = useConfirmerToutFactureEleveMutation();
  const [sendReminder] = useSendFactureReminderMutation();
  const [previewAdminFacture, { isLoading: previewing }] = usePreviewAdminFactureMutation();
  const [triggerGetParticipants, { isLoading: participantsLoading }] = useLazyGetFactureParticipantsQuery();
  const [updateParticipantsPayment] = useUpdateParticipantsPaymentMutation();

  const allFactures: Facture[] = facturesData?.results ?? [];
  const facturesByTab = {
    brouillon: allFactures.filter(f => f.statut === 'brouillon'),
    envoyee:   allFactures.filter(f => f.statut === 'envoyee'),
    payee:     allFactures.filter(f => f.statut === 'payee'),
  };
  console.log('facturesByTab', facturesByTab); // ← ajouter
  const displayedFactures = facturesByTab[factureTab] ?? [];
  
  const classesUniques = [...new Map((presences as PresenceFacturable[]).map(p => [p.classe, p])).values()];

  useEffect(() => {
    const values = Object.values(paymentAmounts);
    if (!values.length) { setAllAmountsFilled(true); return; }
    const hasAny = values.some(v => v !== '');
    setAllAmountsFilled(hasAny ? values.every(v => v !== '') : true);
  }, [paymentAmounts]);

  useEffect(() => {
    if (!showPartDropdown) return;
    const h = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowPartDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showPartDropdown]);

  const handlePreview = async () => {
    if (!form.classe_id || !form.date_debut || !form.date_fin) { setPreviewError('Veuillez renseigner la classe et les deux dates.'); return; }
    setPreviewError(null);
    try {
      const r =  await previewAdminFacture({ professeur_id: profId, classe_id: form.classe_id, date_debut: form.date_debut, date_fin: form.date_fin }).unwrap();
      setPreview(r); setParticipants([]); setPaymentAmounts({}); setParticipantsPaymentData(null);
    } catch (err: any) { setPreviewError(err?.data?.error ?? "Erreur aperçu"); setPreview(null); }
  };

 
  const handleConfirmAll = async (id: string) => {
    setConfirmingAll(p => ({ ...p, [id]: true }));
    try { const r = await confirmerToutFactureEleve({ facture_id: id }).unwrap(); refetch(); }
    catch (e: any) { alert(e?.data?.error ?? 'Erreur'); }
    finally { setConfirmingAll(p => ({ ...p, [id]: false })); }
  };

  const handleConfirmSingle = async (feId: string) => {
    setConfirmingSingle(p => ({ ...p, [feId]: true }));
    try { await confirmerFactureEleve(feId).unwrap(); refetch(); }
    catch (e: any) { alert(e?.data?.error ?? 'Erreur'); }
    finally { setConfirmingSingle(p => ({ ...p, [feId]: false })); }
  };


 


  function BlinkingIndicator({ count }: { count: number }) {
    if (count <= 0) return null;
    return (
      <span className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 bg-orange-100 border border-orange-300 rounded-full animate-pulse">
        <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
        <span className="text-[9px] font-medium text-orange-700">{count}</span>
      </span>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full bg-white shadow-2xl z-50 flex flex-col" style={{ width: 420, animation: 'slideInRight .22s cubic-bezier(0.34,1.56,0.64,1)' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b bg-gradient-to-r from-emerald-600 to-teal-700 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white"><Receipt className="w-5 h-5" /><span className="font-bold text-base">Factures</span></div>
            <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          {/* Onglets */}
          <div className="flex gap-1 bg-white/15 rounded-lg p-1 flex-wrap">
            {FACTURE_TABS.map(t => {
             const isAct = factureTab === t.key;
              return (
                <button key={t.key} onClick={() => setFactureTab(t.key)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all min-w-[60px] ${isAct ? t.color : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Corps */}
        {/* Corps */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3">
            {displayedFactures.length === 0 && (
              <div className="text-center py-14 text-gray-400">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-25" />
                <p className="text-sm">Aucune facture</p>
              </div>
            )}
            {displayedFactures.map((f: Facture) => (
              <div key={f.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Ligne principale */}
                <div className="p-4 cursor-pointer hover:bg-gray-50 transition" onClick={() => setExpandedId(prev => prev === f.id ? null : f.id)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm truncate flex items-center gap-1">
                        {f.classe_nom}
                        <BlinkingIndicator count={f.nb_paiements_a_confirmer ?? 0} />
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{f.nb_eleves_inscrits ?? 0} inscrit(s)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        f.statut === 'payee'   ? 'bg-emerald-100 text-emerald-700' :
                        f.statut === 'envoyee' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {f.statut === 'payee' ? '✅ Payée' : f.statut === 'envoyee' ? '⏳ Envoyée' : '📝 Brouillon'}
                      </span>
                      {expandedId === f.id
                        ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                        : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      }
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{fmtDate(f.date_debut)} → {fmtDate(f.date_fin)}</p>
                    <p className="text-sm font-bold text-gray-900">{parseFloat(f.montant_total).toFixed(2)} €</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400">
                    <span>{f.honoraire}h</span>
                    <span>·</span>
                    <span>{parseFloat(f.taux_horaire).toFixed(2)} €/h</span>
                    {(f.nb_paiements_total ?? 0) > 0 && (
                      <>
                        <span>·</span>
                        <span>{f.nb_paiements_confirmes ?? 0}/{f.nb_paiements_total ?? 0} confirmés</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 pb-3 flex gap-2 flex-wrap">
                  {f.statut === 'envoyee' && (
                    <button
                      onClick={() => sendReminder(f.id)}
                      className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 font-medium transition"
                    >
                      🔔 Rappel
                    </button>
                  )}
                  {(f.nb_paiements_a_confirmer ?? 0) > 0 && (
                    <button
                      disabled={confirmingAll[f.id]}
                      onClick={() => handleConfirmAll(f.id)}
                      className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-medium transition disabled:opacity-50"
                    >
                      {confirmingAll[f.id] ? '⏳' : '✅ Tout confirmer'}
                    </button>
                  )}
                </div>

                {/* Zone expandée — paiements élèves */}
                {expandedId === f.id && (
                  <div className="border-t bg-gray-50 p-4">
                    <p className="text-xs font-bold text-gray-600 mb-3">💰 Paiements élèves</p>
                    {eleveLoading ? (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                      </div>
                    ) : (factureEleveData ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">Aucun paiement enregistré</p>
                    ) : (
                      <div className="space-y-2">
                        {(factureEleveData ?? []).map((fe: FactureElevePayeItem) => (
                          <div key={fe.id} className="flex items-center justify-between gap-2 bg-white rounded-lg border px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-900 truncate">{fe.eleve_nom}</p>
                              <p className="text-[10px] text-gray-400 truncate">{fe.eleve_email}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-mono font-semibold text-gray-800">
                                {Number(fe.montant_payer || 0).toFixed(2)} €
                              </p>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                fe.statut === 'confirmee' ? 'bg-emerald-100 text-emerald-700' :
                                fe.statut === 'payee'     ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {fe.statut === 'confirmee' ? '✅' : fe.statut === 'payee' ? '⏳' : '📝'}
                              </span>
                            </div>
                            {fe.statut === 'payee' && (
                              <button
                                disabled={confirmingSingle[fe.id]}
                                onClick={() => handleConfirmSingle(fe.id)}
                                className="shrink-0 text-[10px] bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {confirmingSingle[fe.id] ? '⏳' : '✓'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer stats */}
        <div className="px-5 py-3 border-t bg-gray-50 shrink-0 flex gap-4 justify-center">
          {(['brouillon','envoyee','payee'] as const).map(s => (
            <div key={s} className="text-center">
              <p className="text-sm font-bold text-gray-700">{facturesByTab[s].length}</p>
              <p className="text-[10px] text-gray-400">{s === 'brouillon' ? 'Brouillons' : s === 'envoyee' ? 'En attente' : 'Payées'}</p>
            </div>
          ))}
        </div>
      </div>

      {factureASoumettre && (
        <SubmitFactureModal
          facture={factureASoumettre}
          onClose={() => setFactureASoumettre(null)}
          onSuccess={() => { setFactureASoumettre(null); refetch(); }}
        />
      )}
    </>
  );
}

 // version locale minimaliste si WeekView n'est pas exporté
  function WeekViewReadOnly({ items, onSelect }: { items: PlanningItem[]; onSelect: (i: PlanningItem) => void }) {
    const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    const HEURES = Array.from({ length: 14 }, (_, i) => `${String(7 + i).padStart(2,'0')}:00`);

    const grid = useMemo(() => {
      const map: Record<string, PlanningItem[]> = {};
      items.forEach(item => {
        const jour = item.jour_seance ? JOUR_TO_IDX[item.jour_seance.toLowerCase().trim()] : (() => {
          if (!item.date_seance) return -1;
          const d = new Date(item.date_seance);
          return d.getDay() === 0 ? 6 : d.getDay() - 1;
        })();
        const heure = item.heure_debut_reelle?.match(/\d{2}:\d{2}/)?.[0];
        if (jour === -1 || !heure) return;
        const key = `${jour}-${heure}`;
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
                {Array.from({ length: 7 }, (_, jourIdx) => {
                  const dayItems = grid[`${jourIdx}-${heure}`] ?? [];
                  return (
                    <td key={jourIdx} className="p-2 align-top border-r last:border-r-0 min-h-[80px]">
                      {dayItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => onSelect(item)}
                          className={`w-full text-left p-2 rounded-lg border-l-4 mb-1 text-[10px] transition hover:shadow-sm ${STATUT_COLORS_PLANNING[item.statut_realisation] ?? STATUT_COLORS_PLANNING.planned}`}
                        >
                          <div className="font-semibold truncate">{item.classe?.nom}</div>
                          <div className="text-gray-500 mt-0.5">{item.duree_reelle_minutes}min</div>
                        </button>
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

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function AbsenceAdminCalendar() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [profId, setProfId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [modal, setModal]   = useState<{ date: string; entries: DayEntry[] } | null>(null);
  const [classPanelOpen, setClassPanelOpen]     = useState(false);
  const [facturesPanelOpen, setFacturesPanelOpen] = useState(false);
  const [calView, setCalView] = useState<'semaine' | 'mois'>('mois');

  // ── Absences data
  const { data: absData, isLoading, isFetching, refetch } = useGetAdminAbsenceCalendarQuery(
    { professeur_id: profId, year, month },
    { skip: !profId }
  );

  // ── Planning data (séances bleues)
  const moisStr = `${year}-${String(month).padStart(2,'0')}`;
  const { data: planningData } = useGetPlanningQuery(
    {
      start_date: `${moisStr}-01`,
      end_date:   `${moisStr}-${String(new Date(year, month, 0).getDate()).padStart(2,'0')}`,
      professeur_id: profId,
      ...(classeId ? { classe_id: classeId } : {}),
    } as any,
    { skip: !profId }
  );
  const planningItems: PlanningItem[] = planningData?.results ?? [];

  const [signaler, { isLoading: isSignaling }] = useSignalerAbsenceMutation();
  const [revoquer, { isLoading: isRevoking }]  = useRevoquerAbsenceMutation();
  const actionLoading = isSignaling || isRevoking;

  const filterDate = (dateStr: string) => dateStr <= todayStr && dateStr >= ABSENCE_DATE_MIN;

  const rawManquees:  SeanceManquee[]   = absData?.seances_manquees   ?? [];
  const rawSignalees: AbsenceSignaler[] = absData?.absences_signalees ?? [];

  const signaleesKey = useMemo(() => {
    const s = new Set<string>();
    rawSignalees.forEach(a => s.add(`${a.seance_id}__${a.date_absence.slice(0,10)}`));
    return s;
  }, [rawSignalees]);

  // Filtrer par date ET par classe si sélectionnée
  const manquees = useMemo(() =>
    rawManquees.filter(m =>
      filterDate(m.date) &&
      !signaleesKey.has(`${m.seance_id}__${m.date}`) &&
      (!classeId || m.seance_classe_id === classeId)
    ),
    [rawManquees, signaleesKey, classeId]
  );

  const signalees = useMemo(() =>
    rawSignalees.filter(a =>
      filterDate(a.date_absence.slice(0,10)) &&
      (!classeId || a.seance_classe_id === classeId)
    ),
    [rawSignalees, classeId]
  );

  // Map date → entries (absences + planning)
  const byDate = useMemo(() => {
  const m: Record<string, DayEntry[]> = {};

  // Planning items : seulement en vue semaine
  if (calView === 'semaine') {
    planningItems.forEach(item => {
      if (item.date_seance) {
        const [y, mo] = item.date_seance.split('-').map(Number);
        if (y === year && mo === month) {
          if (!m[item.date_seance]) m[item.date_seance] = [];
          m[item.date_seance].push({ kind: 'planning', item });
        }
      } else if (item.jour_seance) {
        getOccurrencesInMonth(item.jour_seance, year, month).forEach(d => {
          if (!m[d]) m[d] = [];
          m[d].push({ kind: 'planning', item });
        });
      }
    });
  }

  // Absences à signaler
  manquees.forEach(item => {
    if (!m[item.date]) m[item.date] = [];
    m[item.date].push({ kind: 'manquee', item });
  });

  // Absences signalées
  signalees.forEach(item => {
    const d = item.date_absence.slice(0, 10);
    if (!m[d]) m[d] = [];
    m[d].push({ kind: 'signalee', item });
  });

  return m;
}, [planningItems, manquees, signalees, year, month, calView]);

  const goBack = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const goNext = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const handleSignaler = async (seanceId: string, date: string) => {
    await signaler({ seance_id: seanceId, date_absence: date });
    setModal(null);
  };
  const handleRevoquer = async (absenceId: string) => {
    await revoquer(absenceId);
    setModal(null);
  };

  // Build calendar grid
  const days = getDaysInMonth(year, month);
  const firstIdx = dayIdx(days[0]);
  const cells: (Date | null)[] = [...Array(firstIdx).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const totalManquees  = manquees.length;
  const totalSignalees = signalees.length;
  const totalPlanning  = planningItems.length;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center justify-between">
        <h2 className="font-bold text-gray-900 text-base">Signalement des absences</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <ProfSelector value={profId} onChange={id => { setProfId(id); setClasseId(''); }} />
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg border px-1">
            <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded transition"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
            <span className="text-sm font-semibold text-gray-700 px-2 min-w-[140px] text-center">{MOIS_LABELS[month - 1]} {year}</span>
            <button onClick={goNext} className="p-1.5 hover:bg-gray-100 rounded transition"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
          </div>


          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setCalView('mois')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition ${
                calView === 'mois'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              📅 Absences
            </button>
            {/* <button
              onClick={() => setCalView('semaine')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition ${
                calView === 'semaine'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              📋 Planning
            </button> */}
          </div>


          {profId && <button onClick={() => refetch()} disabled={isFetching} className="p-2 hover:bg-gray-100 rounded-lg transition"><RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /></button>}
          <button onClick={() => setClassPanelOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium border border-indigo-200 transition">
            <BookOpen className="w-4 h-4" /> Classes
          </button>
          <button onClick={() => setFacturesPanelOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium border border-emerald-200 transition">
            <Receipt className="w-4 h-4" /> Factures
          </button>

        </div>
      </div>

      {/* ── Filtres classe + légende ──────────────────── */}
      {profId && <ClasseTabs profId={profId} selectedClasseId={classeId} onSelect={setClasseId} />}

      {profId && calView === 'mois' && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-400" />
            <span className="font-semibold">{totalPlanning}</span> séance{totalPlanning > 1 ? 's' : ''} prévues
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            <span className="font-semibold">{totalManquees}</span> à signaler
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="font-semibold">{totalSignalees}</span> signalée{totalSignalees > 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5" /> Cliquer sur un jour pour agir
          </div>
        </div>
      )}

      {profId && calView === 'semaine' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <WeekViewReadOnly items={planningItems} onSelect={(item) => setModal({ date: item.date_seance ?? todayStr, entries: [{ kind: 'planning', item }] })} />
        </div>
      )}

      {/* ── Calendrier ────────────────────────────────── */}
      {!profId ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <AlertCircle className="w-10 h-10 opacity-30" />
          <p className="text-sm">Sélectionnez un professeur</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : calView === 'semaine' ? (
        // ── VUE SEMAINE — réutilise WeekViewWithAdd de Planning.tsx
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <WeekViewWithAdd
            items={planningItems}
            onSelect={(item) => setModal({ date: item.date_seance ?? todayStr, entries: [{ kind: 'planning', item }] })}
            classes={[]}
            isCreating={false}
            isUpdating={false}
            professeurId={profId}
            onConfirm={async () => {}}
            onUpdate={async () => {}}
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* En-tête jours */}
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {DAYS_SHORT.map(d => (
              <div key={d} className="py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>

          {/* Cellules */}
          <div className="grid grid-cols-7">
            {cells.map((date, idx) => {
              if (!date) return <div key={`e${idx}`} className="h-24 border-b border-r border-gray-50 bg-gray-50/30" />;

              const key = isoDate(date);
              const entries = byDate[key] ?? [];
              const nbPlan      = entries.filter(e => e.kind === 'planning').length;
              const nbManquees  = entries.filter(e => e.kind === 'manquee').length;
              const nbSignalees = entries.filter(e => e.kind === 'signalee').length;
              const isToday   = key === todayStr;
              const isGrayed  = key > todayStr || key < ABSENCE_DATE_MIN;
              const hasAction = nbManquees > 0 || nbSignalees > 0;

              return (
                <div
                  key={key}
                  onClick={() => !isGrayed && entries.length > 0 && setModal({ date: key, entries })}
                  className={[
                    'h-24 border-b border-r border-gray-100 p-1.5 flex flex-col',
                    !isGrayed && entries.length > 0 ? 'cursor-pointer hover:bg-slate-50 transition-colors' : '',
                    isToday ? 'bg-blue-50/40' : '',
                    isGrayed ? 'opacity-35 bg-gray-50/60' : '',
                  ].join(' ')}
                >
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 shrink-0 ${isToday ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>
                    {date.getDate()}
                  </span>

                  <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                    {/* Séances planning — bleues */}
                    {nbPlan > 0 && (
                      <div className="flex items-center gap-1 bg-blue-100 rounded px-1 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-sm bg-blue-500 shrink-0" />
                        <span className="text-[9px] text-blue-800 font-semibold truncate">
                          {nbPlan} séance{nbPlan > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    {/* Absences à signaler — orange */}
                    {nbManquees > 0 && (
                      <div className="flex items-center gap-1 bg-orange-100 rounded px-1 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                        <span className="text-[9px] text-orange-800 font-semibold truncate">
                          {nbManquees} à signaler
                        </span>
                      </div>
                    )}
                    {/* Absences signalées — rouge */}
                    {nbSignalees > 0 && (
                      <div className="flex items-center gap-1 bg-red-100 rounded px-1 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="text-[9px] text-red-800 font-semibold truncate">
                          {nbSignalees} signalée{nbSignalees > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modals & Panneaux ─────────────────────────── */}
      {modal && (
        <ActionModal
          date={modal.date}
          entries={modal.entries}
          onSignaler={handleSignaler}
          onRevoquer={handleRevoquer}
          onClose={() => setModal(null)}
          loading={actionLoading}
        />
      )}

      {classPanelOpen    && <ClassesAdminPanel onClose={() => setClassPanelOpen(false)} />}
      {facturesPanelOpen && <FacturesPanel profId={profId} onClose={() => setFacturesPanelOpen(false)} />}

      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
    </div>
  );
}
