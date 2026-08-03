import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  useGetPlanningQuery,
  useGetClassesQuery,
  useUpdateSeanceMutation,
  useUpdateClassMutation,
  useCreateClassMutation,
  useReactivateClassMutation, // ✅ Ajouté pour réactiver
  useGetInscriptionsQuery,
  useCreateInscriptionMutation,
  useDeleteInscriptionMutation,
  useGetAvailableElevesQuery,
  useGetUsersQuery,
  useGetCatalogueCoursQuery,
} from '../../store/apiSlice';
import AbsencesDirection from './Absencesdirection';
import { PlanningItem, PlanningFilters, Class, User, Inscription } from '../../types';
import {
  Calendar, List, RefreshCw, BookOpen, X, Check,
  PlusCircle, ChevronRight, Loader2, AlertTriangle, Users, XCircle,
  FileText
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────
const JOURS_FULL  = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const JOURS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const SLOTS: string[] = [];
const START_HOUR = 7;
const END_HOUR = 23;
for (let h = START_HOUR; h <= END_HOUR; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
// Ajouter minuit
SLOTS.push('00:00');

const SLOT_H         = 36;
const NUM_COLS       = 7;
const RESIZE_HANDLE  = 10;
const JOUR_IDX: Record<string,number> = {
  lundi:0, mardi:1, mercredi:2, jeudi:3, vendredi:4, samedi:5, dimanche:6,
};
// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const resolveJourIdx = (item: PlanningItem): number => {
  if (item.date_seance) {
    const [y,m,d] = item.date_seance.split('-').map(Number);
    if (!y||!m||!d) return -1;
    const wd = new Date(y,m-1,d).getDay();
    return wd === 0 ? 6 : wd - 1;
  }
  if (item.jour_seance) return JOUR_IDX[item.jour_seance.toLowerCase().trim()] ?? -1;
  return -1;
};
const toHHMM = (t?: string|null) => t?.match(/\d{2}:\d{2}/)?.[0] ?? '';
const statut2label: Record<string,string> = {
  planned:'Prévu', in_progress:'En cours', completed:'Terminé',
  absent:'Absent', late:'Retard',
};

// ─────────────────────────────────────────────────────────────
// POPUP HORAIRE
// ─────────────────────────────────────────────────────────────
function ConfirmHoraireModal({ seance, newDuration, onValidate, onReject, onCancel, isLoading }: {
  seance: PlanningItem; newDuration: number;
  onValidate: () => void; onReject: () => void; onCancel: () => void; isLoading: boolean;
}) {
  const prof = (seance as any).professeur_disponible?.display_name ?? seance.classe?.professeur?.display_name ?? 'Professeur';
  const isAlreadyValidated = seance.statut === 'horaire_valide';
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" style={{ animation: '_pop .2s cubic-bezier(.34,1.56,.64,1) both' }} onClick={e => e.stopPropagation()}>
        <div className={`px-6 py-4 bg-gradient-to-r ${isAlreadyValidated ? 'from-amber-500 to-orange-500' : 'from-emerald-500 to-teal-600'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              {isAlreadyValidated ? <AlertTriangle className="w-5 h-5 text-white" /> : <Check className="w-5 h-5 text-white" />}
            </div>
            <div>
              <p className="text-white font-bold text-base">{isAlreadyValidated ? 'Modifier les horaires' : 'Confirmer les horaires'}</p>
              <p className="text-white/75 text-xs">{isAlreadyValidated ? 'Cet horaire était déjà validé — voulez-vous modifier ?' : 'Disponibilité → Créneau validé ou rejeté'}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          {isAlreadyValidated && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3 items-start">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">Cet horaire est déjà <strong>validé</strong>. Vous pouvez le modifier ou le <strong>rejeter</strong>.</p>
            </div>
          )}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <Row label="Professeur" value={prof} />
            <Row label="Jour" value={seance.jour_seance ?? seance.date_seance ?? '—'} />
            <Row label="Heure" value={toHHMM(seance.heure_debut_reelle) || '—'} />
            <Row label="Durée" value={`${newDuration} min`} />
            <Row label="Statut actuel" value={seance.statut ?? '—'} />
          </div>
        </div>
        <div className="px-6 pb-5 space-y-2">
          <div className="flex gap-2">
            <button onClick={onReject} disabled={isLoading} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold transition disabled:opacity-50">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Rejeter
            </button>
            <button onClick={onValidate} disabled={isLoading} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow hover:shadow-lg transition disabled:opacity-50">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Valider
            </button>
          </div>
          <button onClick={onCancel} className="w-full py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 text-xs font-medium transition">Annuler — ne rien changer</button>
        </div>
      </div>
      <style>{`@keyframes _pop{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-800">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PLANNING WEEK VIEW
// ─────────────────────────────────────────────────────────────
function DirectionWeekView({ items, onSelect, onValidateHoraire }: {
  items: PlanningItem[]; onSelect: (item: PlanningItem) => void; onValidateHoraire: (item: PlanningItem, newDuration: number) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState<{ itemId: string; startSlot: number; curEndSlot: number; colIdx: number; topPx: number; leftPct: number; widthPct: number; } | null>(null);

  const onResizeMouseDown = useCallback((e: React.MouseEvent, item: PlanningItem, si: number, ji: number, topPx: number) => {
    e.stopPropagation(); e.preventDefault();
    if (e.button !== 0) return;
    const durSlots = Math.max(1, Math.ceil((item.duree_reelle_minutes||30)/30));
    setResizing({ itemId: item.id, startSlot: si, curEndSlot: si + durSlots - 1, colIdx: ji, topPx, leftPct: (ji / NUM_COLS) * 100, widthPct: 100 / NUM_COLS });
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!resizing || !gridRef.current) return;
      const r = gridRef.current.getBoundingClientRect();
      const slot = Math.max(resizing.startSlot, Math.min(SLOTS.length-1, Math.floor((e.clientY-r.top)/SLOT_H)));
      setResizing(rs => rs ? { ...rs, curEndSlot: slot } : null);
    };
    const up = () => {
      if (!resizing) return;
      const dur = Math.max(30, (resizing.curEndSlot - resizing.startSlot + 1) * 30);
      const item = items.find(i => i.id === resizing.itemId);
      if (item) onValidateHoraire(item, dur);
      setResizing(null);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  }, [resizing, items, onValidateHoraire]);

  return (
    <div style={{ position:'relative' }}>
      <div style={{ display:'grid', gridTemplateColumns: `48px repeat(${NUM_COLS},1fr)`, borderBottom:'1px solid #e5e7eb', background:'#f9fafb', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ padding:'10px 8px', fontSize:10, color:'#9ca3af', textAlign:'center' }}>h</div>
        {JOURS_SHORT.map(j => (
          <div key={j} style={{ padding:'10px 4px', fontSize:11, fontWeight:700, color:'#374151', textAlign:'center', borderLeft:'1px solid #e5e7eb' }}>{j}</div>
        ))}
      </div>
      <div style={{ overflowY:'auto', maxHeight:'calc(100vh - 300px)' }}>
        <div style={{ display:'flex' }}>
          <div style={{ width:48, flexShrink:0 }}>
            {/* {SLOTS.map(slot => (
              <div key={slot} style={{ height: SLOT_H, borderBottom: slot.endsWith(':00') ? '1px solid #e5e7eb' : '1px dashed #f3f4f6', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:8, background:'#f9fafb' }}>
                {slot.endsWith(':00') && <span style={{ fontSize:10, fontFamily:'monospace', color:'#9ca3af' }}>{slot}</span>}
              </div>
            ))} */}

            {SLOTS.map(slot => (
              <div key={slot}  style={{
        height: SLOT_H,
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 8,
        background: '#f9fafb',
      }}>
                <span style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#4b5563',
        }}>
                  {slot}
                </span>
              </div>
            ))}

          </div>
          <div ref={gridRef} style={{ flex:1, position:'relative', userSelect:'none', cursor:'default' }}>
            {SLOTS.map(slot => (
              <div key={slot} style={{ display:'grid', gridTemplateColumns:`repeat(${NUM_COLS},1fr)`, height:SLOT_H, borderBottom: '1px solid #e5e7eb', }}>
                {JOURS_SHORT.map((_,ci) => <div key={ci} style={{ borderLeft:'1px solid #e5e7eb' }} />)}
              </div>
            ))}
            <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, pointerEvents:'none' }}>
              {items.map(item => {
                if (item.statut === 'supprimer') return null;
                const ji = resolveJourIdx(item);
                const rt = toHHMM(item.heure_debut_reelle);
                if (ji === -1 || !rt) return null;
                const si = SLOTS.indexOf(rt);
                if (si === -1) return null;

                const isDispo = !item.classe;
                const isClasseSupprimee = item.classe?.statut === 'a_supprimer';
                const isClassePause = item.classe?.statut === 'en_pause';
                const isClasseActive = item.classe?.statut === 'active';

                const dynamicColor = isClasseSupprimee
                  ? {
                      bg: '#fef2f2',
                      border: '#ef4444',
                      text: '#991b1b',
                    }
                  : isClassePause
                    ? {
                        bg: '#fff7ed',
                        border: '#fb923c',
                        text: '#9a3412',
                      }
                    : isClasseActive
                      ? {
                          bg: '#eff6ff',
                          border: '#60a5fa',
                          text: '#1e40af',
                        }
                      : {
                          bg: '#eff6ff',
                          border: '#3b82f6',
                          text: '#1e40af',
                        };
                const isBeingResized = resizing?.itemId === item.id;
                const durSlots = isBeingResized ? Math.max(1, resizing!.curEndSlot - resizing!.startSlot + 1) : Math.max(1, Math.ceil((item.duree_reelle_minutes||30)/30));
                const topPx = si * SLOT_H;
                const heightPx = durSlots * SLOT_H;
                const leftPct = (ji / NUM_COLS) * 100;
                const widthPct = 100 / NUM_COLS;

                return (
                  <div key={item.id} style={{ position:'absolute', top: topPx, left:`${leftPct}%`, width:`${widthPct}%`, height: heightPx, padding:'0 4px', pointerEvents:'auto', zIndex: isBeingResized ? 20 : 10, boxSizing:'border-box' }}>
                    <button onMouseDown={e => e.stopPropagation()} onClick={() => onSelect(item)} style={{
                      width:'100%', height:'100%', textAlign:'left', padding:'4px 6px', borderRadius:8,
                      borderLeft: isDispo
                                ? '4px solid #10b981'
                                : `4px solid ${dynamicColor.border}`,

                              background: isDispo
                                ? '#ecfdf5'
                                : dynamicColor.bg,

                              color: isDispo
                                ? '#065f46'
                                : dynamicColor.text,
                      fontSize:10, display:'flex', flexDirection:'column', justifyContent:'space-between', cursor:'pointer',
                      boxShadow: isBeingResized ? '0 0 0 2px #6366f1' : 'none', transition:'box-shadow .1s',
                      border: isDispo ? (item.statut === 'horaire_valide' ? '1px solid #6ee7b7' : '1px solid #a7f3d0') : '1px solid #bfdbfe',
                    }}>
                      <div style={{ fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{isDispo ? '🟢 Dispo' : item.classe!.nom}</div>
                      <div style={{ fontSize:9, opacity:.8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>
                        {isDispo ? (item as any).professeur_disponible?.display_name ?? '' : item.classe?.professeur?.display_name ?? ''}
                      </div>
                      {isDispo && item.statut && (
                        <div style={{ fontSize:9, fontWeight:600, marginTop:2, color: '#059669' }}>
                          {item.statut === 'horaire_valide' ? '✓ Validé' : item.statut === 'horaire_non_valide' ? '✗ Rejeté' : item.statut === 'active' ? '⏳ En attente' : item.statut}
                        </div>
                      )}
                    </button>
                    {isDispo && (
                      <div onMouseDown={e => onResizeMouseDown(e, item, si, ji, topPx)} title="Glisser pour ajuster et valider les horaires" style={{ position:'absolute', bottom:0, left:'10%', width:'80%', height:RESIZE_HANDLE, cursor:'s-resize', zIndex:15, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <div style={{ width:24, height:3, borderRadius:2, background:'rgba(16,185,129,.5)' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {resizing && (
              <div style={{ position:'absolute', top: resizing.topPx, left:`${resizing.leftPct}%`, width:`${resizing.widthPct}%`, height: Math.max(1, resizing.curEndSlot - resizing.startSlot + 1) * SLOT_H, padding:'0 4px', pointerEvents:'none', zIndex:25, boxSizing:'border-box' }}>
                <div style={{ height:'100%', borderRadius:8, background:'rgba(99,102,241,.12)', border:'2px dashed #6366f1', display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:4 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:'#4f46e5' }}>⏱ {Math.max(30,(resizing.curEndSlot-resizing.startSlot+1)*30)} min</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ position:'absolute', bottom:8, right:10, fontSize:10, color:'#9ca3af', background:'rgba(249,250,251,.9)', padding:'3px 8px', borderRadius:99, border:'1px solid #e5e7eb', pointerEvents:'none' }}>
        🟢 Glisser le bas d'une dispo verte pour valider ses horaires
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ÉLÈVES — sous-drawer
// ─────────────────────────────────────────────────────────────
function ElevesSubPanel({ classeId, className }: { classeId: string; className: string }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const { data: inscriptions, refetch } = useGetInscriptionsQuery({ classe: classeId });
  const { data: elevesDisponibles = [] } = useGetAvailableElevesQuery({ search: search || undefined, exclude_classe: classeId });
  const [createInscription] = useCreateInscriptionMutation();
  const [deleteInscription] = useDeleteInscriptionMutation();
  const inscrits: Inscription[] = inscriptions?.results ?? [];
  const inscritIds = new Set(inscrits.map((i: Inscription) => typeof i.eleve === 'string' ? i.eleve : (i.eleve as User).id));
  const disponibles: User[] = (Array.isArray(elevesDisponibles) ? elevesDisponibles as User[] : []).filter((e: User) => e.statut !== 'supprimer' && !inscritIds.has(e.id));
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const handleAdd = async () => {
    if (!selected.size) return;
    setAdding(true);
    try { await Promise.all([...selected].map(eleveId => createInscription({ eleve: eleveId, classe: classeId }).unwrap())); setSelected(new Set()); refetch(); }
    catch (err: any) { alert(err?.data?.detail || 'Erreur inscription'); }
    finally { setAdding(false); }
  };
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-700">👥 Élèves — {className}</p>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 border-b text-xs font-semibold text-gray-600">Inscrits ({inscrits.length})</div>
        <div className="max-h-36 overflow-y-auto divide-y divide-gray-50">
          {inscrits.length === 0 ? <p className="px-3 py-4 text-xs text-gray-400 text-center">Aucun élève inscrit</p> : inscrits.map((insc: Inscription) => (
            <div key={insc.id} className="flex items-center justify-between px-3 py-1.5 group">
              <span className="text-xs text-gray-800">{insc.eleve_nom || String(insc.eleve)}</span>
              <button onClick={() => deleteInscription(insc.id).then(() => refetch())} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 border-b">
          <input type="search" placeholder="Rechercher un élève…" value={search} onChange={e => { setSearch(e.target.value); setSelected(new Set()); }} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400" />
        </div>
        <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
          {disponibles.length === 0 ? <p className="px-3 py-4 text-xs text-gray-400 text-center">{search ? 'Aucun résultat' : 'Tous inscrits'}</p> : disponibles.map((e: User) => (
            <label key={e.id} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-indigo-50 ${selected.has(e.id) ? 'bg-indigo-50' : ''}`}>
              <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="rounded border-gray-300 text-indigo-600" />
              <div><p className="text-xs font-medium text-gray-800">{e.display_name || e.email}</p><p className="text-[10px] text-gray-400">{e.email}</p></div>
            </label>
          ))}
        </div>
        <div className="px-3 py-2 border-t bg-gray-50">
          <button onClick={handleAdd} disabled={!selected.size || adding} className="w-full text-xs bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition font-medium">{adding ? 'Inscription…' : `+ Inscrire${selected.size ? ` (${selected.size})` : ''}`}</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DRAWER AJOUT CLASSE
// ─────────────────────────────────────────────────────────────
function AddClassDrawer({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'eleves'>('form');
  const [createdClass, setCreatedClass] = useState<Class | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    programme: '',
    niveau: '',
    professeur_id: '',
  });
  const [err, setErr] = useState('');
  const [createClass] = useCreateClassMutation();
  const set = (f: string, v: string) => setDraft(prev => ({ ...prev, [f]: v }));
  const handleCreate = async () => {
    if (!draft.professeur_id) { setErr('Choisissez un professeur'); return; }
    setSaving(true); setErr('');
    try {
      const result = await createClass({
        programme: draft.programme,
        niveau: draft.niveau,
        professeur: draft.professeur_id,
        statut: 'active',
      }).unwrap();
      setCreatedClass(result as unknown as Class); setStep('eleves');
    } catch (e: any) { setErr(e?.data?.detail || 'Erreur création'); }
    finally { setSaving(false); }
  };
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-[70] flex flex-col" style={{ animation: 'slideInRight .2s cubic-bezier(.34,1.56,.64,1)' }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b bg-gradient-to-r from-indigo-600 to-violet-600 shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-white"><p className="font-bold text-base">{step === 'form' ? '➕ Nouvelle classe' : `👥 Inscrire des élèves`}</p><p className="text-white/70 text-xs mt-0.5">{step === 'form' ? 'Remplissez les informations' : createdClass?.nom}</p></div>
            <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {['Créer la classe', 'Inscrire élèves'].map((label, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition ${(i === 0 && step === 'form') || (i === 1 && step === 'eleves') ? 'bg-white text-indigo-700' : i < (step === 'eleves' ? 1 : 0) ? 'bg-white/50 text-white' : 'bg-white/20 text-white/60'}`}>{i+1}</div>
                <span className="text-white/80 text-[10px]">{label}</span>
                {i === 0 && <ChevronRight className="w-3 h-3 text-white/40" />}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'form' && (
            <div className="space-y-4">
              {/* Nom auto généré */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nom</label>
                <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-400 italic">
                  Auto généré selon le professeur
                </div>
              </div>

              {/* Programme */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Programme
                </label>
                <input
                  type="text"
                  value={draft.programme}
                  onChange={(e) => set('programme', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  placeholder="Programme"
                />
              </div>

              {/* Niveau */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Niveau
                </label>
                <input
                  type="text"
                  value={draft.niveau}
                  onChange={(e) => set('niveau', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  placeholder="Niveau"
                />
              </div>

              {/* Professeur */}
              <ProfesseurSelect value={draft.professeur_id} onChange={v => set('professeur_id', v)} />
              {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">⚠️ {err}</div>}
              <button onClick={handleCreate} disabled={saving || !draft.professeur_id} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? 'Création…' : 'Créer la classe'}</button>
            </div>
          )}
          {step === 'eleves' && createdClass && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><p className="text-xs text-emerald-700 font-medium">Classe créée avec succès !</p></div>
              <ElevesSubPanel classeId={createdClass.id} className={createdClass.nom} />
              <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium transition">Terminer</button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </>
  );
}

function ProgrammeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: catalogueData, isLoading } = useGetCatalogueCoursQuery({});
  const programmes = catalogueData?.results ?? [];
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Programme</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
      >
        <option value="">— Sélectionner un programme —</option>
        {isLoading ? (
          <option disabled>Chargement...</option>
        ) : (
          programmes.map((p: any) => (
            <option key={p.id} value={p.id}>{p.nom}</option>
          ))
        )}
      </select>
    </div>
  );
}

function ProfesseurSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data, isLoading } = useGetUsersQuery({ role: 'professeur', page_size: 200 } as any);
  const profs: User[] = data?.results ?? [];
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Professeur *</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
      >
        <option value="">— Sélectionner un professeur —</option>
        {isLoading ? (
          <option disabled>Chargement...</option>
        ) : (
          profs.map((p: User) => (
            <option key={p.id} value={p.id}>{p.display_name || p.email}</option>
          ))
        )}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DRAWER PRINCIPAL — Gestion classes (3 ONGLETS)
// ─────────────────────────────────────────────────────────────
function ClassesDrawer({ onClose }: { onClose: () => void }) {
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [tab, setTab] = useState<'a_supprimer' | 'supprimer' | 'active'>('a_supprimer');
  const [actionLoading, setActionLoading] = useState<Record<string,boolean>>({});
  const { data: classesData, refetch } = useGetClassesQuery({ include_deleted: true } as any);
  const [updateClass] = useUpdateClassMutation();
  const [reactivateClass] = useReactivateClassMutation(); // ✅ Hook pour POST /classes/{id}/reactivate/

  const classes = classesData?.results ?? [];
  const aSupprimer  = classes.filter((c: Class) => c.statut === 'a_supprimer');
  const supprimees  = classes.filter((c: Class) => c.statut === 'supprimer');
  const actives     = classes.filter((c: Class) => c.statut === 'active');

  const handleConfirmDelete = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cette classe ?')) return;
    setActionLoading(prev => ({ ...prev, [`del_${id}`]: true }));
    try {
      await updateClass({ id, statut: 'supprimer' }).unwrap();
      refetch();
    } catch (e: any) { alert(e?.data?.detail || 'Erreur suppression'); }
    finally { setActionLoading(prev => ({ ...prev, [`del_${id}`]: false })); }
  };

  const handleReactivate = async (id: string) => {
    if (!window.confirm('Réactiver cette classe ?')) return;
    setActionLoading(prev => ({ ...prev, [`react_${id}`]: true }));
    try {
      await reactivateClass(id).unwrap(); // ✅ Appelle ton endpoint dédié
      refetch();
    } catch (e: any) { alert(e?.data?.error || e?.data?.detail || 'Erreur réactivation'); }
    finally { setActionLoading(prev => ({ ...prev, [`react_${id}`]: false })); }
  };

  const tabs = [
    { key: 'a_supprimer', label: '🔴 À supprimer', count: aSupprimer.length },
    { key: 'supprimer',   label: '🗑 Supprimées',  count: supprimees.length },
    { key: 'active',      label: '✅ Actives',      count: actives.length },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col" style={{ animation: 'slideInRight .22s cubic-bezier(.34,1.56,.64,1)' }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b bg-gradient-to-r from-indigo-600 to-violet-600 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white"><BookOpen className="w-5 h-5" /><span className="font-bold text-base">Gestion Classes</span></div>
            <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="px-5 py-3 border-b bg-gray-50 shrink-0">
          <button onClick={() => setAddClassOpen(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow hover:shadow-lg transition"><PlusCircle className="w-4 h-4" /> Ajouter une classe</button>
        </div>

        {/* ✅ 3 ONGLETS */}
        <div className="flex border-b bg-gray-50 shrink-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} className={`flex-1 py-2.5 text-xs font-semibold transition ${tab === t.key ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}>
              {t.label} <span className="ml-1 opacity-60">({t.count})</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* ── ONGLET : À SUPPRIMER ── */}
          {tab === 'a_supprimer' && (
            <>
              {aSupprimer.length === 0 && <div className="text-center py-12 text-gray-400"><BookOpen className="w-10 h-10 mx-auto mb-3 opacity-25" /><p className="text-sm">Aucune classe signalée</p></div>}
              {aSupprimer.map((classe: Class) => (
                <div key={classe.id} className="rounded-xl border border-red-200 bg-red-50/50 p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{classe.nom}</p>
                      {(classe as any).niveau && <p className="text-xs text-gray-500 mt-0.5">Niveau {(classe as any).niveau}</p>}
                      {(classe as any).professeur_nom && <p className="text-xs text-gray-400 truncate">Prof: {(classe as any).professeur_nom}</p>}
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-300">🔴 Signalée</span>
                  </div>
                  <button onClick={() => handleConfirmDelete(classe.id)} disabled={actionLoading[`del_${classe.id}`]} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition disabled:opacity-50">
                    {actionLoading[`del_${classe.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '🗑 Supprimer définitivement'}
                  </button>
                </div>
              ))}
            </>
          )}

          {/* ── ONGLET : SUPPRIMÉES (à réactiver) ── */}
          {tab === 'supprimer' && (
            <>
              {supprimees.length === 0 && <div className="text-center py-12 text-gray-400"><XCircle className="w-10 h-10 mx-auto mb-3 opacity-25" /><p className="text-sm">Aucune classe supprimée</p></div>}
              {supprimees.map((classe: Class) => (
                <div key={classe.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{classe.nom}</p>
                      {(classe as any).niveau && <p className="text-xs text-gray-500 mt-0.5">Niveau {(classe as any).niveau}</p>}
                      {(classe as any).professeur_nom && <p className="text-xs text-gray-400 truncate">Prof: {(classe as any).professeur_nom}</p>}
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-gray-200 text-gray-700 border-gray-300">🗑 Supprimée</span>
                  </div>
                  <button onClick={() => handleReactivate(classe.id)} disabled={actionLoading[`react_${classe.id}`]} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50">
                    {actionLoading[`react_${classe.id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Réactiver la classe
                  </button>
                </div>
              ))}
            </>
          )}

          {/* ── ONGLET : ACTIVES (lecture seule) ── */}
          {tab === 'active' && (
            <>
              {actives.length === 0 && <div className="text-center py-12 text-gray-400"><BookOpen className="w-10 h-10 mx-auto mb-3 opacity-25" /><p className="text-sm">Aucune classe active</p></div>}
              {actives.map((classe: Class) => (
                <div key={classe.id} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{classe.nom}</p>
                      {(classe as any).niveau && <p className="text-xs text-gray-500 mt-0.5">Niveau {(classe as any).niveau}</p>}
                      {(classe as any).professeur_nom && <p className="text-xs text-gray-400 truncate">Prof: {(classe as any).professeur_nom}</p>}
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-300">✅ Active</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="border-t px-4 py-3 bg-gray-50 shrink-0"><p className="text-[10px] text-gray-400 text-center">Gérez le cycle de vie des classes depuis ce panneau</p></div>
      </div>
      {addClassOpen && <AddClassDrawer onClose={() => setAddClassOpen(false)} />}
      <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// DETAIL MODAL séance
// ─────────────────────────────────────────────────────────────
function DetailModal({ item, onClose }: { item: PlanningItem; onClose: () => void }) {
  const isDispo = !item.classe;
  const profName = isDispo ? (item as any).professeur_disponible?.display_name ?? '—' : item.classe?.professeur?.display_name ?? '—';
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <div><h3 className="text-lg font-bold text-gray-900">{isDispo ? '🟢 Disponibilité' : item.classe!.nom}</h3><p className="text-gray-600 text-sm">{profName}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[{ l:'Professeur', v: profName }, { l:'Date', v: item.date_seance }, { l:'Heure', v: `${item.heure_debut_reelle} • ${item.duree_reelle_minutes}min` }, { l:'Statut', v: item.statut || '—' }, { l:'Réalisation', v: statut2label[item.statut_realisation] || item.statut_realisation }].map(({ l, v }) => (
            <div key={l}><span className="text-gray-400 text-xs">{l}</span><p className="font-semibold text-gray-800">{v || '—'}</p></div>
          ))}
        </div>
        <div className="flex justify-end pt-2 border-t"><button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">Fermer</button></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────────────────────
function StatsBar({ data }: { data: PlanningItem[] }) {
  const stats = useMemo(() => ({ total: data.length, completed: data.filter(i => i.statut_realisation === 'completed').length, in_progress: data.filter(i => i.statut_realisation === 'in_progress').length, absent: data.filter(i => i.statut_realisation === 'absent').length, dispos: data.filter(i => !i.classe).length }), [data]);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[{ label:'Sens des couleurs :', value:stats.total, color:'bg-gray-50 text-gray-700' }, { label:'Disponibilités des professeurs', value:stats.completed, color:'bg-green-50 text-green-700' }, { label:'Créneaux des classes', value:stats.in_progress, color:'bg-blue-50 text-blue-700' }, { label:'Classes a suppimer', value:stats.absent, color:'bg-red-50 text-red-700' }, { label:'Classes mis en pause', value:stats.dispos, color:'bg-orange-50 text-orange-700' }].map(({ label, value, color }) => (
        <div key={label} className={`p-3 rounded-lg text-center ${color}`}><div className="text-xs opacity-80">{label}</div></div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FILTRE PAR PROFESSEUR
// ─────────────────────────────────────────────────────────────
function ProfFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data } = useGetUsersQuery({ role: 'professeur', page_size: 200 } as any);
  const profs: User[] = data?.results ?? [];
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white pr-7 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer" style={{ minWidth: 160 }}>
        <option value="">👥 Tous les profs</option>
        {profs.map((p: User) => <option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE PRINCIPALE — PlanningDirection
// ─────────────────────────────────────────────────────────────
export default function PlanningDirection() {
  const [filters, setFilters] = useState<PlanningFilters>({ view: 'week' });
  const [mainTab, setMainTab] = useState<'planning' | 'absences'>('planning');
  const [selectedProfId, setSelectedProfId] = useState('');
  const [selectedItem, setSelectedItem] = useState<PlanningItem | null>(null);
  const [classPanelOpen, setClassPanelOpen] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<{ item: PlanningItem; newDuration: number; } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const queryFilters = useMemo(() => ({ ...filters, ...(selectedProfId ? { professeur_id: selectedProfId } : {}) }), [filters, selectedProfId]);
  const { data, isLoading, isFetching, refetch } = useGetPlanningQuery(queryFilters);
  const [updateSeance, { isLoading: isUpdating }] = useUpdateSeanceMutation();
  const items: PlanningItem[] = data?.results || [];

  const handleValidateHoraire = useCallback((item: PlanningItem, newDuration: number) => setPendingValidation({ item, newDuration }), []);
  const confirmValidate = async () => {
    if (!pendingValidation) return;
    try { await updateSeance({ id: pendingValidation.item.id, duree_reelle_minutes: pendingValidation.newDuration, statut: 'horaire_valide' }).unwrap(); refetch(); }
    catch (e) { console.error(e); }
    finally { setPendingValidation(null); }
  };
  const confirmReject = async () => {
    if (!pendingValidation) return;
    try { await updateSeance({ id: pendingValidation.item.id, duree_reelle_minutes: pendingValidation.newDuration, statut: 'horaire_non_valide' }).unwrap(); refetch(); }
    catch (e) { console.error(e); }
    finally { setPendingValidation(null); }
  };

  // ✅ Export PDF natif
  const handleExportPDF = async () => {
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`planning-direction-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) { console.error('Erreur export PDF', err); alert('Erreur lors de la génération du PDF'); }
  };

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  // AVANT (ligne 686–728) — remplacer tout le return par :
return (
  <div className="space-y-4 max-w-7xl mx-auto p-4">

    {/* ── HEADER avec onglets ─────────────────────────── */}
    <div className="flex flex-wrap gap-3 items-center justify-between bg-white p-4 rounded-xl shadow-sm border">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900">📊 Planning</h1>

        {/* ONGLETS */}
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => setMainTab('planning')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold transition ${
              mainTab === 'planning'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            📅 Planning
          </button>
          <button
            onClick={() => setMainTab('absences')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold transition ${
              mainTab === 'absences'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            ❌ Absences profs
          </button>
        </div>
      </div>

      {/* Actions — visibles seulement sur l'onglet planning */}
      {mainTab === 'planning' && (
        <div className="flex flex-wrap gap-2 items-center">
          <ProfFilter value={selectedProfId} onChange={setSelectedProfId} />
          <button onClick={() => refetch()} disabled={isFetching} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Rafraîchir">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium border border-gray-200 transition">
            <FileText className="w-4 h-4" /> Exporter PDF
          </button>
          <button onClick={() => setClassPanelOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium border border-indigo-200 transition">
            <BookOpen className="w-4 h-4" /> Classes
          </button>
        </div>
      )}
    </div>

    {/* ── ONGLET PLANNING ─────────────────────────────── */}
    {mainTab === 'planning' && (
      <>
        {selectedProfId && (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Filtré par professeur
              <button onClick={() => setSelectedProfId('')} className="ml-1 text-indigo-400 hover:text-indigo-700">
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
        <StatsBar data={items} />
        <div ref={printRef} className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[400px]">
          {filters.view === 'week' && (
            <DirectionWeekView items={items} onSelect={setSelectedItem} onValidateHoraire={handleValidateHoraire} />
          )}
          {filters.view === 'list' && (
            <div className="divide-y">
              {items.length === 0 && (
                <div className="py-16 text-center text-gray-400">
                  <p className="text-sm">Aucune séance sur cette période</p>
                </div>
              )}
              {items.map(item => {
                const isDispo = !item.classe;
                const statutColor = item.statut === 'horaire_valide' ? 'bg-emerald-100 text-emerald-700' : item.statut === 'horaire_non_valide' ? 'bg-emerald-100 text-emerald-700' : isDispo ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700';
                return (
                  <div key={item.id} onClick={() => setSelectedItem(item)} className="p-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{isDispo ? '🟢 Disponibilité' : item.classe!.nom}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.date_seance || item.jour_seance} · {toHHMM(item.heure_debut_reelle)} · {item.duree_reelle_minutes}min {' · '} {isDispo ? ((item as any).professeur_disponible?.display_name ?? '—') : (item.classe?.professeur?.display_name ?? '—')}</div>
                    </div>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${statutColor}`}>
                      {item.statut === 'horaire_valide' ? '✓ Validé' : item.statut === 'horaire_non_valide' ? '✗ Rejeté' : item.statut || (isDispo ? 'Dispo' : 'Prévu')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
        {classPanelOpen && <ClassesDrawer onClose={() => setClassPanelOpen(false)} />}
        {pendingValidation && (
          <ConfirmHoraireModal
            seance={pendingValidation.item}
            newDuration={pendingValidation.newDuration}
            onValidate={confirmValidate}
            onReject={confirmReject}
            onCancel={() => setPendingValidation(null)}
            isLoading={isUpdating}
          />
        )}
      </>
    )}

    {/* ── ONGLET ABSENCES ─────────────────────────────── */}
    {mainTab === 'absences' && <AbsencesDirection />}

  </div>
);
}