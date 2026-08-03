import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, Search, Clock, BookOpen, ChevronDown, Loader2 } from 'lucide-react';
// ✅ Import des vrais types — adapter le chemin si besoin
import type { PlanningItem, Class } from '../../types';


const COLOR_PALETTE = [
  { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800' },
  { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-800' },
  { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-800' },
  { bg: 'bg-pink-50', border: 'border-pink-400', text: 'text-pink-800' },
  { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-800' },
  { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-800' },
  { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800' },
  { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-800' },
];

const getColorFromId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
};

// ─────────────────────────────────────────────
// TYPES LOCAUX UNIQUEMENT
// ─────────────────────────────────────────────
interface DraftSeance {
  jourIdx:   number;   // 0=Lun … 6=Dim
  jourLabel: string;   // 'lundi' | 'mardi' …
  heureDebut: string;  // "08:00"
  dureeMins:  number;
}

export interface CreateSeancePayload {
  classe?:                string;   // optionnel → disponibilité si absent
  professeur_disponible?: string;   // rempli si pas de classe
  jour_seance:            string;
  heure_debut_reelle:     string;
  duree_reelle_minutes:   number;
  statut:                 'active';
}

export interface UpdateSeancePayload {
  id:                    string;
  duree_reelle_minutes?: number;
  heure_debut_reelle?:   string;
  statut?:               string;
}

export interface WeekViewWithAddProps {
  items:          PlanningItem[];
  onSelect:       (item: PlanningItem) => void;
  classes:        Class[];
  onConfirm:      (payload: CreateSeancePayload) => Promise<void>;
  onUpdate?:      (payload: UpdateSeancePayload) => Promise<void>;
  isCreating?:    boolean;
  isUpdating?:    boolean;
  /** ID du professeur connecté — requis pour déclarer une disponibilité sans classe */
  professeurId?:  string;
}

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────
const JOURS_FULL  = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const JOURS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

/** Slots 07:00 → 20:30 par pas de 30 min */
const SLOTS: string[] = [];
/* for (let h = 7; h <= 20; h++) {
  SLOTS.push(`${String(h).padStart(2,'0')}:00`);
  if (h < 21) SLOTS.push(`${String(h).padStart(2,'0')}:30`);
} */

const START_HOUR = 7;
const END_HOUR = 23;


for (let h = START_HOUR; h <= END_HOUR; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

// Ajouter minuit
SLOTS.push('00:00');

const SLOT_H  = 36;   // hauteur px d'un slot 30 min
const NUM_COLS = 7;
const RESIZE_HANDLE_PX = 10; // zone de détection resize en bas de chaque séance

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const JOUR_IDX: Record<string,number> = {
  lundi:0, mardi:1, mercredi:2, jeudi:3, vendredi:4, samedi:5, dimanche:6,
};

const resolveJourIdx = (item: PlanningItem): number => {
  if (item.date_seance) {
    const [y,m,d] = item.date_seance.split('-').map(Number);
    if (!y || !m || !d) return -1;
    const wd = new Date(y, m-1, d).getDay();
    return wd === 0 ? 6 : wd - 1;
  }
  if (item.jour_seance) return JOUR_IDX[item.jour_seance.toLowerCase().trim()] ?? -1;
  return -1;
};

const toHHMM = (t: string | null | undefined): string =>
  t?.match(/\d{2}:\d{2}/)?.[0] ?? '';

const profName = (classe: PlanningItem['classe']): string =>
  classe.professeur?.display_name ?? '';

const classProfName = (c: Class): string => {
  const p = c.professeur;
  if (!p) return '';
  if (typeof p === 'string') return p;
  return (p as any).display_name ?? (p as any).username ?? '';
};

type StatutKey = 'planned'|'in_progress'|'completed'|'absent'|'late';

const COLORS: Record<StatutKey,string> = {
  planned:     'bg-blue-50 border-blue-300 text-blue-800',
  in_progress: 'bg-green-50 border-green-300 text-green-800',
  completed:   'bg-gray-50 border-gray-300 text-gray-700',
  absent:      'bg-red-50 border-red-300 text-red-800',
  late:        'bg-orange-50 border-orange-300 text-orange-800',
};

// ─────────────────────────────────────────────
// PlanningCard — avec bouton X de suppression
// ─────────────────────────────────────────────
const DISPO_COLOR = { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-800' };

function PlanningCard({
  item, onClick, onDelete, onMove, compact = false, isDeleting = false,
}: {
  item:        PlanningItem;
  onClick:     () => void;
  onDelete?:   (id: string) => void;
  onMove?:     (e: React.MouseEvent) => void;
  compact?:    boolean;
  isDeleting?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  // Séance sans classe = disponibilité → vert émeraude fixe
  const isDispo      = !item.classe;
  const statutClasse = item.classe?.statut;
  const isClasseSupprimee = statutClasse === 'a_supprimer';
  const isClassePause = statutClasse === 'en_pause';
  const isClasseactive = statutClasse === 'active';
  const dynamicColor = isDispo
  ? DISPO_COLOR
  : isClasseSupprimee
    ? {
        bg: 'bg-red-50',
        border: 'border-red-500',
        text: 'text-red-800',
      }
    : isClassePause
      ? {
          bg: 'bg-orange-50',
          border: 'border-orange-400',
          text: 'text-orange-800',
        }
      : isClasseactive
      ? {
          bg: 'bg-blue-50',
          border: 'border-blue-400',
          text: 'text-blue-800',
        }: getColorFromId(item.classe!.id);


  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onClick(); }}
        className={`w-full h-full text-left rounded-lg border-l-4 transition hover:shadow-sm flex flex-col justify-start overflow-hidden
          ${dynamicColor.bg} ${dynamicColor.border} ${dynamicColor.text}
          ${isDeleting ? 'opacity-40' : ''}`}
        style={{ padding: '2px 4px 2px 5px' }}
      >
        {/* Titre — toujours visible même en 30min (1 slot = 36px) */}
        <div style={{ fontSize: 9, fontWeight: 700, lineHeight: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 14 }}>
          {isDispo ? '🟢 Dispo' : item.classe!.nom}
        </div>

        {/* Contenu secondaire — masqué si trop petit */}
        {!compact && (
          isDispo ? (
            <div style={{ fontSize: 8, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
              Créneau libre
            </div>
          ) : (
            <div style={{ fontSize: 8, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
              {profName(item.classe!)}
            </div>
          )
        )}

        {/* Badge statut direction — seulement si hauteur suffisante (compact masqué) */}
        {isDispo && !compact && (
          <>
            {item.statut === 'horaire_valide' && (
              <span style={{ fontSize: 8, fontWeight: 700, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 99, padding: '1px 4px', marginTop: 2, display: 'inline-block', width: 'fit-content' }}>✅ Validé</span>
            )}
            {item.statut === 'horaire_non_valide' && (
              <span style={{ fontSize: 8, fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 99, padding: '1px 4px', marginTop: 2, display: 'inline-block', width: 'fit-content' }}>✗ Rejeté</span>
            )}
          </>
        )}
        {/* Badge statut compact (dans la vue semaine = compact) */}
        {isDispo && compact && item.statut === 'horaire_valide' && (
          <div style={{ fontSize: 7, fontWeight: 700, color: '#059669', marginTop: 1 }}>✅ Validé</div>
        )}
        {isDispo && compact && item.statut === 'horaire_non_valide' && (
          <div style={{ fontSize: 7, fontWeight: 700, color: '#dc2626', marginTop: 1 }}>✗ Rejeté</div>
        )}
      </button>

      {/* ✕ Bouton suppression — visible au survol */}
      {hovered && onDelete && !isDeleting && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(item.id); }}
          title="Supprimer la séance"
          style={{
            position: 'absolute', top: 2, right: 2, width: 16, height: 16,
            borderRadius: '50%', background: 'rgba(239,68,68,0.9)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 30, boxShadow: '0 1px 4px rgba(0,0,0,0.25)', transition: 'transform .1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          <X size={9} color="#fff" strokeWidth={3} />
        </button>
      )}

      {/* ↕ Bouton déplacement — visible au survol */}
      {hovered && onMove && !isDeleting && (
        <button
          onMouseDown={e => onMove(e)}
          title="Déplacer la séance (haut/bas)"
          style={{
            position: 'absolute', top: 2, right: 35, width: 16, height: 16,
            borderRadius: '50%', background: 'rgba(99,102,241,0.85)', border: 'none',
            cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 30, boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}
        >
          <span style={{ fontSize: 9, color: '#fff', lineHeight: 1, userSelect: 'none' }}>↕</span>
        </button>
      )}

      {/* Indicateur de chargement suppression */}
      {isDeleting && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, background: 'rgba(255,255,255,0.5)',
        }}>
          <Loader2 size={12} className="animate-spin text-red-500" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// GhostBlock — bloc bleu translucide pendant le drag
// ─────────────────────────────────────────────
function GhostBlock({ startIdx, endIdx, colIdx }: {
  startIdx: number; endIdx: number; colIdx: number;
}) {
  const slots  = Math.max(1, endIdx - startIdx + 1);
  const top    = startIdx * SLOT_H;
  const height = slots * SLOT_H;
  const leftPct  = (colIdx / NUM_COLS) * 100;
  const widthPct = (1    / NUM_COLS) * 100;

  return (
    <div style={{
      position:'absolute', top, pointerEvents:'none', zIndex:20,
      left:`${leftPct}%`, width:`${widthPct}%`, height, padding:'0 3px',
    }}>
      <div style={{
        height:'100%', borderRadius:8, padding:'4px 6px',
        background:'rgba(59,130,246,0.15)', border:'2px solid #3b82f6',
        backdropFilter:'blur(2px)',
      }}>
        <span style={{ fontSize:10, fontWeight:700, color:'#1d4ed8' }}>
          {slots * 30} min
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ResizeGhost — indicateur visuel lors du resize d'une séance
// ─────────────────────────────────────────────
function ResizeGhost({ topPx, heightPx, leftPct, widthPct, durationMins }: {
  topPx: number; heightPx: number; leftPct: number; widthPct: number; durationMins: number;
}) {
  return (
    <div style={{
      position: 'absolute',
      top: topPx,
      left: `${leftPct}%`,
      width: `${widthPct}%`,
      height: heightPx,
      padding: '0 4px',
      pointerEvents: 'none',
      zIndex: 25,
      boxSizing: 'border-box',
    }}>
      <div style={{
        height: '100%',
        borderRadius: 8,
        background: 'rgba(99,102,241,0.15)',
        border: '2px dashed #6366f1',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: 4,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5' }}>
          ⏱ {durationMins} min
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MoveGhost — indicateur visuel lors du déplacement d'une séance
// ─────────────────────────────────────────────
function MoveGhost({ topPx, heightPx, leftPct, widthPct, heureLabel }: {
  topPx: number; heightPx: number; leftPct: number; widthPct: number; heureLabel: string;
}) {
  return (
    <div style={{
      position: 'absolute',
      top: topPx,
      left: `${leftPct}%`,
      width: `${widthPct}%`,
      height: heightPx,
      padding: '0 4px',
      pointerEvents: 'none',
      zIndex: 25,
      boxSizing: 'border-box',
    }}>
      <div style={{
        height: '100%',
        borderRadius: 8,
        background: 'rgba(16,185,129,0.15)',
        border: '2px dashed #10b981',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>
          📍 {heureLabel}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MiniModal — affiché après le drag/click
// ─────────────────────────────────────────────
function MiniModal({
  draft, ax, ay, classes, isCreating, onConfirm, onCancel, professeurId,
}: {
  draft:         DraftSeance;
  ax:            number;
  ay:            number;
  classes:       Class[];
  isCreating:    boolean;
  onConfirm:     (p: CreateSeancePayload) => Promise<void>;
  onCancel:      () => void;
  professeurId?: string;
}) {
  const [classeId,    setClasseId]    = useState('');
  const [search,      setSearch]      = useState('');
  const [open,        setOpen]        = useState(false);
  const [heureDebut,  setHeureDebut]  = useState(draft.heureDebut);
  const [duree,       setDuree]       = useState(draft.dureeMins);
  const [err,         setErr]         = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Mode : avec classe ou disponibilité libre
  const isDispo = !classeId;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const W = 300, H = 420;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = ax + 14;
  let top  = ay - 20;
  if (left + W > vw - 12) left = ax - W - 14;
  if (top  + H > vh - 12) top  = vh - H - 12;
  if (top < 8) top = 8;

  const filtered = classes.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    classProfName(c).toLowerCase().includes(search.toLowerCase())
  );
  const selected = classes.find(c => c.id === classeId);

  const submit = async () => {
    setErr('');
    if (isDispo) {
      // Disponibilité sans classe : professeur_disponible requis
      if (!professeurId) {
        setErr('ID professeur manquant (professeurId non passé)');
        return;
      }
      await onConfirm({
        professeur_disponible: professeurId,
        jour_seance:           draft.jourLabel,
        heure_debut_reelle:    heureDebut,
        duree_reelle_minutes:  duree,
        statut:                'active',
      });
    } else {
      await onConfirm({
        classe:               classeId,
        jour_seance:          draft.jourLabel,
        heure_debut_reelle:   heureDebut,
        duree_reelle_minutes: duree,
        statut:               'active',
      });
    }
  };

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:49 }} onClick={onCancel} />

      <div ref={ref} onClick={e => e.stopPropagation()} style={{
        position:'fixed', left, top, width:W, zIndex:50,
        background:'#fff', borderRadius:16, overflow:'hidden',
        boxShadow:'0 8px 32px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.08)',
        border:'1px solid #e5e7eb',
        animation:'_mpop 0.18s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        {/* ── Header — bleu si classe sélectionnée, vert si dispo ── */}
        <div style={{
          background: isDispo
            ? 'linear-gradient(135deg,#10b981,#059669)'
            : 'linear-gradient(135deg,#3b82f6,#6366f1)',
          padding:'11px 14px', display:'flex', justifyContent:'space-between', alignItems:'center',
          transition:'background .2s',
        }}>
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:13 }}>
              {isDispo ? '🟢 Disponibilité' : '✨ Nouvelle séance'}
            </div>
            <div style={{ color:'rgba(255,255,255,.75)', fontSize:11, marginTop:2 }}>
              {JOURS_SHORT[draft.jourIdx]} · {heureDebut} · {duree} min
            </div>
          </div>
          <button onClick={onCancel} style={{
            background:'rgba(255,255,255,.2)', border:'none', borderRadius:8,
            padding:'4px 6px', cursor:'pointer', color:'#fff', display:'flex',
          }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding:'13px 14px', display:'flex', flexDirection:'column', gap:9 }}>

          {/* ── Sélecteur de classe (optionnel) ── */}
          <div style={{ position:'relative' }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4, display:'flex', alignItems:'center', gap:4 }}>
              <BookOpen size={11} /> Classe <span style={{ color:'#9ca3af', fontWeight:400 }}>(optionnel)</span>
            </label>

            <div onClick={() => setOpen(o => !o)} style={{
              border:`1.5px solid ${open ? '#3b82f6' : '#e5e7eb'}`,
              borderRadius:10, padding:'7px 10px', cursor:'pointer', background:'#fafafa',
              display:'flex', justifyContent:'space-between', alignItems:'center',
              fontSize:12, color: selected ? '#111827' : '#9ca3af',
              transition:'border-color .15s',
            }}>
              <span>{selected ? selected.nom : 'Sélectionner une classe…'}</span>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                {selected && (
                  <button
                    onClick={e => { e.stopPropagation(); setClasseId(''); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:0, display:'flex' }}
                    title="Retirer la classe"
                  >
                    <X size={11} />
                  </button>
                )}
                <ChevronDown size={13} style={{ color:'#9ca3af', transform: open ? 'rotate(180deg)':'none', transition:'transform .15s' }} />
              </div>
            </div>

            {open && (
              <div style={{
                position:'absolute', top:'100%', left:0, right:0, zIndex:60,
                background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:10,
                boxShadow:'0 4px 16px rgba(0,0,0,.12)', marginTop:4, overflow:'hidden',
              }}>
                <div style={{ padding:'7px 10px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:6 }}>
                  <Search size={12} style={{ color:'#9ca3af', flexShrink:0 }} />
                  <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher…" onClick={e => e.stopPropagation()}
                    style={{ border:'none', outline:'none', fontSize:12, flex:1, background:'transparent', color:'#111827' }} />
                </div>
                <div style={{ maxHeight:150, overflowY:'auto' }}>
                  {filtered.length === 0 && (
                    <div style={{ padding:10, fontSize:11, color:'#9ca3af', textAlign:'center' }}>Aucune classe</div>
                  )}
                  {filtered.map(c => (
                    <div key={c.id} onClick={() => { setClasseId(c.id); setOpen(false); setSearch(''); }}
                      onMouseEnter={e => { if (c.id !== classeId) (e.currentTarget as HTMLElement).style.background='#f9fafb'; }}
                      onMouseLeave={e => { if (c.id !== classeId) (e.currentTarget as HTMLElement).style.background='transparent'; }}
                      style={{
                        padding:'8px 12px', cursor:'pointer',
                        background: c.id === classeId ? '#eff6ff' : 'transparent',
                        borderLeft: c.id === classeId ? '3px solid #3b82f6' : '3px solid transparent',
                      }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{c.nom}</div>
                      {classProfName(c) && (
                        <div style={{ fontSize:10, color:'#6b7280' }}>{classProfName(c)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Bandeau disponibilité (quand aucune classe sélectionnée) ── */}
          {isDispo && (
            <div style={{
              background:'#ecfdf5', border:'1.5px solid #6ee7b7',
              borderRadius:10, padding:'8px 11px',
              display:'flex', alignItems:'flex-start', gap:8,
            }}>
              <span style={{ fontSize:14, flexShrink:0 }}>🟢</span>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#065f46' }}>
                  Créneau de disponibilité
                </div>
                <div style={{ fontSize:10, color:'#047857', marginTop:2, lineHeight:1.4 }}>
                  Aucune classe sélectionnée. Ce créneau sera enregistré comme disponibilité libre.
                  La direction pourra vous assigner une classe sur ce créneau.
                </div>
              </div>
            </div>
          )}

          {/* ── Heure + Durée ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4, display:'flex', alignItems:'center', gap:4 }}>
                <Clock size={11} /> Début
              </label>
              <select value={heureDebut} onChange={e => setHeureDebut(e.target.value)} style={sel}>
                {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4, display:'block' }}>⏱ Durée</label>
              <select value={duree} onChange={e => setDuree(Number(e.target.value))} style={sel}>
                {[30,60,90,120,150,180].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {err && (
            <div style={{ fontSize:11, color:'#ef4444', background:'#fef2f2', borderRadius:8, padding:'5px 10px' }}>
              ⚠️ {err}
            </div>
          )}

          <div style={{ display:'flex', gap:8, marginTop:2 }}>
            <button onClick={onCancel} style={btnCancel}>Annuler</button>
            <button
              onClick={submit}
              disabled={isCreating}
              style={{
                ...btnOk,
                background: isCreating
                  ? '#e5e7eb'
                  : isDispo
                    ? 'linear-gradient(135deg,#10b981,#059669)'
                    : 'linear-gradient(135deg,#3b82f6,#6366f1)',
                color:     isCreating ? '#9ca3af' : '#fff',
                cursor:    isCreating ? 'not-allowed' : 'pointer',
                boxShadow: isCreating ? 'none' : isDispo ? '0 2px 8px rgba(16,185,129,.3)' : '0 2px 8px rgba(99,102,241,.3)',
                transition: 'background .2s, box-shadow .2s',
              }}
            >
              {isCreating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {isCreating ? 'Création…' : isDispo ? 'Déclarer disponibilité' : 'Créer la séance'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes _mpop {
          from { opacity:0; transform:scale(.88) translateY(6px); }
          to   { opacity:1; transform:scale(1)   translateY(0);   }
        }
      `}</style>
    </>
  );
}

// Styles inline réutilisables
const sel: React.CSSProperties = {
  width:'100%', border:'1.5px solid #e5e7eb', borderRadius:10,
  padding:'6px 8px', fontSize:12, background:'#fafafa', color:'#111827',
  outline:'none', cursor:'pointer',
};
const btnCancel: React.CSSProperties = {
  flex:1, padding:'8px', borderRadius:10, border:'1.5px solid #e5e7eb',
  background:'#f9fafb', fontSize:12, fontWeight:600, color:'#6b7280', cursor:'pointer',
};
const btnOk: React.CSSProperties = {
  flex:2, padding:'8px', borderRadius:10, border:'none',
  fontSize:12, fontWeight:700, display:'flex', alignItems:'center',
  justifyContent:'center', gap:6, transition:'all .15s',
};

// ─────────────────────────────────────────────
// WeekViewWithAdd — export principal
// ─────────────────────────────────────────────
export function WeekViewWithAdd({
  items, onSelect, classes, onConfirm, onUpdate, isCreating = false, isUpdating = false, professeurId,
}: WeekViewWithAddProps) {
  // ── State drag création (nouvelle séance) ──────────────────
  const [drag, setDrag] = useState<{ colIdx: number; startIdx: number; curIdx: number } | null>(null);
  const [modal, setModal] = useState<{ draft: DraftSeance; ax: number; ay: number } | null>(null);
  const [hover, setHover] = useState<{ col: number; slot: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // ── State resize bas séance ─────────────────────────────
  const [resizing, setResizing] = useState<{
    itemId: string;
    startSlotIdx: number;   // slot de début (fixe)
    curEndSlotIdx: number;  // slot de fin courant (bouge)
    colIdx: number;
    topPx: number;
    leftPct: number;
    widthPct: number;
  } | null>(null);

  // ── State resize haut séance ─────────────────────────────
  const [resizingTop, setResizingTop] = useState<{
    itemId: string;
    origStartSlotIdx: number; // slot de début original
    endSlotIdx: number;        // slot de fin fixe
    curStartSlotIdx: number;   // slot de début courant (bouge)
    colIdx: number;
    leftPct: number;
    widthPct: number;
  } | null>(null);

  // ── State drag déplacement vertical ─────────────────────
  const [moving, setMoving] = useState<{
    itemId: string;
    origStartSlotIdx: number; // slot départ au mousedown
    durSlots: number;          // durée en slots (fixe)
    mouseOffsetSlots: number;  // décalage souris/haut de la séance
    colIdx: number;
    curStartSlotIdx: number;   // position courante
    leftPct: number;
    widthPct: number;
  } | null>(null);

  // ── State suppression en cours ────────────────────────────
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // ── Helpers coordonnées ─────────────────────────────────────
  const cellAt = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!gridRef.current) return null;
    const r = gridRef.current.getBoundingClientRect();
    const rx = e.clientX - r.left, ry = e.clientY - r.top;
    if (rx < 0 || ry < 0 || rx > r.width || ry > r.height) return null;
    const col = Math.floor((rx / r.width) * NUM_COLS);
    const slot = Math.floor(ry / SLOT_H);
    if (col < 0 || col >= NUM_COLS || slot < 0 || slot >= SLOTS.length) return null;
    return { col, slot };
  }, []);

  // ── Mousedown sur la grille vide → début drag création ──────
  const onGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Si le mousedown vient d'une séance (stopPropagation), on ne fait rien
    const c = cellAt(e);
    if (!c) return;
    e.preventDefault();
    setModal(null);
    setDrag({ colIdx: c.col, startIdx: c.slot, curIdx: c.slot });
  }, [cellAt]);

  // ── Mousedown sur le handle resize d'une séance ─────────────
  const onResizeMouseDown = useCallback((
    e: React.MouseEvent,
    item: PlanningItem,
    startSlotIdx: number,
    colIdx: number,
    topPx: number,
    leftPct: number,
    widthPct: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return;
    const durSlots = Math.max(1, Math.ceil((item.duree_reelle_minutes || 30) / 30));
    const curEndSlotIdx = startSlotIdx + durSlots - 1;
    setResizing({ itemId: item.id, startSlotIdx, curEndSlotIdx, colIdx, topPx, leftPct, widthPct });
  }, []);

  // ── Mousedown handle HAUT → resize top ───────────────────
  const onResizeTopMouseDown = useCallback((
    e: React.MouseEvent,
    item: PlanningItem,
    startSlotIdx: number,
    colIdx: number,
    leftPct: number,
    widthPct: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return;
    const durSlots = Math.max(1, Math.ceil((item.duree_reelle_minutes || 30) / 30));
    const endSlotIdx = startSlotIdx + durSlots - 1;
    setResizingTop({ itemId: item.id, origStartSlotIdx: startSlotIdx, endSlotIdx, curStartSlotIdx: startSlotIdx, colIdx, leftPct, widthPct });
  }, []);

  // ── Mousedown zone centrale → déplacement vertical ───────
  const onMoveMouseDown = useCallback((
    e: React.MouseEvent,
    item: PlanningItem,
    startSlotIdx: number,
    colIdx: number,
    leftPct: number,
    widthPct: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return;
    const durSlots = Math.max(1, Math.ceil((item.duree_reelle_minutes || 30) / 30));
    if (!gridRef.current) return;
    const r = gridRef.current.getBoundingClientRect();
    const mouseSlot = Math.floor((e.clientY - r.top) / SLOT_H);
    const offset = mouseSlot - startSlotIdx;
    setMoving({ itemId: item.id, origStartSlotIdx: startSlotIdx, durSlots, mouseOffsetSlots: offset, colIdx, curStartSlotIdx: startSlotIdx, leftPct, widthPct });
  }, []);

  // ── Mousemove / mouseup sur document ───────────────────────
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!gridRef.current) return;
      const r = gridRef.current.getBoundingClientRect();
      const rawSlot = Math.floor((e.clientY - r.top) / SLOT_H);
      const clampedSlot = Math.max(0, Math.min(SLOTS.length - 1, rawSlot));

      // drag création
      if (drag) {
        const slot = Math.max(drag.startIdx, clampedSlot);
        setDrag(d => d ? { ...d, curIdx: slot } : null);
      }
      // resize bas séance
      if (resizing) {
        const slot = Math.max(resizing.startSlotIdx, clampedSlot);
        setResizing(rs => rs ? { ...rs, curEndSlotIdx: slot } : null);
      }
      // resize haut séance
      if (resizingTop) {
        const slot = Math.min(resizingTop.endSlotIdx, clampedSlot);
        setResizingTop(rt => rt ? { ...rt, curStartSlotIdx: Math.max(0, slot) } : null);
      }
      // déplacement vertical
      if (moving) {
        const newStart = Math.max(0, Math.min(SLOTS.length - 1 - moving.durSlots + 1, clampedSlot - moving.mouseOffsetSlots));
        setMoving(mv => mv ? { ...mv, curStartSlotIdx: newStart } : null);
      }
    };

    const up = async (e: MouseEvent) => {
      // Fin drag création
      if (drag) {
        const { colIdx, startIdx, curIdx } = drag;
        setDrag(null);
        setModal({
          draft: {
            jourIdx: colIdx,
            jourLabel: JOURS_FULL[colIdx],
            heureDebut: SLOTS[startIdx],
            dureeMins: Math.max(30, (curIdx - startIdx + 1) * 30),
          },
          ax: e.clientX, ay: e.clientY,
        });
      }

      // Fin resize bas séance
      if (resizing && onUpdate) {
        const { itemId, startSlotIdx, curEndSlotIdx } = resizing;
        setResizing(null);
        const newDurationMins = Math.max(30, (curEndSlotIdx - startSlotIdx + 1) * 30);
        try {
          await onUpdate({ id: itemId, duree_reelle_minutes: newDurationMins });
        } catch (err) { console.error('Erreur resize bas:', err); }
      } else if (resizing) {
        setResizing(null);
      }

      // Fin resize haut séance
      if (resizingTop && onUpdate) {
        const { itemId, endSlotIdx, curStartSlotIdx } = resizingTop;
        setResizingTop(null);
        const newDurationMins = Math.max(30, (endSlotIdx - curStartSlotIdx + 1) * 30);
        const newHeure = SLOTS[curStartSlotIdx];
        try {
          await onUpdate({ id: itemId, heure_debut_reelle: newHeure, duree_reelle_minutes: newDurationMins });
        } catch (err) { console.error('Erreur resize haut:', err); }
      } else if (resizingTop) {
        setResizingTop(null);
      }

      // Fin déplacement vertical
      if (moving && onUpdate) {
        const { itemId, origStartSlotIdx, curStartSlotIdx, durSlots } = moving;
        setMoving(null);
        if (curStartSlotIdx !== origStartSlotIdx) {
          const newHeure = SLOTS[curStartSlotIdx];
          const durationMins = durSlots * 30;
          try {
            await onUpdate({ id: itemId, heure_debut_reelle: newHeure, duree_reelle_minutes: durationMins });
          } catch (err) { console.error('Erreur déplacement:', err); }
        }
      } else if (moving) {
        setMoving(null);
      }
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
  }, [drag, resizing, resizingTop, moving, onUpdate]);

  // ── Suppression d'une séance (statut → 'supprimer') ─────────
  const handleDelete = useCallback(async (id: string) => {
    if (!onUpdate) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await onUpdate({ id, statut: 'supprimer' });
    } catch (err) {
      console.error('Erreur suppression séance:', err);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [onUpdate]);

  const confirm = async (p: CreateSeancePayload) => {
    await onConfirm(p);
    setModal(null);
  };

  // ── Cursor dynamique ────────────────────────────────────────
  const cursor = resizing ? 's-resize' : resizingTop ? 'n-resize' : moving ? 'grabbing' : drag ? 'ns-resize' : 'crosshair';

  // ───────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative' }}>
      {/* ── Header jours ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: `48px repeat(${NUM_COLS},1fr)`,
        borderBottom: '1px solid #e5e7eb', background: '#f9fafb',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ padding: '10px 8px', fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>h</div>
        {JOURS_SHORT.map(j => (
          <div key={j} style={{
            padding: '10px 4px', fontSize: 11, fontWeight: 700, color: '#374151',
            textAlign: 'center', borderLeft: '1px solid #e5e7eb',
          }}>{j}</div>
        ))}
      </div>

      {/* ── Corps scrollable ── */}
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
        <div style={{ display: 'flex' }}>

          {/* Colonne heures */}
          <div style={{ width: 48, flexShrink: 0 }}>
            {SLOTS.map(slot => (
              <div key={slot} style={{
        height: SLOT_H,
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 8,
        background: '#f9fafb',
      }}>
                {/* {slot.endsWith(':00') && (
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#9ca3af' }}>{slot}</span>
                )} */}
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

          {/* Zone interactive */}
          <div
            ref={gridRef}
            style={{ flex: 1, position: 'relative', cursor, userSelect: 'none' }}
            onMouseDown={onGridMouseDown}
            onMouseMove={e => setHover(cellAt(e))}
            onMouseLeave={() => setHover(null)}
          >
            {/* 1️⃣ Grille de fond (lignes & hover) */}
            {SLOTS.map((slot, si) => (
              <div key={slot} style={{
                display: 'grid', gridTemplateColumns: `repeat(${NUM_COLS},1fr)`,
                height: SLOT_H,
                borderBottom: '1px solid #e5e7eb',
              }}>
                {JOURS_SHORT.map((_, ci) => {
                  const hov = hover?.col === ci && hover?.slot === si && !drag && !resizing;
                  return (
                    <div key={ci} style={{
                      borderLeft: '1px solid #e5e7eb',
                      background: hov ? 'rgba(59,130,246,0.04)' : 'transparent',
                      transition: 'background .1s',
                    }} />
                  );
                })}
              </div>
            ))}

            {/* 2️⃣ Overlay des séances */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
              {items.map(item => {
                // Séances supprimées : ne pas afficher
                if (item.statut === 'supprimer') return null;

                const ji = resolveJourIdx(item);
                const rt = toHHMM(item.heure_debut_reelle);
                if (ji === -1 || !rt) return null;

                const si = SLOTS.indexOf(rt);
                if (si === -1) return null;

                // Calcul position/taille selon l'opération en cours
                const isBeingResizedBot = resizing?.itemId === item.id;
                const isBeingResizedTop = resizingTop?.itemId === item.id;
                const isBeingMoved      = moving?.itemId === item.id;

                let displayStartSlot = si;
                let durSlots = Math.max(1, Math.ceil((item.duree_reelle_minutes || 30) / 30));

                if (isBeingResizedBot) {
                  durSlots = Math.max(1, resizing!.curEndSlotIdx - resizing!.startSlotIdx + 1);
                } else if (isBeingResizedTop) {
                  displayStartSlot = resizingTop!.curStartSlotIdx;
                  durSlots = Math.max(1, resizingTop!.endSlotIdx - resizingTop!.curStartSlotIdx + 1);
                } else if (isBeingMoved) {
                  displayStartSlot = moving!.curStartSlotIdx;
                }

                const topPx    = displayStartSlot * SLOT_H;
                const heightPx = durSlots * SLOT_H;
                const leftPct  = (ji / NUM_COLS) * 100;
                const widthPct = 100 / NUM_COLS;

                const isActive = isBeingResizedBot || isBeingResizedTop || isBeingMoved;

                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      top: `${topPx}px`,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPx}px`,
                      padding: '0 4px',
                      pointerEvents: 'auto',
                      zIndex: isActive ? 20 : 10,
                      boxSizing: 'border-box',
                      overflow: 'visible',
                      cursor: 'default',
                    }}
                  >
                    <div className="h-full w-full" style={{ position: 'relative' }}>
                      <PlanningCard
                        item={item}
                        onClick={() => onSelect(item)}
                        onDelete={onUpdate ? handleDelete : undefined}
                        onMove={onUpdate && !deletingIds.has(item.id) ? (e) => {
                          // déplacement inline via MoveButton logique
                          e.stopPropagation(); e.preventDefault();
                          if (!gridRef.current) return;
                          const durSl = Math.max(1, Math.ceil((item.duree_reelle_minutes || 30) / 30));
                          const r = gridRef.current.getBoundingClientRect();
                          const offset = Math.floor((e.clientY - r.top) / SLOT_H) - si;
                          setMoving({ itemId: item.id, origStartSlotIdx: si, durSlots: durSl, mouseOffsetSlots: offset, colIdx: ji, curStartSlotIdx: si, leftPct, widthPct });
                        } : undefined}
                        compact
                        isDeleting={deletingIds.has(item.id)}
                      />
                      {/* ── Handle resize BAS ── */}
                      {onUpdate && !deletingIds.has(item.id) && (
                        <div
                          onMouseDown={e => onResizeMouseDown(e, item, si, ji, topPx, leftPct, widthPct)}
                          title="Glisser pour modifier la durée"
                          style={{
                            position: 'absolute', bottom: 0, left: '10%', width: '80%',
                            height: RESIZE_HANDLE_PX, cursor: 's-resize', zIndex: 15,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <div style={{ width: 24, height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.2)' }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3️⃣ Ghost drag création */}
            {drag && (
              <GhostBlock
                startIdx={drag.startIdx}
                endIdx={drag.curIdx}
                colIdx={drag.colIdx}
              />
            )}

            {/* 4️⃣ Ghost resize bas séance */}
            {resizing && (
              <ResizeGhost
                topPx={resizing.topPx}
                heightPx={Math.max(1, resizing.curEndSlotIdx - resizing.startSlotIdx + 1) * SLOT_H}
                leftPct={resizing.leftPct}
                widthPct={resizing.widthPct}
                durationMins={Math.max(30, (resizing.curEndSlotIdx - resizing.startSlotIdx + 1) * 30)}
              />
            )}

            {/* 5️⃣ Ghost déplacement vertical */}
            {moving && (
              <MoveGhost
                topPx={moving.curStartSlotIdx * SLOT_H}
                heightPx={moving.durSlots * SLOT_H}
                leftPct={moving.leftPct}
                widthPct={moving.widthPct}
                heureLabel={SLOTS[moving.curStartSlotIdx]}
              />
            )}
          </div>
        </div>
      </div>

      {/* Tip mis à jour */}
      <div style={{
        position: 'absolute', bottom: 8, right: 10, fontSize: 10, color: '#9ca3af',
        background: 'rgba(249,250,251,.9)', padding: '3px 8px', borderRadius: 99,
        border: '1px solid #e5e7eb', backdropFilter: 'blur(4px)', pointerEvents: 'none',
      }}>
        🖱 Glisser pour créer · Bas d'une séance pour redimensionner · Survol: ↕ déplacer  ✕ supprimer
      </div>

      {/* Modal création */}
      {modal && (
        <MiniModal
          draft={modal.draft} ax={modal.ax} ay={modal.ay}
          classes={classes} isCreating={isCreating}
          professeurId={professeurId}
          onConfirm={confirm} onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}