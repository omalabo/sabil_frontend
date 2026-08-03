import { useState, useMemo, useRef, useCallback } from 'react';
import {
  useGetAbsencesQuery,
  useGetUsersQuery,
} from '../../store/apiSlice';
import { AbsenceSignaler, AbsenceFilters, AbsenceMensuelle } from '../../types/';
import { User } from '../../types';
import {
  ChevronLeft, ChevronRight, RefreshCw, X, FileText,
  Image as ImageIcon, Users, AlertCircle, Calendar, List,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';


import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Filler, Tooltip, Legend,
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);
// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAYS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

function formatMois(y: number, m: number) {
  return `${String(y)}-${String(m).padStart(2,'0')}`;
}
function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
// Monday=0 … Sunday=6
function dayIdx(date: Date) {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}
function isoDate(d: Date) {
  return d.toISOString().slice(0,10);
}

// ─────────────────────────────────────────────────────────────
// PROF FILTER
// ─────────────────────────────────────────────────────────────
function ProfFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data } = useGetUsersQuery({ role: 'professeur', page_size: 200 } as any);
  const profs: User[] = data?.results ?? [];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white pr-7 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 appearance-none cursor-pointer"
        style={{ minWidth: 160 }}
      >
        <option value="">👥 Tous les profs</option>
        {profs.map((p: User) => (
          <option key={p.id} value={p.id}>{p.display_name || p.email}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABSENCE DETAIL MODAL
// ─────────────────────────────────────────────────────────────
function AbsenceModal({ absences, date, onClose }: {
  absences: AbsenceSignaler[];
  date: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: '_abspop .2s cubic-bezier(.34,1.56,.64,1) both' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-500 to-rose-600 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">Absences du {date}</p>
            <p className="text-white/70 text-xs">{absences.length} absence{absences.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Absence list */}
        <div className="divide-y max-h-96 overflow-y-auto">
          {absences.map(abs => (
            <div key={abs.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm shrink-0">
                  {(abs.professeur_display_name?.[0] ?? '?').toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{abs.professeur_display_name ?? '—'}</p>
                  <p className="text-xs text-gray-500">
                    {abs.seance_jour ?? ''}
                    {abs.seance_heure ? ` · ${abs.seance_heure}` : ''}
                    {abs.seance_duree ? ` · ${abs.seance_duree}min` : ''}
                    {abs.seance_classe_nom ? ` · ${abs.seance_classe_nom}` : ''}
                  </p>
                </div>
              </div>
              {abs.remarque && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <p className="text-xs text-amber-800 leading-relaxed">💬 {abs.remarque}</p>
                </div>
              )}
              <p className="text-[10px] text-gray-400">
                Signalé par <strong>{abs.admin_display_name}</strong>
              </p>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t">
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium">
            Fermer
          </button>
        </div>
      </div>
      <style>{`@keyframes _abspop{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MONTHLY CALENDAR VIEW
// ─────────────────────────────────────────────────────────────
function AbsenceCalendar({
  year, month, absences, onDayClick
}: {
  year: number;
  month: number;
  absences: AbsenceSignaler[];
  onDayClick: (date: string, items: AbsenceSignaler[]) => void;
}) {
  const days = getDaysInMonth(year, month);
  const totalAbsences = absences.length;

  // Map date string → absences
  const byDate = useMemo(() => {
    const m: Record<string, AbsenceSignaler[]> = {};
    absences.forEach(a => {
      const d = a.date_absence.slice(0,10);
      if (!m[d]) m[d] = [];
      m[d].push(a);
    });
    return m;
  }, [absences]);

  // Build calendar grid (Mon–Sun, 6 rows max)
  const firstDayIdx = dayIdx(days[0]);
  const cells: (Date | null)[] = [
    ...Array(firstDayIdx).fill(null),
    ...days,
  ];
  // pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null);

  const today = isoDate(new Date());

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Month header */}
      <div className="px-5 py-3 bg-gradient-to-r from-red-50 to-rose-50 border-b flex items-center justify-between">
        <p className="font-bold text-gray-800">
          {MOIS_LABELS[month - 1]} {year}
        </p>
        <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">
          {totalAbsences} absence{totalAbsences > 1 ? 's' : ''}
        </span>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {DAYS_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={`e${idx}`} className="h-16 border-b border-r border-gray-50 bg-gray-50/50" />;
          }
          const key = isoDate(date);
          const items = byDate[key] ?? [];
          const hasAbs = items.length > 0;
          const isToday = key === today;

          return (
            <div
              key={key}
              onClick={() => hasAbs && onDayClick(key, items)}
              className={`
                h-16 border-b border-r border-gray-100 p-1 flex flex-col items-start
                ${hasAbs ? 'cursor-pointer hover:bg-red-50 transition-colors' : ''}
                ${isToday ? 'bg-blue-50/40' : ''}
              `}
            >
              <span className={`
                text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                ${isToday ? 'bg-blue-600 text-white' : 'text-gray-600'}
              `}>
                {date.getDate()}
              </span>

              {hasAbs && (
                <div className="flex flex-col gap-0.5 w-full">
                  {items.slice(0, 2).map((a, i) => (
                    <div
                      key={a.id}
                      className="text-[9px] bg-red-100 text-red-700 rounded px-1 py-0.5 truncate font-medium leading-tight"
                    >
                      {a.professeur_display_name?.split(' ')[0] ?? '—'}
                    </div>
                  ))}
                  {items.length > 2 && (
                    <div className="text-[9px] text-red-500 font-semibold px-1">
                      +{items.length - 2}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TABLE VIEW
// ─────────────────────────────────────────────────────────────
function AbsenceTable({ absences }: { absences: AbsenceSignaler[] }) {
  // Aggregate by professeur + mois
  const rows = useMemo<AbsenceMensuelle[]>(() => {
    const map: Record<string, AbsenceMensuelle> = {};
    absences.forEach(a => {
      const profId = a.professeur_id ?? 'unknown';
      const mois = a.mois ?? 'unknown';
      const key = `${profId}__${mois}`;
      if (!map[key]) {
        map[key] = {
          professeur_id: profId,
          professeur_display_name: a.professeur_display_name ?? '—',
          mois,
          dates: [],
          count: 0,
          remarques: [],
        };
      }
      map[key].dates.push(a.date_absence.slice(0,10));
      map[key].count += 1;
      if (a.remarque) map[key].remarques.push(a.remarque);
    });
    return Object.values(map).sort((a, b) => b.mois.localeCompare(a.mois));
  }, [absences]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <AlertCircle className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Aucune absence enregistrée</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Professeur</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Mois</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Dates d'absence</th>
            <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Total</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Remarques</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, idx) => {
            const [y, m] = row.mois.split('-');
            const moisLabel = `${MOIS_LABELS[parseInt(m) - 1]} ${y}`;
            return (
              <tr key={`${row.professeur_id}-${row.mois}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {row.professeur_display_name[0]?.toUpperCase() ?? '?'}
                    </span>
                    <span className="font-medium text-gray-900">{row.professeur_display_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{moisLabel}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.dates.map(d => (
                      <span key={d} className="text-[10px] bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5 font-medium">
                        {d.slice(8,10)}/{d.slice(5,7)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm
                    ${row.count >= 4 ? 'bg-red-600 text-white' : row.count >= 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                    {row.count}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                  {row.remarques.length > 0
                    ? row.remarques.join(' · ')
                    : <span className="opacity-40">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ABSENCES DU JOUR
// ─────────────────────────────────────────────────────────────
function AbsencesDuJour({ absences }: { absences: AbsenceSignaler[] }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const today = isoDate(new Date());

  const absencesJour = useMemo(() =>
    absences.filter(a => a.date_absence.slice(0, 10) === today),
    [absences, today]
  );

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Absences du jour — ${today}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
        h2 { font-size: 18px; margin-bottom: 4px; }
        p.subtitle { font-size: 12px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #fef2f2; color: #991b1b; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #fecaca; }
        td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        tr:nth-child(even) td { background: #fafafa; }
        .badge { display: inline-block; background: #fee2e2; color: #dc2626; border-radius: 4px; padding: 1px 6px; font-size: 11px; font-weight: 600; }
        .remarque { color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 3px 8px; font-size: 11px; display: inline-block; }
        .none { color: #9ca3af; font-style: italic; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <h2>📋 Absences du jour</h2>
      <p class="subtitle">Date : ${today} — ${absencesJour.length} absence${absencesJour.length > 1 ? 's' : ''}</p>
      ${content}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  return (
    <>
      {/* Bouton déclencheur */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200 transition whitespace-nowrap"
        title="Voir les absences d'aujourd'hui"
      >
        <Calendar className="w-3.5 h-3.5" />
        Absences du jour
        {absencesJour.length > 0 && (
          <span className="ml-0.5 bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {absencesJour.length}
          </span>
        )}
      </button>

      {/* Modal / Drawer */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            style={{ animation: '_abspop .2s cubic-bezier(.34,1.56,.64,1) both', maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-base">📋 Absences du jour</p>
                <p className="text-white/75 text-xs">
                  {today} — {absencesJour.length} absence{absencesJour.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition"
                >
                  <FileText className="w-3.5 h-3.5" /> Imprimer
                </button>
                <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white ml-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
              {absencesJour.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <AlertCircle className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Aucune absence aujourd'hui</p>
                  <p className="text-xs mt-1 opacity-60">{today}</p>
                </div>
              ) : (
                <div ref={printRef}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b sticky top-0">
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Professeur</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Classe</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Heure</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Remarque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {absencesJour.map((abs, idx) => (
                        <tr key={abs.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {(abs.professeur_display_name?.[0] ?? '?').toUpperCase()}
                              </span>
                              <span className="font-medium text-gray-900 text-sm">
                                {abs.professeur_display_name ?? '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {abs.seance_classe_nom ? (
                              <span className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-200 rounded px-2 py-0.5 text-xs font-semibold">
                                {abs.seance_classe_nom}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs italic">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {abs.seance_heure
                              ? <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{abs.seance_heure}</span>
                              : <span className="text-gray-300 italic">—</span>}
                            {abs.seance_duree ? (
                              <span className="ml-1.5 text-gray-400">{abs.seance_duree} min</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            {abs.remarque ? (
                              <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block leading-relaxed">
                                💬 {abs.remarque}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs italic">Aucune remarque</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// EXPORT HELPERS
// ─────────────────────────────────────────────────────────────
async function exportImage(ref: React.RefObject<HTMLDivElement>, filename: string) {
  if (!ref.current) return;
  const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, logging: false });
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function exportPDF(ref: React.RefObject<HTMLDivElement>, filename: string) {
  if (!ref.current) return;
  try {
    const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, logging: false });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, w, h);
    pdf.save(filename);
  } catch (err) {
    console.error('Erreur export PDF', err);
  }
}



// ─── Composant AbsenceGraph ───

const MONTHS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jui','Jul','Aoû','Sep','Oct','Nov','Déc'];
const PALETTE = [
  { line: '#3266ad', fill: 'rgba(50,102,173,0.1)'  },
  { line: '#c0452a', fill: 'rgba(192,69,42,0.1)'   },
  { line: '#1d9e75', fill: 'rgba(29,158,117,0.1)'  },
  { line: '#a855b5', fill: 'rgba(168,85,181,0.1)'  },
  { line: '#e5920e', fill: 'rgba(229,146,14,0.1)'  },
  { line: '#2da6d5', fill: 'rgba(45,166,213,0.1)'  },
];

type ChartViewType = 'line' | 'bar' | 'area';

function AbsenceGraph({ absences }: { absences: AbsenceSignaler[] }) {
  const [chartView, setChartView] = useState<ChartViewType>('line');
  const [hiddenProfs, setHiddenProfs] = useState<Set<string>>(new Set());

  // Agréger absences par professeur × mois
  const profMap = useMemo(() => {
    const m: Record<string, { name: string; byMonth: number[] }> = {};
    absences.forEach(a => {
      const id = a.professeur_id ?? 'unknown';
      const name = a.professeur_display_name ?? '—';
      if (!m[id]) m[id] = { name, byMonth: Array(12).fill(0) };
      const mIdx = a.date_absence ? new Date(a.date_absence).getMonth() : -1;
      if (mIdx >= 0) m[id].byMonth[mIdx]++;
    });
    return m;
  }, [absences]);

  const profs = Object.entries(profMap);

  const toggleProf = (id: string) => {
    setHiddenProfs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const chartData = useMemo(() => ({
    labels: MONTHS_LABELS,
    datasets: profs.map(([id, p], i) => {
      const c = PALETTE[i % PALETTE.length];
      return {
        label: p.name,
        data: p.byMonth,
        borderColor: c.line,
        backgroundColor: chartView === 'bar' ? c.line + 'cc' : c.fill,
        borderWidth: chartView === 'bar' ? 0 : 2.5,
        pointBackgroundColor: c.line,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: chartView !== 'bar' ? 5 : 0,
        pointHoverRadius: 7,
        fill: chartView === 'area',
        tension: 0.4,
        hidden: hiddenProfs.has(id),
      };
    }),
  }), [profs, chartView, hiddenProfs]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 11 } }, border: { display: false } },
      y: { grid: { color: 'rgba(0,0,0,.05)' }, min: 0, ticks: { stepSize: 1, precision: 0, font: { size: 11 } }, border: { display: false } },
    },
  };

  const totalAll = profs.filter(([id]) => !hiddenProfs.has(id))
    .reduce((s, [,p]) => s + p.byMonth.reduce((a,b) => a+b, 0), 0);
  const maxProfEntry = profs.reduce<[string, typeof profs[0][1]] | null>((best, [id, p]) => {
    const t = p.byMonth.reduce((a,b) => a+b, 0);
    return !best || t > best[1].byMonth.reduce((a,b) => a+b, 0) ? [id, p] : best;
  }, null);
  const monthTotals = MONTHS_LABELS.map((_, mi) =>
    profs.filter(([id]) => !hiddenProfs.has(id)).reduce((s,[,p]) => s + p.byMonth[mi], 0)
  );
  const maxMonthIdx = monthTotals.indexOf(Math.max(...monthTotals));

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-gray-800 text-sm">Évolution des absences</p>
        <div className="flex rounded-lg border overflow-hidden">
          {(['line','area','bar'] as ChartViewType[]).map(v => (
            <button
              key={v}
              onClick={() => setChartView(v)}
              className={`px-3 py-1 text-xs font-medium transition ${chartView === v ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              {v === 'line' ? 'Courbes' : v === 'area' ? 'Aires' : 'Barres'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 divide-x border-b">
        {[
          { val: totalAll, lbl: 'Total absences', color: 'text-red-600' },
          { val: maxProfEntry?.[1].name ?? '—', lbl: 'Prof le plus absent', color: 'text-purple-600' },
          { val: MONTHS_LABELS[maxMonthIdx] ?? '—', lbl: 'Mois le plus chargé', color: 'text-amber-600' },
        ].map(({ val, lbl, color }) => (
          <div key={lbl} className="px-4 py-3 text-center">
            <p className={`text-xl font-bold ${color}`}>{val}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{lbl}</p>
          </div>
        ))}
      </div>

      {/* Légende cliquable */}
      <div className="px-5 pt-4 flex flex-wrap gap-2">
        {profs.map(([id, p], i) => {
          const c = PALETTE[i % PALETTE.length];
          return (
            <button
              key={id}
              onClick={() => toggleProf(id)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
                hiddenProfs.has(id) ? 'opacity-30 border-gray-200' : 'border-gray-200'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.line }} />
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="px-4 pb-5 pt-3" style={{ height: 320 }}>
        {chartView === 'bar'
          ? <Bar data={chartData} options={options} />
          : <Line data={chartData} options={options} />
        }
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// PAGE PRINCIPALE — AbsencesDirection
// ─────────────────────────────────────────────────────────────
export default function AbsencesDirection() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [profId, setProfId] = useState('');
  const [view, setView]   = useState<'calendar' | 'table'>('calendar');
  const [modal, setModal] = useState<{ date: string; items: AbsenceSignaler[] } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const moisStr = formatMois(year, month);

  // Pour la vue table on récupère toute l'année visible (ou filtrée)
  const queryParams: AbsenceFilters = useMemo(() => ({
    ...(view === 'calendar' ? { mois: moisStr } : { annee: String(year) }),
    ...(profId ? { professeur_id: profId } : {}),
    page_size: 500,
  }), [view, moisStr, year, profId]);

  const { data, isLoading, isFetching, refetch } = useGetAbsencesQuery(queryParams);
  const absences: AbsenceSignaler[] = data?.results ?? [];

  const goBack = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const goNext = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const handleExportPDF = useCallback(
    () => exportPDF(printRef, `absences-${view === 'calendar' ? moisStr : year}.pdf`),
    [view, moisStr, year]
  );
  const handleExportImage = useCallback(
    () => exportImage(printRef, `absences-${view === 'calendar' ? moisStr : year}.png`),
    [view, moisStr, year]
  );

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-4">
      {/* HEADER */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
        <h1 className="text-xl font-bold text-gray-900">📅 Absences — Professeurs</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <ProfFilter value={profId} onChange={setProfId} />

          {/* Navigation mois (visible en calendar seulement) */}
          {view === 'calendar' && (
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg border px-1">
              <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded transition" title="Mois précédent">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2 min-w-[130px] text-center">
                {MOIS_LABELS[month - 1]} {year}
              </span>
              <button onClick={goNext} className="p-1.5 hover:bg-gray-100 rounded transition" title="Mois suivant">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}

          {/* Année (visible en table) */}
          {view === 'table' && (
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg border px-1">
              <button onClick={() => setYear(y => y - 1)} className="p-1.5 hover:bg-gray-100 rounded transition">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm font-semibold text-gray-700 px-2">{year}</span>
              <button onClick={() => setYear(y => y + 1)} className="p-1.5 hover:bg-gray-100 rounded transition">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}

          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${view === 'calendar' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendrier
            </button>
            <button
              onClick={() => setView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${view === 'table' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <List className="w-3.5 h-3.5" /> Tableau
            </button>
          </div>

          <button onClick={() => refetch()} disabled={isFetching} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <AbsencesDuJour absences={absences} />
          <button onClick={handleExportImage} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium border border-gray-200 transition">
            <ImageIcon className="w-4 h-4" /> Image
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium border border-gray-200 transition">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* FILTRE PROF BADGE */}
      {profId && (
        <div className="flex items-center gap-2">
          <span className="text-xs bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Filtré par professeur
            <button onClick={() => setProfId('')} className="ml-1 text-red-400 hover:text-red-700">
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {/* STATS BADGE */}
      <div className="flex items-center gap-3">
        <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-3 flex items-center gap-3">
          <div className="text-2xl font-black text-red-600">{absences.length}</div>
          <div>
            <p className="text-xs font-semibold text-red-700">
              {view === 'calendar' ? `Absence${absences.length > 1 ? 's' : ''} ce mois` : `Absence${absences.length > 1 ? 's' : ''} cette année`}
            </p>
            <p className="text-[10px] text-red-400">
              {view === 'calendar' ? `${MOIS_LABELS[month-1]} ${year}` : year}
            </p>
          </div>
        </div>
        {/* Nb profs distincts */}
        {(() => {
          const uniqueProfs = new Set(absences.map(a => a.professeur_id)).size;
          return uniqueProfs > 0 ? (
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-3 flex items-center gap-3">
              <div className="text-2xl font-black text-orange-500">{uniqueProfs}</div>
              <div>
                <p className="text-xs font-semibold text-orange-700">Professeur{uniqueProfs > 1 ? 's' : ''} concerné{uniqueProfs > 1 ? 's' : ''}</p>
                <p className="text-[10px] text-orange-400">distincts</p>
              </div>
            </div>
          ) : null;
        })()}
      </div>

      {/* MAIN CONTENT */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div ref={printRef}>
          {view === 'calendar' && (
            <AbsenceCalendar
              year={year}
              month={month}
              absences={absences}
              onDayClick={(date, items) => setModal({ date, items })}
            />
          )}
          {view === 'table' && (
            <div className="space-y-4">
              <AbsenceGraph absences={absences} /> 
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <AbsenceTable absences={absences} />
            </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <AbsenceModal
          date={modal.date}
          absences={modal.items}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}