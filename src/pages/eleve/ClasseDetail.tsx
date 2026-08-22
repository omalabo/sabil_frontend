// ClasseDetail.tsx — Navigation par classe avec créneaux du jour
import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import {
  useGetClassesQuery,
  useUpdateSeanceMutation,
  useGetUsersQuery,
  usePauseClassMutation,
  useFlagDeleteClassMutation,
  useReactivateClassMutation,
  useUpdateClassMutation,
  useGetInscriptionsQuery,
  useGetFacturesEmisesQuery,
  useCreateFactureMutation,
  usePreviewFactureMutation,
  useSendFactureReminderMutation,
  useUpdateParticipantsPaymentMutation,
  useGetFactureEleveByFactureQuery,
  useConfirmerFactureEleveMutation,
  useConfirmerToutFactureEleveMutation,
  useSubmitFactureMutation,
  useGetAdminAbsenceCalendarQuery,
  useGetFacturesEleveQuery,
  usePayerFactureEleveMutation,
  useCreateSeanceDispoMutation,
  useGetMesAnnoncesQuery,
  useMarkNotificationReadMutation,
  useGetNotificationsQuery
} from '../../store/apiSlice'
import VideoRoom from '../../components/classroom/VideoRoom'
import api from '../../config/axios'
import { Class, Message, User, Facture, FacturePreview, FactureLigne, FactureElevePayeItem, TypeCours } from '../../types'
import type { SeanceManquee, AbsenceSignaler, AnnonceEleve} from '../../types'
import SubmitFactureModal from '../../components/shared/Submitfacturemodal'
import { AnnonceEleveCard } from '../direction/Annonces'  // ajustez le chemin selon votre structure
// ─── Types ───────────────────────────────────────────────────────────────────
interface ClasseDetailProps { role: 'eleve' | 'professeur' | 'admin' | 'direction' }
interface LiveKitSession {
  presenceId: string; seanceId: string; roomName: string
  token: string; serverUrl: string; isModerator: boolean
}
interface Seance {
  id: string; date_seance: string | null; jour_seance: string | null
  heure_debut_reelle: string | null; duree_reelle_minutes: number | null; statut: string | null
}
interface PresenceManuelle {
  id: string; heure_connexion_prof: string | null; temps_prof: number | null; created_at: string
}
interface EleveRow {
  absence_id: string | null; eleve_id: string; eleve_nom: string
  temps_effectif: boolean | null; durree_eleve: number | null; presence_id: string
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const SALLE_STYLES = `@keyframes salle-pulse-ring{0%{transform:scale(1);opacity:.6}70%{transform:scale(1.35);opacity:0}100%{transform:scale(1.35);opacity:0}} @keyframes salle-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}} @keyframes panel-slide-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}} @keyframes content-fade-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} @keyframes seance-glow{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,.25)}50%{box-shadow:0 0 0 8px rgba(99,102,241,0)}} .salle-join-btn{position:relative;display:inline-flex;align-items:center;gap:10px;padding:14px 36px;font-size:15px;font-weight:600;letter-spacing:.3px;color:#fff;background:linear-gradient(135deg,#1a73e8,#1557b0);border:none;border-radius:50px;cursor:pointer;box-shadow:0 4px 20px rgba(26,115,232,.45);transition:transform .15s,box-shadow .15s,opacity .15s} .salle-join-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(26,115,232,.55)} .salle-join-btn:disabled{opacity:.55;cursor:not-allowed} .salle-join-btn .spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite} @keyframes spin{to{transform:rotate(360deg)}} .salle-info-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:50px;font-size:13px;color:rgba(255,255,255,.7)} .salle-avatar-ring{position:absolute;inset:-6px;border-radius:50%;background:rgba(26,115,232,.35);animation:salle-pulse-ring 2.4s ease-out infinite} .panel-slide-in{animation:panel-slide-in .25s ease-out} .content-fade-up{animation:content-fade-up .3s ease-out} .seance-active-glow{animation:seance-glow 2s ease-in-out infinite} @keyframes todayPopupIn{from{opacity:0;transform:translateY(-6px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}} @keyframes tab-blink{0%,100%{opacity:1}50%{opacity:.3}} @keyframes slideInRight {from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; }} @keyframes facture-ping{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.3)}} @media (max-width: 767px) {.mobile-panel-toggle { display: flex !important; align-items: center; justify-content: center; } .main-content { margin-left: 0 !important; }} .time24-item:hover{background:rgba(255,255,255,.12)} 
.chat-icon-btn {
display: flex;
align-items: center;
justify-content: center;
transition: transform .18s cubic-bezier(.34,1.56,.64,1), background .18s ease, color .18s ease;
}
.chat-icon-btn:hover {
transform: scale(1.08);
}
.chat-icon-btn:active {
transform: scale(.92);
}
.chat-icon-btn svg {
transition: transform .18s ease;
}
.chat-attach-btn:hover svg {
transform: rotate(-10deg) scale(1.08);
}
.chat-attach-active svg {
transform: rotate(-10deg) scale(1.05);
}
.chat-mic-recording {
position: relative;
animation: chat-mic-pulse 1.4s ease-in-out infinite;
}
.chat-mic-recording:before {
content: '';
position: absolute;
inset: -5px;
border-radius: 50%;
background: rgba(239,68,68,.18);
animation: chat-mic-ring 1.4s ease-out infinite;
pointer-events: none;
}
@keyframes chat-mic-pulse {
0%, 100% {
transform: scale(1);
}
50% {
transform: scale(1.05);
}
}
@keyframes chat-mic-ring {
0% {
transform: scale(.85);
opacity: .8;
}
70% {
transform: scale(1.35);
opacity: 0;
}
100% {
transform: scale(1.35);
opacity: 0;
}
} `

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DAYS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']
const getTodayDayName = () => DAYS_FR[new Date().getDay()]
function formatDateSeance(seance: { date_seance: string | null; jour_seance: string | null }): string {
  if (seance.date_seance) {
    const d = new Date(seance.date_seance + 'T00:00:00')
    if (!isNaN(d.getTime())) return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  }
  return seance.jour_seance || 'Non planifié'
}
function calcHeureFin(heure: string | null, duree: number | null): string {
  if (!heure || !duree) return '--:--'
  const [h, m] = heure.split(':').map(Number)
  const total = h * 60 + m + duree
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// ─── ElevesModal ─────────────────────────────────────────────────────────────
function ElevesModal({ seance, onClose, onSaved }: { seance: Seance; onClose: () => void; onSaved?: () => void }) {
  const [rows, setRows] = useState<EleveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, Partial<EleveRow>>>({})
  const [bulkDur, setBulkDur] = useState('')
  useEffect(() => {
    setLoading(true)
    api.get('/absences-eleves/', { params: { seance_id: seance.id } })
      .then(res => { if (res.data.has_presence) setRows(res.data.eleves || []) })
      .catch(err => console.error('Erreur élèves:', err))
      .finally(() => setLoading(false))
  }, [seance.id])
  const getDraft = (row: EleveRow): EleveRow => ({ ...row, ...(drafts[row.eleve_id] ?? {}) })
  const setDraft = (eleveId: string, field: keyof EleveRow, value: any) =>
    setDrafts(prev => ({ ...prev, [eleveId]: { ...(prev[eleveId] ?? {}), [field]: value } }))
  const hasDraft = (eleveId: string) => !!drafts[eleveId] && Object.keys(drafts[eleveId]).length > 0
  const handleSave = async (row: EleveRow) => {
    const d = drafts[row.eleve_id]; if (!d) return
    setSaving(prev => ({ ...prev, [row.eleve_id]: true }))
    try {
      const payload = { presence_id: row.presence_id, eleve_id: row.eleve_id, temps_effectif: d.temps_effectif ?? row.temps_effectif, durree_eleve: d.durree_eleve ?? row.durree_eleve }
      const res = await api.post('/absences-eleves/', payload)
      setRows(prev => prev.map(r => r.eleve_id === row.eleve_id ? { ...r, absence_id: res.data.id, temps_effectif: res.data.temps_effectif, durree_eleve: res.data.durree_eleve } : r))
      setDrafts(prev => { const n = { ...prev }; delete n[row.eleve_id]; return n })
    } catch { alert('❌ Impossible de sauvegarder') }
    finally { setSaving(prev => ({ ...prev, [row.eleve_id]: false })) }
  }
  const handleSaveAll = async () => {
    const entries = Object.entries(drafts)
    if (entries.length === 0) return
    try {
      const promises = entries
        .map(([eleveId, draft]) => {
          const row = rows.find(r => r.eleve_id === eleveId)
          if (!row) return null
          return api.post('/absences-eleves/', { presence_id: row.presence_id, eleve_id: eleveId, temps_effectif: draft.temps_effectif ?? row.temps_effectif, durree_eleve: draft.durree_eleve ?? row.durree_eleve })
        })
        .filter((p): p is Promise<any> => p !== null)
      await Promise.all(promises)
      const res = await api.get('/absences-eleves/', { params: { seance_id: seance.id } })
      if (res.data.has_presence) setRows(res.data.eleves || [])
      setDrafts({}); setBulkDur(''); alert('✅ Tous les élèves ont été enregistrés')
      onSaved?.()
    } catch { alert('❌ Erreur lors de l’enregistrement massif') }
  }
  

  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">👥 Élèves — {formatDateSeance(seance)}</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Présence et durée de participation</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">✕</button>
        </div>
        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border-b border-gray-200">
          <button onClick={() => { const d: Record<string, any> = {}; rows.forEach(r => d[r.eleve_id] = { temps_effectif: true, durree_eleve: null }); setDrafts(prev => ({ ...prev, ...d })) }} className="flex-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition">✅ Tous : Cours complet</button>
          <div className="flex items-center gap-2 flex-1">
            <button onClick={() => { const dur = parseInt(bulkDur) || 0; const d: Record<string, any> = {}; rows.forEach(r => d[r.eleve_id] = { temps_effectif: false, durree_eleve: dur > 0 ? dur : null }); setDrafts(prev => ({ ...prev, ...d })) }} className="flex-1 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition">❌ Tous :</button>
            <input type="number" min="1" max="480" value={bulkDur} onChange={e => setBulkDur(e.target.value)} placeholder="min" className="w-16 px-2 py-1.5 text-xs border border-gray-300 rounded focus:border-indigo-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <div className="flex justify-center py-12"><span className="w-6 h-6 border-2 border-neutral-300 border-t-indigo-500 rounded-full animate-spin" /></div>
            : rows.length === 0 ? <p className="text-center text-neutral-500 py-12">Aucun élève inscrit.</p>
              : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_140px_140px_80px] gap-3 px-3 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wide border-b border-neutral-100">
                    <span>Élève</span> <span>Cours complet ?</span> <span>Durée (min)</span> <span></span>
                  </div>
                  {rows.map(row => {
                    const d = getDraft(row); const dirty = hasDraft(row.eleve_id)
                    return (
                      <div key={row.eleve_id} className={`grid grid-cols-[1fr_140px_140px_80px] gap-3 items-center px-3 py-3 rounded-xl border transition-all ${dirty ? 'border-indigo-200 bg-indigo-50' : 'border-neutral-100 hover:border-neutral-200 bg-white'}`}>
                        <div><p className="text-sm font-medium text-neutral-900">{row.eleve_nom}</p>{row.absence_id && <span className="text-xs text-green-600">✓ déjà enregistré</span>}</div>
                        <div className="flex gap-1">
                          <button onClick={() => { setDraft(row.eleve_id, 'temps_effectif', true); setDraft(row.eleve_id, 'durree_eleve', null) }} className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition ${d.temps_effectif === true ? 'bg-green-100 border-green-400 text-green-700' : 'border-neutral-200 text-neutral-500 hover:border-green-300'}`}>✅ Oui</button>
                          <button onClick={() => setDraft(row.eleve_id, 'temps_effectif', false)} className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition ${d.temps_effectif === false ? 'bg-red-100 border-red-400 text-red-700' : 'border-neutral-200 text-neutral-500 hover:border-red-300'}`}>❌ Non</button>
                        </div>
                        <div>{d.temps_effectif === false ? <input type="number" min="1" max="480" placeholder="minutes" value={d.durree_eleve ?? ''} onChange={e => setDraft(row.eleve_id, 'durree_eleve', e.target.value ? parseInt(e.target.value) : null)} className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:border-indigo-400" /> : <span className="text-xs text-neutral-400 italic">{d.temps_effectif === true ? 'Cours complet' : '—'}</span>}</div>
                        <button onClick={() => handleSave(row)} disabled={!dirty || saving[row.eleve_id]} className={`px-2 py-1.5 text-xs rounded-lg font-medium transition ${dirty ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-neutral-100 text-neutral-400 cursor-default'} disabled:opacity-60`}>{saving[row.eleve_id] ? '...' : '💾'}</button>
                      </div>
                    )
                  })}
                </div>
              )}
        </div>
        <div className="px-6 py-4 border-t border-neutral-200 flex justify-between gap-3">
          <button onClick={onClose} className="px-5 py-2 bg-neutral-100 text-neutral-700 rounded-xl hover:bg-neutral-200 font-medium text-sm transition">Fermer</button>
          <button onClick={handleSaveAll} disabled={Object.keys(drafts).length === 0} className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm transition disabled:opacity-50">💾 Enregistrer tout</button>
        </div>
      </div>
    </div>
  )
}
// ─── Sélecteur d'heure 24h garanti (identique au natif) ─────
function Time24Picker({
  value,
  onChange,
  style,
  className
}: {
  value: string
  onChange: (v: string) => void
  style?: React.CSSProperties
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const parts = value ? value.split(':') : ['', '']
  const currentH = parts[0] ? parts[0].padStart(2, '0') : ''
  const currentM = parts[1] ? parts[1].padStart(2, '0') : ''
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

  const updatePos = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const dropdownHeight = 230
    let top = rect.bottom + 4
    if (top + dropdownHeight > window.innerHeight) {
      top = Math.max(8, rect.top - dropdownHeight - 4)
    }
    setPos({ top, left: rect.left })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onScrollOrResize = () => updatePos()
    document.addEventListener('mousedown', onClickOutside)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, updatePos])

  const formatTyped = (raw: string) => {
    let digits = raw.replace(/\D/g, '').slice(0, 4)
    if (!digits) return ''
    if (digits.length === 1 && Number(digits) > 2) {
      digits = `0${digits}`
    }
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}:${digits.slice(2)}`
  }

  const normalizeValue = () => {
    const v = value.trim()
    if (!v) { onChange(''); return }
    let h = 0
    let m = 0
    if (v.includes(':')) {
      const [hh, mm] = v.split(':')
      h = parseInt(hh, 10)
      m = parseInt(mm, 10)
    } else {
      const digits = v.replace(/\D/g, '')
      if (digits.length <= 2) {
        h = parseInt(digits, 10)
        m = 0
      } else {
        h = parseInt(digits.slice(0, 2), 10)
        m = parseInt(digits.slice(2, 4), 10)
      }
    }
    if (isNaN(h)) h = 0
    if (isNaN(m)) m = 0
    h = Math.min(23, Math.max(0, h))
    m = Math.min(59, Math.max(0, m))
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  const chooseHour = (hh: string) => {
    onChange(`${hh}:${currentM || '00'}`)
    inputRef.current?.focus()
  }
  const chooseMinute = (mm: string) => {
    onChange(`${currentH || '00'}:${mm}`)
    inputRef.current?.focus()
  }

  const listStyle: React.CSSProperties = {
    flex: 1,
    maxHeight: 190,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 52
  }
  const itemBase: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 12,
    textAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none'
  }
  const inputStyle: React.CSSProperties = {
    padding: '3px 6px',
    borderRadius: 6,
    fontSize: 10,
    border: '1px solid rgba(255,255,255,.2)',
    background: 'rgba(255,255,255,.1)',
    color: '#fff',
    outline: 'none',
    width: 70,
    textAlign: 'center',
    cursor: 'text',
    colorScheme: 'dark' as any
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder="HH:MM"
        value={value}
        onChange={e => onChange(formatTyped(e.target.value))}
        onBlur={normalizeValue}
        onClick={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter') {
            normalizeValue()
            setOpen(false)
          }
        }}
        className={className}
        style={className ? { cursor: 'text', colorScheme: 'dark' as any, ...style } : { ...inputStyle, ...style }}
      />
      {open && pos && (
        <div
          onMouseDown={e => e.preventDefault()}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 120,
            display: 'flex',
            gap: 8,
            padding: 8,
            background: '#1e1b4b',
            border: '1px solid rgba(139,92,246,.35)',
            borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,.55)'
          }}
        >
          <div style={listStyle}>
            {hours.map(hh => (
              <div
                key={hh}
                className="time24-item"
                onMouseDown={e => e.preventDefault()}
                onClick={() => chooseHour(hh)}
                style={{
                  ...itemBase,
                  background: hh === currentH ? 'rgba(99,102,241,.6)' : undefined,
                  color: hh === currentH ? '#fff' : 'rgba(255,255,255,.7)'
                }}
              >
                {hh}
              </div>
            ))}
          </div>
          <div style={listStyle}>
            {minutes.map(mm => (
              <div
                key={mm}
                className="time24-item"
                onMouseDown={e => e.preventDefault()}
                onClick={() => chooseMinute(mm)}
                style={{
                  ...itemBase,
                  background: mm === currentM ? 'rgba(99,102,241,.6)' : undefined,
                  color: mm === currentM ? '#fff' : 'rgba(255,255,255,.7)'
                }}
              >
                {mm}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// ─── SeanceProfRow ───────────────────────────────────────────────────────────
function SeanceProfRow({ seance, openForm = false, onFactureNeeded, dateOverride, heureInit, tempsInit }: {
  seance: Seance; openForm?: boolean
  onFactureNeeded?: (seanceId: string, date?: string) => void
  dateOverride?: string   // date cliquée depuis le calendrier
  heureInit?: string      // pré-remplissage heure depuis calendrier
  tempsInit?: number      // pré-remplissage durée depuis calendrier
}) {
  const [presence, setPresence] = useState<PresenceManuelle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [heureConnexion, setHeureConnexion] = useState(heureInit ?? '')
  const [tempsProf, setTempsProf] = useState(tempsInit != null ? String(tempsInit) : '')
  const [showEleves, setShowEleves] = useState(false)
  const [hasPresenceToday, setHasPresenceToday] = useState(false)
  const [showProfForm, setShowProfForm] = useState(false)
  const [validatingAll, setValidatingAll] = useState(false)
  useEffect(() => { if (openForm) setShowProfForm(true) }, [openForm])
  useEffect(() => {
    setLoading(true)
    api.get('/presences-manuelle/', { params: { seance_id: seance.id } })
      .then(res => {
        const p: PresenceManuelle | null = res.data
        setPresence(p); setHasPresenceToday(!!p)
        if (p) { setHeureConnexion(p.heure_connexion_prof?.substring(0, 5) ?? ''); setTempsProf(p.temps_prof != null ? String(p.temps_prof) : '') }
      }).catch(() => { }).finally(() => setLoading(false))
  }, [seance.id])
  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { seance_id: seance.id, heure_connexion_prof: heureConnexion ? heureConnexion + ':00' : null, temps_prof: tempsProf !== '' ? parseInt(tempsProf) : null }
      const res = presence?.id ? await api.patch(`/presences-manuelle/${presence.id}/`, payload) : await api.post('/presences-manuelle/', payload)
      setPresence(res.data); setHasPresenceToday(true)
      // Déclencher auto-facture après saisie manuelle (avec date override si depuis calendrier)
      onFactureNeeded?.(seance.id, dateOverride)
    } catch { alert('❌ Impossible de sauvegarder') } finally { setSaving(false) }
  }
  const handleValidateSeanceAndAllPresent = async () => {
    if (!window.confirm('Confirmer : Les horaires seront appliqués à la séance et TOUS les élèves seront marqués "présents (cours complet)" ?')) return
    setValidatingAll(true)
    try {
      await api.patch(`/seances/${seance.id}/`, {
        heure_debut_reelle: heureConnexion ? (heureConnexion.split(':').length === 3 ? heureConnexion : `${heureConnexion}:00`) : seance.heure_debut_reelle,
        duree_reelle_minutes: tempsProf ? parseInt(tempsProf) : seance.duree_reelle_minutes,
      })
      const heureSeance = seance.heure_debut_reelle ? (seance.heure_debut_reelle.split(':').length === 3 ? seance.heure_debut_reelle : seance.heure_debut_reelle + ':00') : null
      const payload = { seance_id: seance.id, heure_connexion_prof: heureSeance, temps_prof: seance.duree_reelle_minutes ?? null }
      const res = presence?.id ? await api.patch(`/presences-manuelle/${presence.id}/`, payload) : await api.post('/presences-manuelle/', payload)
      setPresence(res.data); setHasPresenceToday(true)
      const elevesRes = await api.get('/absences-eleves/', { params: { seance_id: seance.id } })
      if (elevesRes.data.has_presence) {
        await Promise.all(elevesRes.data.eleves.map((row: any) => api.post('/absences-eleves/', { presence_id: row.presence_id, eleve_id: row.eleve_id, temps_effectif: true, durree_eleve: null })))
      }
      alert('✅ Séance validée : horaires mis à jour + tous les élèves marqués présents')
      // Déclencher auto-facture après validation complète
      onFactureNeeded?.(seance.id, dateOverride)
    } catch (err: any) { alert(err?.response?.data?.detail || '❌ Échec de la validation') }
    finally { setValidatingAll(false) }
  }
  return (
    <>
      {showProfForm && (
        <div className="mt-2 p-3 bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm">
          {loading ? <p className="text-xs text-white/50 flex items-center gap-1.5"><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Chargement…</p> : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Heure début</label>
                  <Time24Picker
                    value={heureConnexion}
                    onChange={setHeureConnexion}
                    style={{ width: 112, padding: '4px 8px', fontSize: 12 }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Durée (min)</label>
                  <input type="number" min="1" max="480" placeholder="ex: 60" value={tempsProf} onChange={e => setTempsProf(e.target.value)} className="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-indigo-400 w-20" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleSave} disabled={saving} className="flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-lg bg-white/15 hover:bg-white/25 text-white transition flex items-center justify-center gap-1 disabled:opacity-50">
                  {saving ? <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" /> : '💾'} Sauvegarder
                </button>
                <button onClick={() => setShowEleves(true)} disabled={!hasPresenceToday} className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg transition flex items-center gap-1 ${hasPresenceToday ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-white/5 text-white/25 cursor-not-allowed'}`}>👥 Élèves</button>
              </div>
              <button onClick={handleValidateSeanceAndAllPresent} disabled={validatingAll} className="w-full px-2 py-2 text-[11px] font-semibold rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {validatingAll ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '✅'} Valider séance & Tous présents
              </button>
              {hasPresenceToday && <p className="text-[10px] text-emerald-400 flex items-center gap-1">✓ Présence enregistrée</p>}
              <button onClick={() => setShowProfForm(false)} className="text-[10px] text-white/30 hover:text-white/60 underline cursor-pointer">✕ Masquer</button>
            </div>
          )}
        </div>
      )}
      {showEleves && <ElevesModal seance={seance} onClose={() => setShowEleves(false)} onSaved={() => { onFactureNeeded?.(seance.id, dateOverride) }} />}
    </>
  )
}

// ─── AbsCalendarModal ────────────────────────────────────────────────────────
// Calendrier absences à justifier pour le prof connecté + classe donnée
// Clic sur une absence → callback avec la date pour pré-remplir le formulaire

const DAYS_SHORT_CAL = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
const MOIS_CAL = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const ABSENCE_DATE_MIN = '2026-05-01'

function dayIdxCal(date: Date) { const d = date.getDay(); return d === 0 ? 6 : d - 1 }
function isoDtCal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function getDaysInMonthCal(year: number, month: number): Date[] {
  const days: Date[] = []; const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) { days.push(new Date(d)); d.setDate(d.getDate() + 1) }
  return days
}

function AbsCalendarModal({
  classeId, classeNom, profId,
  year, month,
  onPrevMonth, onNextMonth,
  onSelectAbsence, onClose,
}: {
  classeId: string; classeNom: string; profId: string
  year: number; month: number
  onPrevMonth: () => void; onNextMonth: () => void
  onSelectAbsence: (seanceId: string, date: string) => void
  onClose: () => void
}) {
  const todayStr = isoDtCal(new Date())
  const { data: absData, isLoading } = useGetAdminAbsenceCalendarQuery(
    { professeur_id: profId, year, month },
    { skip: !profId }
  )

  const rawManquees: SeanceManquee[] = absData?.seances_manquees ?? []

  // Filtrer par classe + dates passées + min date
  const manquees = rawManquees.filter(m =>
    m.date <= todayStr &&
    m.date >= ABSENCE_DATE_MIN &&
    m.seance_classe_id === classeId
  )

  // Grouper par date
  const byDate: Record<string, SeanceManquee[]> = {}
  manquees.forEach(m => {
    if (!byDate[m.date]) byDate[m.date] = []
    byDate[m.date].push(m)
  })

  const days = getDaysInMonthCal(year, month)
  const firstIdx = dayIdxCal(days[0])
  const cells: (Date | null)[] = [...Array(firstIdx).fill(null), ...days]
  const [choiceModal, setChoiceModal] = useState<{ date: string; absences: SeanceManquee[] } | null>(null)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 20, padding: 0, width: '100%', maxWidth: 480, boxShadow: '0 24px 60px rgba(0,0,0,.35)', overflow: 'hidden', animation: 'todayPopupIn .2s cubic-bezier(.34,1.56,.64,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.6px', fontWeight: 700 }}>Absences à justifier</p>
            <h3 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: '#fff' }}>{classeNom}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>✕</button>
        </div>

        {/* Nav mois */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <button onClick={onPrevMonth} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 14 }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>{MOIS_CAL[month - 1]} {year}</span>
          <button onClick={onNextMonth} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 14 }}>›</button>
        </div>

        {/* Légende */}
        <div style={{ padding: '8px 20px', display: 'flex', gap: 12, alignItems: 'center', background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#92400e' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', display: 'block' }} />
            Absence à justifier — cliquer pour renseigner
          </div>
        </div>

        {/* Grille */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <span style={{ width: 24, height: 24, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'block' }} />
          </div>
        ) : (
          <div style={{ padding: '0 0 16px' }}>
            {/* Jours de la semaine */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f1f5f9' }}>
              {DAYS_SHORT_CAL.map(d => (
                <div key={d} style={{ padding: '6px 0', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{d}</div>
              ))}
            </div>
            {/* Cellules */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((date, idx) => {
                if (!date) return <div key={`e${idx}`} style={{ height: 52, borderBottom: '1px solid #f8fafc' }} />
                const key = isoDtCal(date)
                const absences = byDate[key] ?? []
                const isToday = key === todayStr
                const isFuture = key > todayStr || key < ABSENCE_DATE_MIN
                const hasAbs = absences.length > 0
                return (
                  <div
                    key={key}
                    style={{
                      height: 52, borderBottom: '1px solid #f8fafc', borderRight: '1px solid #f8fafc',
                      padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      background: hasAbs ? '#fff7ed' : isToday ? '#eff6ff' : '#fff',
                      cursor: hasAbs ? 'pointer' : 'default',
                      transition: 'background .12s',
                    }}
                    onClick={() => {
                      if (!hasAbs) return
                      // Si plusieurs absences → on ouvre le choix
                      if (absences.length > 1) {
                        setChoiceModal({ date: key, absences })
                      } else {
                        // S'il n'y en a qu'une → on continue directement
                        onSelectAbsence(absences[0].seance_id, key)
                      }
                    }}
                    onMouseEnter={e => { if (hasAbs) (e.currentTarget as HTMLDivElement).style.background = '#fed7aa' }}
                    onMouseLeave={e => { if (hasAbs) (e.currentTarget as HTMLDivElement).style.background = '#fff7ed' }}
                  >
                    <span style={{
                      width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                      fontSize: 11, fontWeight: isToday ? 700 : 500,
                      background: isToday ? '#4f46e5' : 'transparent',
                      color: isToday ? '#fff' : isFuture ? '#cbd5e1' : '#1e1b4b',
                    }}>{date.getDate()}</span>
                    {hasAbs && (
                      <div style={{ marginTop: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {absences.slice(0, 2).map((_, i) => (
                          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316' }} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
            {manquees.length > 0
              ? `${manquees.length} absence(s) à justifier ce mois-ci — cliquez sur une date orange`
              : `Aucune absence à justifier sur ${MOIS_CAL[month - 1]} ${year}`}
          </p>
        </div>
      </div>

      {/* 🆕 Popup de sélection quand >1 absence le même jour */}
      {choiceModal && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16, backdropFilter: 'blur(2px)' }}
          onClick={() => setChoiceModal(null)}
        >
          <div 
            style={{ background: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340, boxShadow: '0 20px 50px rgba(0,0,0,.3)', animation: 'todayPopupIn .2s cubic-bezier(.34,1.56,.64,1)' }}
            onClick={e => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1e1b4b' }}>
              📅 {choiceModal.date} — {choiceModal.absences.length} séance(s)
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b' }}>
              Plusieurs créneaux sont marqués absents. Choisissez celui à justifier :
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          
              {choiceModal.absences.map((abs, i) => {
                // 🔍 Récupération sécurisée de l'heure et durée (adaptez si votre API utilise d'autres noms)
                const h = abs.heure || ''
                const d = abs.duree ?? null
                const fin = calcHeureFin(h, d)
                
                return (
                  <button 
                    key={abs.seance_id} 
                    onClick={() => { onSelectAbsence(abs.seance_id, choiceModal.date); setChoiceModal(null) }}
                    style={{ 
                      padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', 
                      cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: '#334155', 
                      transition: 'all .15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eef2ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
                  >
                    {/* ✅ Affiche l'horaire réel si dispo, sinon fallback sur "Séance X" */}
                    <span>⏱ {h ? `${h.substring(0, 5)} → ${fin}` : `Séance ${i + 1}`}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Cliquer pour justifier →</span>
                  </button>
                )
              })}
            </div>
            <button 
              onClick={() => setChoiceModal(null)} 
              style={{ marginTop: 16, width: '100%', padding: '9px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EleveFacturesInline ──────────────────────────────────────────────────────
// Version inline du composant Factures pour l'onglet Infos de l'élève,
// filtré sur une classe donnée

function ProgressPaiementInline({ paye, total }: { paye: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paye / total) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, transition: 'width .4s', width: `${pct}%`, background: pct >= 100 ? '#10b981' : pct > 0 ? '#f59e0b' : '#fca5a5' }} />
      </div>
      <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap' }}>{pct}%</span>
    </div>
  )
}

function PayModalInline({ facture, onClose }: { facture: FactureElevePayeItem; onClose: () => void }) {
  const reste = (facture.montant_a_payer as number || 0) - (facture.montant_payer as number || 0)
  const [montant, setMontant] = useState<string>(String(reste > 0 ? reste : 0))
  const [justificatif, setJustificatif] = useState<File | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [payer, { isLoading }] = usePayerFactureEleveMutation()

  async function handlePay() {
    const val = parseFloat(montant)
    if (isNaN(val) || val <= 0) { setErreur('Montant invalide.'); return }
    if (val > reste) { setErreur(`Dépasse le reste dû (${reste} €).`); return }
    setErreur(null)
    try { 
      const fd = new FormData()
fd.append('montant_payer', String(val))
if (justificatif) fd.append('justificatif', justificatif)
await api.patch(`/factures-eleve/${facture.id}/payer/`, fd, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
onClose()
     }
    catch (e: any) { setErreur(e?.data?.error ?? 'Erreur.') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 360, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', padding: '18px 20px', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.8px' }}>Enregistrer un paiement</p>
              <h3 style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 700 }}>{facture.classe_nom}</h3>
              {facture.date_seance && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Séance du {new Date(facture.date_seance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>}
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { label: 'À payer', val: facture.montant_a_payer, color: '#1e1b4b', bg: '#f8fafc' },
              { label: 'Déjà payé', val: facture.montant_payer, color: '#059669', bg: '#f0fdf4' },
              { label: 'Reste', val: reste, color: '#d97706', bg: '#fffbeb' },
            ].map(({ label, val, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>{label}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color }}>{val != null ? `${Number(val).toLocaleString('fr-FR')} €` : '—'}</p>
              </div>
            ))}
          </div>
          <ProgressPaiementInline paye={facture.montant_payer as number || 0} total={facture.montant_a_payer as number || 0} />
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Montant versé (€)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 600 }}>€</span>
              <input type="number" min="0.01" max={reste} step="0.01" value={montant} onChange={e => setMontant(e.target.value)}
                style={{ width: '100%', paddingLeft: 26, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => {
                  const value = Number((reste * pct / 100).toFixed(6))
                  setMontant(value.toString())
                }}
                  style={{ flex: 1, padding: '4px 0', fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>{pct}%</button>
              ))}
            </div>
          </div>
          {erreur && <p style={{ margin: 0, fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>⚠️ {erreur}</p>}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              📎 Justificatif (photo/virement) — optionnel
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              capture="environment"
              onChange={e => setJustificatif(e.target.files?.[0] ?? null)}
              style={{ fontSize: 12, width: '100%', padding: '6px 0' }}
            />
            {justificatif && (
              <p style={{ fontSize: 11, color: '#059669', marginTop: 4, margin: 0 }}>
                ✅ {justificatif.name}
              </p>
            )}
          </div>
                    
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
            <button onClick={handlePay} disabled={isLoading} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: isLoading ? .6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {isLoading ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'block' }} />Envoi…</> : '💳 Payer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EleveFacturesInline({ classeId }: { classeId: string }) {
  const [onglet, setOnglet] = useState<'a_payer' | 'paye' | 'confirmee'>('a_payer')
  const [page, setPage] = useState(1)
  const [payModal, setPayModal] = useState<FactureElevePayeItem | null>(null)
  const [sort, setSort] = useState<{ key: string; asc: boolean }>({ key: 'date_seance', asc: false })

  // ── Filtre mois : par défaut = mois précédent ──────────────────────────
  const defaultMonth = () => {
    const now = new Date()
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  }
  const [factureFilterMonth, setFactureFilterMonth] = useState<string>(defaultMonth)
  const [factureFilterAll, setFactureFilterAll] = useState(false)

  const { data, isLoading, isFetching, refetch } = useGetFacturesEleveQuery({ page }, { skip: !classeId })
  const allFactures: FactureElevePayeItem[] = data?.results ?? []

  // Filtrer par classe
  const facturesClasse = allFactures.filter((f: any) => f.classe === classeId || f.classe_id === classeId)
  
    const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }
  // Filtre par mois sur date_seance ou date_debut
  const facturesClasseFiltrees = factureFilterAll
    ? facturesClasse
    : facturesClasse.filter((f: any) => {
        const d = f.date_seance || f.date_debut || ''
        return d.startsWith(factureFilterMonth)
      })


   // Après facturesClasseFiltrees existante :
  const facturesClasseFiltered = (role === 'admin' || role === 'direction') && factureSearch.trim()
    ? facturesClasseFiltrees.filter(f => {
        const q = factureSearch.toLowerCase()
        return (
          // filtre sur les données de la facture elle-même
          fmtDate(f.date_debut).toLowerCase().includes(q) ||
          fmtDate(f.date_fin).toLowerCase().includes(q) ||
          String(f.montant_total ?? '').includes(q) ||
          String(f.part_prof ?? '').includes(q) ||
          String(f.part_direction ?? '').includes(q) ||
          String(f.honoraire ?? '').includes(q) ||
          (f.statut === 'payee' ? 'payée' : f.statut === 'envoyee' ? 'en attente' : 'brouillon').includes(q) ||
          // filtre sur les élèves dans le détail si déjà chargé
          (factureEleveDetailData ?? []).some((fe: FactureElevePayeItem) =>
            fe.eleve_nom?.toLowerCase().includes(q) ||
            String(fe.montant_a_payer ?? '').includes(q) ||
            String(fe.montant_payer ?? '').includes(q) ||
            (fe.statut === 'confirmee' ? 'confirmé' : fe.statut === 'payee' ? 'à confirmer' : 'émis').includes(q)
          )
        )
      })
    : facturesClasseFiltrees


  const filtered = facturesClasse.filter(f => {
    if (onglet === 'confirmee') return f.statut === 'confirmee'
    if (onglet === 'paye') return f.statut_paiement === 'paye' || f.statut_paiement === 'partiel'
    return f.statut !== 'confirmee' && f.statut_paiement !== 'paye'
  })

  const counts = {
    a_payer:   facturesClasse.filter(f => f.statut !== 'confirmee' && f.statut_paiement !== 'paye').length,
    paye:      facturesClasse.filter(f => f.statut_paiement === 'paye' || f.statut_paiement === 'partiel').length,
    confirmee: facturesClasse.filter(f => f.statut === 'confirmee').length,
  }

  function fmtD(d: string | null) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return d }
  }
  function fmtM(v: number | null | undefined) {
    if (v == null) return '—'
    return `${Number(v).toLocaleString('fr-FR')} €`
  }

  const totalAPayer  = filtered.reduce((a, f) => a + (f.montant_a_payer as number || 0), 0)
  const totalPaye    = filtered.reduce((a, f) => a + (f.montant_payer as number || 0), 0)
  const totalRestant = totalAPayer - totalPaye

  const ONGLETS_LABELS = [
    { id: 'a_payer' as const, icon: '⏳', label: 'À payer' },
    { id: 'paye' as const, icon: '✅', label: 'Payées' },
    { id: 'confirmee' as const, icon: '🎓', label: 'Confirmées' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e1b4b' }}>💰 Mes Factures & Paiements</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>
            {facturesClasseFiltered.length} séance(s) facturée(s)
            {isFetching && !isLoading && <span style={{ marginLeft: 8, color: '#60a5fa', fontSize: 11 }}>Actualisation…</span>}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="month"
            value={factureFilterMonth}
            disabled={factureFilterAll}
            onChange={e => { setFactureFilterMonth(e.target.value); setFactureFilterAll(false) }}
            style={{
              padding: '4px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12,
              color: factureFilterAll ? '#94a3b8' : '#1e1b4b',
              background: factureFilterAll ? '#f8fafc' : '#fff',
              cursor: factureFilterAll ? 'not-allowed' : 'pointer'
            }}
          />
          <button
            onClick={() => setFactureFilterAll(p => !p)}
            style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + (factureFilterAll ? '#4f46e5' : '#e2e8f0'),
              background: factureFilterAll ? '#eef2ff' : '#f8fafc',
              color: factureFilterAll ? '#4f46e5' : '#64748b',
            }}>
            {factureFilterAll ? '✓ Tout' : 'Tout voir'}
          </button>
          <button onClick={() => refetch()} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: 'pointer', color: '#64748b' }}>🔄</button>
        </div>
      </div>

      {/* Cartes récap */}
      {!isLoading && facturesClasse.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'Total dû', val: facturesClasse.reduce((a, f) => a + (f.montant_a_payer as number || 0), 0), color: '#1e1b4b', bg: '#fff', border: '#e2e8f0' },
            { label: 'Total payé', val: facturesClasse.reduce((a, f) => a + (f.montant_payer as number || 0), 0), color: '#059669', bg: '#f0fdf4', border: '#a7f3d0' },
            { label: 'Reste à payer', val: facturesClasse.reduce((a, f) => a + (f.montant_a_payer as number || 0), 0) - facturesClasse.reduce((a, f) => a + (f.montant_payer as number || 0), 0), color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
          ].map(({ label, val, color, bg, border }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{label}</p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color }}>{fmtM(val)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0' }}>
        {ONGLETS_LABELS.map(o => (
          <button key={o.id} onClick={() => { setOnglet(o.id); setPage(1) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: '8px 8px 0 0', border: '1px solid', marginBottom: -2,
              borderColor: onglet === o.id ? '#e2e8f0' : 'transparent',
              borderBottomColor: onglet === o.id ? '#fff' : 'transparent',
              background: onglet === o.id ? '#fff' : '#f8fafc',
              color: onglet === o.id ? '#1d4ed8' : '#64748b',
            }}>
            {o.icon} {o.label}
            {counts[o.id] > 0 && (
              <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 20, background: onglet === o.id ? '#dbeafe' : '#e5e7eb', color: onglet === o.id ? '#1d4ed8' : '#6b7280', fontWeight: 700 }}>{counts[o.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0', color: '#94a3b8', gap: 10, alignItems: 'center' }}>
              <span style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'block' }} />
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{onglet === 'a_payer' ? '🎉' : onglet === 'paye' ? '📭' : '🏆'}</div>
              <p style={{ margin: 0, fontSize: 13 }}>
                {onglet === 'a_payer' ? 'Aucune facture en attente.' : onglet === 'paye' ? 'Aucun paiement enregistré.' : 'Aucun paiement confirmé.'}
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  {['Séance', 'Professeur', 'À payer', 'Payé', 'Reste', 'Progression', 'Paiement', 'Statut', ...(onglet === 'a_payer' ? ['Action'] : [])].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => {
                  const reste = (f.montant_a_payer as number || 0) - (f.montant_payer as number || 0)
                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      
                      <td style={{ padding: '10px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtD(f.date_seance)}</td>
                      <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{f.prof_nom || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e1b4b', whiteSpace: 'nowrap' }}>{fmtM(f.montant_a_payer)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#059669', whiteSpace: 'nowrap' }}>{fmtM(f.montant_payer)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap', color: reste > 0 ? '#d97706' : '#059669' }}>{fmtM(reste)}</td>
                      <td style={{ padding: '10px 12px', minWidth: 100 }}>
                        <ProgressPaiementInline paye={f.montant_payer as number || 0} total={f.montant_a_payer as number || 0} />
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                          background: f.statut_paiement === 'paye' ? '#d1fae5' : f.statut_paiement === 'partiel' ? '#fef3c7' : '#fee2e2',
                          color: f.statut_paiement === 'paye' ? '#065f46' : f.statut_paiement === 'partiel' ? '#92400e' : '#991b1b'
                        }}>
                          {f.statut_paiement === 'paye' ? '✅ Payée' : f.statut_paiement === 'partiel' ? '🔶 Partielle' : '⏳ À payer'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                          background: f.statut === 'confirmee' ? '#dbeafe' : f.statut === 'payee' ? '#d1fae5' : '#f1f5f9',
                          color: f.statut === 'confirmee' ? '#1e40af' : f.statut === 'payee' ? '#065f46' : '#475569'
                        }}>
                          {f.statut === 'confirmee' ? '🎓 Confirmée' : f.statut === 'payee' ? '✅ Payée' : '📄 Émise'}
                        </span>
                      </td>
                      {f.justificatif_url && (
                        <a href={f.justificatif_url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: '#2563eb', textDecoration: 'underline' }}>
                          📎 Voir justificatif
                        </a>
                      )}
                      {onglet === 'a_payer' && (
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          {f.statut !== 'confirmee' ? (
                            <button onClick={() => setPayModal(f)}
                              style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              💳 Payer
                            </button>
                          ) : <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={2} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total ({filtered.length})</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{fmtM(totalAPayer)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmtM(totalPaye)}</td>
                    <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: '#d97706' }}>{fmtM(totalRestant)}</td>
                    <td colSpan={onglet === 'a_payer' ? 4 : 3} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
        {/* Pagination */}
        {data && (data.previous || data.next) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <button disabled={!data.previous} onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, cursor: data.previous ? 'pointer' : 'not-allowed', opacity: data.previous ? 1 : .4 }}>← Précédent</button>
            <span style={{ fontSize: 11, color: '#64748b' }}>Page {page} / {Math.ceil((data.count ?? 0) / 10)}</span>
            <button disabled={!data.next} onClick={() => setPage(p => p + 1)}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 11, cursor: data.next ? 'pointer' : 'not-allowed', opacity: data.next ? 1 : .4 }}>Suivant →</button>
          </div>
        )}
      </div>

      {/* Note */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
        <p style={{ margin: 0, fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
          Cliquez sur <strong>💳 Payer</strong> pour enregistrer un paiement. Le professeur recevra une notification et pourra <strong>confirmer</strong> la réception.
        </p>
      </div>

      {payModal && <PayModalInline facture={payModal} onClose={() => setPayModal(null)} />}
    </div>
  )
}
interface WhiteboardProps { classeId: string; seanceId: string; role: 'eleve' | 'professeur' | 'admin' }
function CollaborativeWhiteboard({ classeId, seanceId, role }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const redoRef = useRef<ImageData[]>([])
  const [tool, setTool] = useState<'pen' | 'eraser' | 'highlighter' | 'cursor' | 'text'>('pen')
  const [color, setColor] = useState('#1a1a2e')
  const [lineWidth, setLineWidth] = useState(3)
  const [bgColor, setBgColor] = useState<'white' | 'grid' | 'lines'>('white')
  const [showArabicKeyboard, setShowArabicKeyboard] = useState(false)
  const [arabicText, setArabicText] = useState('')
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null)
  const [remoteCursor, setRemoteCursor] = useState<{ x: number; y: number } | null>(null)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const COLORS = [{ label: 'Noir', value: '#1a1a2e' }, { label: 'Rouge', value: '#e63946' }, { label: 'Bleu', value: '#1d6fa4' }, { label: 'Vert', value: '#2d9e6b' }, { label: 'Orange', value: '#f4a261' }, { label: 'Violet', value: '#7b2d8b' }, { label: 'Blanc', value: '#ffffff' }]
  const ARABIC_CHARS = ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي', 'ة', 'ى', 'لا', 'أ', 'إ', 'آ', 'ئ', 'ؤ', ' ', '،', '.']
  useEffect(() => {
    const token = localStorage.getItem('sabil_token')
    if (!token) { setWsStatus('disconnected'); return }
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://localhost:8000/ws/tableau/${classeId}/${seanceId}/?token=${token}`
    const connect = () => {
      const ws = new WebSocket(wsUrl); wsRef.current = ws; setWsStatus('connecting')
      ws.onopen = () => { setWsStatus('connected'); ws.send(JSON.stringify({ type: 'request_state' })) }
      ws.onmessage = e => { try { handleRemoteEvent(JSON.parse(e.data)) } catch { } }
      ws.onclose = () => { setWsStatus('disconnected'); setTimeout(connect, 3000) }
      ws.onerror = () => setWsStatus('disconnected')
    }
    connect()
    return () => wsRef.current?.close()
  }, [classeId, seanceId])
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; ctxRef.current = ctx; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; fillBg(ctx, canvas, bgColor) }, [bgColor])
  const fillBg = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, bg: string) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (bg === 'grid') { ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1; for (let x = 0; x < canvas.width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke() } for (let y = 0; y < canvas.height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke() } }
    else if (bg === 'lines') { ctx.strokeStyle = '#dbeafe'; ctx.lineWidth = 1; for (let y = 40; y < canvas.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke() } }
  }
  const hexToRgba = (hex: string, a: number) => { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgba(${r},${g},${b},${a})` }
  const handleRemoteEvent = useCallback((data: any) => {
    const canvas = canvasRef.current; const ctx = ctxRef.current; if (!canvas || !ctx) return
    if (data.type === 'draw') { ctx.globalCompositeOperation = data.tool === 'eraser' ? 'destination-out' : 'source-over'; ctx.strokeStyle = data.tool === 'highlighter' ? hexToRgba(data.color, 0.35) : data.color; ctx.lineWidth = data.lineWidth; ctx.globalAlpha = data.tool === 'highlighter' ? 0.35 : 1; ctx.beginPath(); ctx.moveTo(data.from.x, data.from.y); ctx.lineTo(data.to.x, data.to.y); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1 }
    else if (data.type === 'text') { ctx.font = `${data.fontSize || 40}px 'Amiri',serif`; ctx.fillStyle = data.color; ctx.direction = 'rtl'; ctx.fillText(data.text, data.x, data.y); ctx.direction = 'ltr' }
    else if (data.type === 'clear') { fillBg(ctx, canvas, bgColor) }
    else if (data.type === 'cursor' && role === 'eleve') { setRemoteCursor({ x: data.x, y: data.y }) }
    else if (data.type === 'canvas_state') { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = data.dataUrl }
    else if (data.type === 'undo' && data.dataUrl) { const img = new Image(); img.onload = () => { fillBg(ctx, canvas, bgColor); ctx.drawImage(img, 0, 0) }; img.src = data.dataUrl }
  }, [bgColor, role])
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect(); const sx = canvas.width / rect.width; const sy = canvas.height / rect.height
    if ('touches' in e) { const t = e.touches[0]; return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy } }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }
  const sendWs = (data: any) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data)) }
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current; if (!canvas) return; const pos = getPos(e, canvas)
    if (tool === 'text') { setTextPos(pos); setShowArabicKeyboard(true); return }
    isDrawing.current = true; lastPos.current = pos
    const ctx = ctxRef.current; if (!ctx) return
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height); historyRef.current.push(snap); redoRef.current = []
    if (role === 'professeur') sendWs({ type: 'cursor', x: pos.x, y: pos.y })
  }
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return; const canvas = canvasRef.current; const ctx = ctxRef.current; if (!canvas || !ctx) return
    const pos = getPos(e, canvas); const from = lastPos.current!
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = tool === 'highlighter' ? hexToRgba(color, 0.35) : color
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth; ctx.globalAlpha = tool === 'highlighter' ? 0.35 : 1
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1
    sendWs({ type: 'draw', tool, color, lineWidth: tool === 'eraser' ? lineWidth * 4 : lineWidth, from, to: pos })
    if (role === 'professeur') sendWs({ type: 'cursor', x: pos.x, y: pos.y })
    lastPos.current = pos
  }
  const stopDraw = () => { isDrawing.current = false; lastPos.current = null }
  const handleUndo = () => {
    const canvas = canvasRef.current; const ctx = ctxRef.current; if (!canvas || !ctx || !historyRef.current.length) return
    const prev = historyRef.current.pop()!; redoRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); ctx.putImageData(prev, 0, 0)
    sendWs({ type: 'undo', dataUrl: canvas.toDataURL() })
  }
  const handleClear = () => {
    const canvas = canvasRef.current; const ctx = ctxRef.current; if (!canvas || !ctx) return
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); redoRef.current = []; fillBg(ctx, canvas, bgColor); sendWs({ type: 'clear' })
  }
  const handleArabicConfirm = () => {
    if (!arabicText.trim() || !textPos) return
    const canvas = canvasRef.current; const ctx = ctxRef.current; if (!canvas || !ctx) return
    const fontSize = 80; ctx.font = `${fontSize}px 'Amiri',serif`; ctx.fillStyle = color; ctx.direction = 'rtl'; ctx.fillText(arabicText, textPos.x, textPos.y); ctx.direction = 'ltr'
    sendWs({ type: 'text', text: arabicText, x: textPos.x, y: textPos.y, fontSize, color }); setShowArabicKeyboard(false); setArabicText(''); setTextPos(null)
    }
  return (
    <div className="flex flex-col h-full bg-neutral-50">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-neutral-200 flex-wrap">
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          {(['pen', 'highlighter', 'eraser', 'cursor', 'text'] as const).map(t => (
            <button key={t} onClick={() => setTool(t)} title={t} className={`w-8 h-8 flex items-center justify-center rounded text-sm transition ${tool === t ? 'bg-white shadow text-indigo-700' : 'text-neutral-500 hover:bg-white/60'}`}>
              {t === 'pen' ? '✏️' : t === 'highlighter' ? '🖊️' : t === 'eraser' ? '⬜' : t === 'cursor' ? '🖱️' : 'ع'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {COLORS.map(c => <button key={c.value} onClick={() => setColor(c.value)} style={{ background: c.value }} className={`w-6 h-6 rounded-full border-2 transition ${color === c.value ? 'border-indigo-500 scale-110' : 'border-transparent'}`} title={c.label} />)}
        </div>
        <input type="range" min="1" max="20" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-20" />
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          {(['white', 'grid', 'lines'] as const).map(bg => <button key={bg} onClick={() => setBgColor(bg)} className={`px-2 py-1 text-xs rounded transition ${bgColor === bg ? 'bg-white shadow text-indigo-700' : 'text-neutral-500'}`}>{bg === 'white' ? '□' : bg === 'grid' ? '⊞' : '≡'}</button>)}
        </div>
        <div className="flex gap-1 ml-auto">
          <button onClick={handleUndo} className="px-2 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 rounded transition">↩ Annuler</button>
          <button onClick={handleClear} className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded transition">🗑️ Effacer</button>
        </div>
        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${wsStatus === 'connected' ? 'bg-green-100 text-green-700' : wsStatus === 'connecting' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
          {wsStatus === 'connected' ? '● En direct' : wsStatus === 'connecting' ? '⏳ Connexion…' : '✗ Déconnecté'}
        </span>
      </div>
      <div className="flex-1 overflow-auto relative">
        <canvas ref={canvasRef} width={1200} height={700} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} style={{ cursor: tool === 'cursor' ? 'default' : tool === 'eraser' ? 'crosshair' : tool === 'text' ? 'text' : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Ccircle cx='8' cy='8' r='7' fill='none' stroke='%23000' stroke-width='1'/%3E%3C/svg%3E") 8 8, crosshair`, display: 'block', touchAction: 'none', maxWidth: '100%' }} />
        {remoteCursor && role === 'eleve' && <div style={{ position: 'absolute', left: remoteCursor.x, top: remoteCursor.y, pointerEvents: 'none', transform: 'translate(-50%,-50%)', width: 12, height: 12, borderRadius: '50%', background: 'rgba(99,102,241,.7)', boxShadow: '0 0 0 4px rgba(99,102,241,.2)' }} />}
      </div>
      {showArabicKeyboard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl">
            <h4 className="font-semibold text-neutral-900 mb-3">✍️ Clavier arabe</h4>
            <div className="w-full border border-neutral-200 rounded px-3 py-2 mb-2 text-right text-lg bg-neutral-50 min-h-[40px]" style={{ fontFamily: "'Amiri',serif", direction: 'rtl' }}>{arabicText || <span className="text-neutral-300">Votre texte…</span>}</div>
            <div className="flex flex-wrap gap-1 mb-2 max-h-28 overflow-y-auto">{ARABIC_CHARS.map((char, i) => <button key={i} onClick={() => setArabicText(p => p + char)} className="w-8 h-8 border border-neutral-200 rounded hover:bg-indigo-50 text-sm font-medium" style={{ fontFamily: "'Amiri',serif" }}>{char}</button>)} <button onClick={() => setArabicText(p => p.slice(0, -1))} className="px-2 h-8 border border-red-200 text-red-500 rounded hover:bg-red-50 text-xs">⌫</button></div>
            <div className="flex justify-end gap-2"><button onClick={() => { setShowArabicKeyboard(false); setArabicText('') }} className="px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 rounded">Annuler</button> <button onClick={handleArabicConfirm} disabled={!arabicText.trim()} className="px-4 py-1 text-sm bg-indigo-600 text-white rounded disabled:opacity-50">Écrire</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function MsgTicks({ msg, userId }: { msg: Message; userId: string }) {
  const expId = typeof msg.expediteur === 'object' ? (msg.expediteur as any)?.id : msg.expediteur
  if (expId !== userId) return null

  const recuPar: string[] = msg.recu_par ?? []
  const luPar: string[]   = msg.lu_par_ids ?? []

  if (luPar.length > 0)   return <span style={{ color: '#3b82f6', fontSize: 13 }}>✓✓</span>
  if (recuPar.length > 0) return <span style={{ color: '#9ca3af', fontSize: 13 }}>✓✓</span>
  return <span style={{ color: '#9ca3af', fontSize: 13 }}>✓</span>
}


// ─── Icônes chat ───────────────────────────────────────────
function ChatAttachIcon() {
return (
 <svg
width="20"
height="20"
viewBox="0 0 24 24"
fill="none"
stroke="currentColor"
strokeWidth="1.9"
strokeLinecap="round"
strokeLinejoin="round"
 >
 <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
 </svg>
)
}
function ChatMicIcon() {
return (
 <svg
width="20"
height="20"
viewBox="0 0 24 24"
fill="none"
stroke="currentColor"
strokeWidth="1.9"
strokeLinecap="round"
strokeLinejoin="round"
 >
 <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
 <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
 <line x1="12" y1="19" x2="12" y2="23" />
 <line x1="8" y1="23" x2="16" y2="23" />
 </svg>
)
}
function ChatStopIcon() {
return (
 <svg
width="18"
height="18"
viewBox="0 0 24 24"
fill="currentColor"
 >
 <rect x="6" y="6" width="12" height="12" rx="3" />
 </svg>
)
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ClasseDetail({ role }: ClasseDetailProps) {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAppSelector(selectAuth)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<'salle' | 'chat' | 'tableau' | 'supports' | 'facture' | 'infos'| 'annonces'>((searchParams.get('tab') as any) || 'chat')
  const [messageText, setMessageText] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  // État principal : classe active à droite & classes sélectionnées à gauche
  const [activeClassId, setActiveClassId] = useState<string | null>(id || null)
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(id ? new Set([id]) : new Set())
  const [filterDay, setFilterDay] = useState<string>('')
  const [seancesParClasse, setSeancesParClasse] = useState<Record<string, Seance[]>>({})
  const [loadingSeances, setLoadingSeances] = useState(false)
  const [liveKitSession, setLiveKitSession] = useState<LiveKitSession | null>(null)
  const [joiningSalle, setJoiningSalle] = useState(false)
  const [editingSeanceId, setEditingSeanceId] = useState<string | null>(null)
  const [editHeure, setEditHeure] = useState('')
  const [editHeureFin, setEditHeureFin] = useState('')
  const [savingSeance, setSavingSeance] = useState(false)
  const [profFormOpenId, setProfFormOpenId] = useState<string | null>(null)
  const [showTodayPopup, setShowTodayPopup] = useState(false)
  const todayPopupRef = useRef<HTMLDivElement>(null)
  // 🆕 NOUVEAU : États et refs pour le menu d'attachment style WhatsApp
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  // ═══════════════════════════════════════════════════════════════
  // 🆕 NOUVEAU : États pour les fichiers et l'enregistrement vocal
  // ═══════════════════════════════════════════════════════════════
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // ── États popup sélection séance (si > 1 séance aujourd'hui) ──
  const [showSeanceSelectModal, setShowSeanceSelectModal] = useState(false)
  const [selectedSeanceForJoin, setSelectedSeanceForJoin] = useState<Seance | null>(null)

  // ── États calendrier absences (séances autres jours) ─────────
  const [absCalModal, setAbsCalModal] = useState<{ classeId: string; classeNom: string } | null>(null)
  const [absCalYear, setAbsCalYear]   = useState(() => new Date().getFullYear())
  const [absCalMonth, setAbsCalMonth] = useState(() => new Date().getMonth() + 1)
  // Date cliquée dans le calendrier → pré-remplir SeanceProfRow
  const [profFormDateOverride, setProfFormDateOverride] = useState<{ seanceId: string; date: string } | null>(null)

  // ── États ajout créneau par classe ───────────────────────────
  const [addingCreneauClasse, setAddingCreneauClasse] = useState<string | null>(null)
  const [newCreneauDraft, setNewCreneauDraft] = useState<{ jour: string; heure: string; heureFin: string }>({ jour: 'lundi', heure: '', heureFin: '' })
  const [savingCreneau, setSavingCreneau] = useState(false)

  // ── États modal saisir infos depuis calendrier ───────────────
  const [saisirInfosModal, setSaisirInfosModal] = useState<{ seance: Seance; date: string } | null>(null)
  const [factureExpandedId, setFactureExpandedId] = useState<string | null>(null)
  const [factureASoumettre, setFactureASoumettre] = useState<Facture | null>(null)
  const [factureConfirmingAll, setFactureConfirmingAll] = useState<Record<string, boolean>>({})
  const [factureConfirmingSingle, setFactureConfirmingSingle] = useState<Record<string, boolean>>({})
  const [factureSubmitting, setFactureSubmitting] = useState<string | null>(null)
  const [factureRecalling, setFactureRecalling] = useState<Record<string, boolean>>({})
  const [factureAutoGenerating, setFactureAutoGenerating] = useState(false)
  const [factureFilterMonth, setFactureFilterMonth] = useState<string>(() => {

    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` // "2026-06"
  })
  const [factureFilterAll, setFactureFilterAll] = useState(false)
  const [factureSearch, setFactureSearch] = useState('')
  // 🆕 Nouveaux états pour le popup info & panneau droit
  const [showClassInfo, setShowClassInfo] = useState(false)
  const [classPanelOpen, setClassPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<'active' | 'pause' | 'delete'>('active')
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({})
  const [editingClass, setEditingClass] = useState<string | null>(null)
  const [editClassDraft, setEditClassDraft] = useState<Partial<Class>>({})

  const { data: classesData, isLoading: loadingClasses } = useGetClassesQuery({}, { pollingInterval: 60000 })
  const allClasses: Class[] = classesData?.results || []

  
  const { data: notificationsData } = useGetNotificationsQuery({ page: 1, lu: false }, { pollingInterval: 30000 })
  const unreadNotifs = notificationsData?.results?.filter(n => !n.lu) || []
  const [markRead] = useMarkNotificationReadMutation()

  const CLASSE_BADGE_TYPES = ['changement_creneau', 'nouveau_creneau', 'classe_a_supprimer', 'classe_mise_en_pause', 'new_message_chat_classe','new_facture_soumise', 'new_facture_soumise_recall', 'facture_payee', 'facture_confirmee', 'facture_totalement_payee', 'facture_confirmee']
  const CLASSE_MARK_READ_TYPES = ['changement_creneau', 'nouveau_creneau']
  const CHAT_BADGE_TYPES = ['new_message_chat_classe']
  const DEVOIR_BADGE_TYPES = ['nouveau_devoir']
  const INFOS_BADGE_TYPES: Record<string, string[]> = {
    eleve: ['new_facture_soumise', 'facture_confirmee'],
    direction: ['new_facture_soumise', 'new_facture_soumise_recall', 'facture_payee', 'facture_confirmee', 'facture_totalement_payee'],
    admin: ['new_facture_soumise', 'new_facture_soumise_recall', 'facture_payee', 'facture_confirmee', 'facture_totalement_payee'],
    professeur: ['facture_payee', 'facture_totalement_payee'],
  }
  const SALLE_BADGE_TYPES = ['cours_demarrer']
  const CLASSES_PANEL_ALERT_TYPES: Record<string, string[]> = {
    admin: ['classe_a_supprimer', 'classe_mise_en_pause', 'classe_supprimer', 'classe_reactiver'],
    direction: ['classe_a_supprimer', 'classe_mise_en_pause', 'classe_supprimer', 'classe_reactiver'],
    professeur: ['classe_supprimer', 'classe_reactiver'],
  }
  // Admin can only see classes of their own professors (admin_id matches user.id)

  const { data: usersData } = useGetUsersQuery(
    { role: 'professeur', page: 1 },
    { skip: role !== 'admin' && role !== 'direction' }
  )
  const adminProfIds = useMemo(
    () => (usersData?.results ?? []).map((u: any) => u.id),
    [usersData?.results]
  )
  // Direction: filter by selected professor
  const [directionProfFilter, setDirectionProfFilter] = useState<string>('')
  const directionProfList: User[] = useMemo(
    () => usersData?.results ?? [],
    [usersData?.results]
  )
  const [filterClasse, setFilterClasse] = useState('')
  const classes: Class[] = useMemo(() => {
    if (role === 'admin') return allClasses.filter((cls: any) => adminProfIds.includes(cls.professeur))
    if (role === 'direction' && directionProfFilter) return allClasses.filter((cls: any) => cls.professeur === directionProfFilter || cls.professeur?.id === directionProfFilter)
    return allClasses
  }, [role, allClasses, adminProfIds, directionProfFilter])

  const [updateSeance] = useUpdateSeanceMutation()
  const [pauseClass] = usePauseClassMutation()
  const [flagDeleteClass] = useFlagDeleteClassMutation()
  const [reactivateClass] = useReactivateClassMutation()
  const [updateClass] = useUpdateClassMutation()

  // ── Mutations / Queries Factures ─────────────────────────────
  const {
    data: facturesData,
    refetch: refetchFactures,
  } = useGetFacturesEmisesQuery(
    { page: 1, classe_id: activeClassId || '' },
    { skip: !activeClassId || (role !== 'professeur' && role !== 'direction' && role !== 'admin') }
  )
  

  const facturesClasse: Facture[] = (facturesData?.results ?? []).filter(
    (f: Facture) => f.classe === activeClassId
  )
  const facturesClasseFiltrees = factureFilterAll
  ? facturesClasse
  : facturesClasse.filter(f => {
      if (!f.date_debut) return false
      return f.date_debut.startsWith(factureFilterMonth) || f.date_fin?.startsWith(factureFilterMonth)
    })

    

    
  const [createFacture] = useCreateFactureMutation()
  const [previewFacture] = usePreviewFactureMutation()
  const [sendFactureReminder] = useSendFactureReminderMutation()
  const [updateParticipantsPayment] = useUpdateParticipantsPaymentMutation()
  const [confirmerFactureEleve] = useConfirmerFactureEleveMutation()
  const [confirmerToutFactureEleve] = useConfirmerToutFactureEleveMutation()
  const [submitFacture] = useSubmitFactureMutation()

  const {
    data: factureEleveDetailData,
  } = useGetFactureEleveByFactureQuery(
    factureExpandedId ?? '',
    { skip: !factureExpandedId }
  )

  const [createSeanceDispo] = useCreateSeanceDispoMutation()

  // Vrai seulement si on est le 1er du mois ET que l'élève n'a pas encore cliqué
  const [factureIconDismissed, setFactureIconDismissed] = useState(() => {
    const key = `facture_blink_${new Date().getFullYear()}_${new Date().getMonth()}`
    return localStorage.getItem(key) === '1'
  })
  const isFirstOfMonth = new Date().getDate() === 1
  const showFactureBlink = role === 'eleve' && isFirstOfMonth && !factureIconDismissed

  // Juste après les autres useState
  const factureBlinkKey = `facture_blink_${new Date().getFullYear()}_${new Date().getMonth()}`
  const [factureBlinkDismissed, setFactureBlinkDismissed] = useState(() =>
    localStorage.getItem(factureBlinkKey) === '1'
  )
  const dismissFactureBlink = () => {
    const key = `facture_blink_${new Date().getFullYear()}_${new Date().getMonth()}`
    localStorage.setItem(key, '1')
    setFactureIconDismissed(true)
  }

  const handleAddCreneau = async (classeId: string) => {
    if (!newCreneauDraft.heure || !newCreneauDraft.heureFin) { alert('Renseignez l\'heure de début et de fin'); return }
    const [h1, m1] = newCreneauDraft.heure.split(':').map(Number)
    const [h2, m2] = newCreneauDraft.heureFin.split(':').map(Number)
    const duree = (h2 * 60 + m2) - (h1 * 60 + m1)
    if (duree <= 0) { alert('L\'heure de fin doit être après l\'heure de début'); return }
    setSavingCreneau(true)
    try {
      const cls = classes.find(c => c.id === classeId)
      const profId = typeof cls?.professeur === 'string' ? cls.professeur : (cls?.professeur as any)?.id || user?.id
      await createSeanceDispo({
        classe: classeId,
        professeur_disponible: profId,
        jour_seance: newCreneauDraft.jour,
        heure_debut_reelle: newCreneauDraft.heure + ':00',
        duree_reelle_minutes: duree,
        statut: 'active',
      } as any).unwrap()
      // Rafraîchir les séances de cette classe
      const res = await api.get(`/classes/${classeId}/seances/`)
      setSeancesParClasse(prev => ({ ...prev, [classeId]: res.data.results || [] }))
      setAddingCreneauClasse(null)
      setNewCreneauDraft({ jour: 'lundi', heure: '', heureFin: '' })
    } catch (err: any) {
      alert(err?.data?.error || '❌ Impossible d\'ajouter le créneau')
    } finally { setSavingCreneau(false) }
  }
  const [loadingDevoirs, setLoadingDevoirs] = useState(false)
  const [newDevoir, setNewDevoir] = useState<{ titre: string; files: File[] } | null>(null)
  const [devoirs, setDevoirs] = useState<any[]>([])
  const [timerDevoirId, setTimerDevoirId] = useState<string | null>(null)
  const [timerMinutes, setTimerMinutes] = useState<number>(0)
  const [timerRemaining, setTimerRemaining] = useState<number>(0)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [uploadingStudentFiles, setUploadingStudentFiles] = useState<Record<string, boolean>>({})
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [showQueryFinModal, setShowQueryFinModal] = useState(false)
  const [queryFinResponse, setQueryFinResponse] = useState<'oui' | 'non' | null>(null)
  const [studentPresence, setStudentPresence] = useState<Record<string, boolean>>({})
  const [studentsInClass, setStudentsInClass] = useState<Array<{ id: string; name: string }>>([])
  const [coursBienPasse, setCoursBienPasse] = useState<boolean | null>(null)

  // Query pour les élèves du popup info
  const { data: headerInscriptions } = useGetInscriptionsQuery(
    { classe: activeClassId || '' },
    { skip: !activeClassId || !showClassInfo }
  )
  const activeClass = useMemo(() => classes.find(c => c.id === activeClassId), [classes, activeClassId])

  
  const inscritCount = headerInscriptions?.results?.length ?? activeClass?.nb_inscrits ?? 0

  const todayDayName = getTodayDayName()


  const getFullUrl = (url: string | null | undefined) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // ⚠️ Remplace 'http://localhost:8000' par l'URL réelle de ton backend si elle est différente
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video'; name?: string } | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<any>(null); // Peut être null ou un objet Message

  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set())
  const canDeleteMessages = role === 'direction' || role === 'admin'
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)


  const { data: mesAnnoncesRaw } = useGetMesAnnoncesQuery(undefined, {
    skip: role !== 'eleve',
  })
  const mesAnnonces: AnnonceEleve[] = Array.isArray(mesAnnoncesRaw)
    ? mesAnnoncesRaw
    : (mesAnnoncesRaw as any)?.results ?? []

  
    const annoncesActives = (role === 'eleve')
      ? (() => {
          const raw = mesAnnonces  // variable définie à l'étape B
          return raw
        })()
      : []
    const hasNonLues = annoncesActives.some((a: any) => !a.statut)
    
    const [leftPanelOpen, setLeftPanelOpen] = useState(true)


    

  // Sélectionner toutes les classes automatiquement (plus de toggle manuel)
  useEffect(() => {
    if (classes.length > 0) {
      setSelectedClassIds(new Set(classes.map((c: Class) => c.id)))
    }
  }, [classes])
  useEffect(() => { if (id) { setActiveClassId(id); setSelectedClassIds(prev => { const n = new Set(prev); n.add(id); return n }) } }, [id])

  // Chargement des séances pour toutes les classes
  useEffect(() => {
    if (!classes.length) return
    const loadSeances = async () => {
      try {
        setLoadingSeances(true)
        const results: Record<string, Seance[]> = {}
        await Promise.all(classes.map(async (cls: Class) => {
          const res = await api.get(`/classes/${cls.id}/seances/`)
          results[cls.id] = res.data.results || []
        }))
        setSeancesParClasse(results)
      } catch { }
      finally { setLoadingSeances(false) }
    }
    loadSeances()
  }, [classes])

  // Chat polling
  useEffect(() => {
    if (!activeClassId || activeTab !== 'chat') return
    const load = async () => {
  try {
    const res = await api.get('/messages/', { params: { classe_id: activeClassId } })
    const msgs: Message[] = res.data.results || []
    setMessages(msgs)

    // Marquer comme lu — gérer expediteur string ou objet
    msgs
      .filter(m => {
        const expId = typeof m.expediteur === 'object' ? (m.expediteur as any)?.id : m.expediteur
        return expId !== user?.id
      })
      .forEach(m => api.post(`/messages/${m.id}/lu/`).catch(() => {}))

  } catch { }
}
    load(); const interval = setInterval(load, 3000); return () => clearInterval(interval)
  }, [activeClassId, activeTab])

  const lastMsgIdRef = useRef<string | null>(null)
    useEffect(() => {
    if (activeTab !== 'chat') return
    if (messages.length === 0) return
    const container = chatScrollRef.current
    if (!container) return
    const lastMessage = messages[messages.length - 1]
    const lastId = lastMessage.id
    const isFirstLoad = lastMsgIdRef.current === null
    // ✅ Détecter si c'est vraiment un NOUVEAU message
    const hasNewMessage = lastMsgIdRef.current !== null && lastMsgIdRef.current !== lastId
    const expId = typeof lastMessage.expediteur === 'object'
    ? (lastMessage.expediteur as any)?.id
    : lastMessage.expediteur
    const lastIsMine = expId === user?.id
    // ✅ Ne scroller que si : premier chargement, OU nouveau message ET (c'est le mien OU je suis déjà en bas)
    if (isFirstLoad || (hasNewMessage && lastIsMine) || (hasNewMessage && shouldAutoScroll.current)) {
    container.scrollTo({
    top: container.scrollHeight,
    behavior: isFirstLoad ? 'auto' : 'smooth'
    })
    }
    lastMsgIdRef.current = lastId
    }, [messages, activeTab, user?.id])

  const handleChatScroll = () => {
    const el = chatScrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScroll.current = distanceFromBottom < 150
  }

  const toggleSelectMsg = (id: string) => {
    setSelectedMsgIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const handlePressStart = (msgId: string) => {
    if (!canDeleteMessages) return
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      toggleSelectMsg(msgId) // entre en mode sélection + sélectionne ce message
    }, 450)
  }

  const handlePressEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  const handleMessageClick = (msgId: string) => {
    // Si l'appui long vient de se déclencher, on ignore ce clic (évite double-toggle)
    if (longPressTriggered.current) { longPressTriggered.current = false; return }
    if (canDeleteMessages && selectedMsgIds.size > 0) toggleSelectMsg(msgId)
  }

  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    const sameDay = (a: Date, b: Date) =>
      a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    if (sameDay(d, today)) return "Aujourd'hui"
    if (sameDay(d, yesterday)) return 'Hier'
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    })
  }

  const handleDeleteSelectedMessages = async () => {
    if (selectedMsgIds.size === 0) return
    if (!window.confirm(`Supprimer ${selectedMsgIds.size} message(s) ? Cette action est irréversible.`)) return
    try {
      await api.post('/messages/bulk-delete/', { ids: Array.from(selectedMsgIds) })
      setMessages(prev => prev.filter(m => !selectedMsgIds.has(m.id)))
      setSelectedMsgIds(new Set())
    } catch {
      alert("Erreur lors de la suppression.")
    }
  }
  
  useEffect(() => { if (activeTab !== 'salle') navigate(`?tab=${activeTab}`, { replace: true }) }, [activeTab, navigate])

  // Devoirs (liés à la classe active)
  useEffect(() => {
    if (!activeClassId) return
    setLoadingDevoirs(true)
    api.get(`/devoirs/`, { params: { classe_id: activeClassId } })
      .then(res => setDevoirs(res.data.results || res.data || []))
      .catch(() => { }).finally(() => setLoadingDevoirs(false))
  }, [activeClassId])

  useEffect(() => {
    const style = document.createElement('style'); style.id = 'salle-meet-styles'
    style.textContent = SALLE_STYLES; document.head.appendChild(style)
    return () => { document.getElementById('salle-meet-styles')?.remove() }
  }, [])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // 🆕 Actions panneau latéral droit
  const doAction = async (classId: string, action: string, fn: () => Promise<any>) => {
    setActionLoading(prev => ({ ...prev, [classId]: action }));
    try { await fn(); }
    catch (e) { console.error(e); }
    finally { setActionLoading(prev => { const n = { ...prev }; delete n[classId]; return n; }); }
  };
  const handlePauseClass = (id: string) => doAction(id, 'pause', () => pauseClass(id).unwrap());
  const handleFlagDeleteClass = (id: string) => {
    if (!window.confirm('Signaler pour suppression ? La direction sera notifiée.')) return Promise.resolve();
    return doAction(id, 'delete', () => flagDeleteClass(id).unwrap());
  };
  const handleReactivateClass = (id: string) => doAction(id, 'active', () => reactivateClass(id).unwrap());
  const handleEditClass = async (classId: string) => {
    try {
      await updateClass({ id: classId, ...editClassDraft }).unwrap();
      setEditingClass(null);
      setShowClassInfo(false);
    } catch (e) { alert('❌ Impossible de modifier la classe'); }
  };

  // ─── Auto-génération facture après séance validée ─────────────
  const autoGenerateFacture = async (seanceId: string, classeId: string, dateOverride?: string) => {
    if (role !== 'professeur') return
    try {
      setFactureAutoGenerating(true)
      const today = dateOverride ?? new Date().toISOString().split('T')[0]
      const payload = { classe_id: classeId, date_debut: today, date_fin: today }
      // Attendre que les AbsencesProfs soient bien créées côté Django (traitement asynchrone)
      await new Promise(r => setTimeout(r, 2000))
      const previewRes = await previewFacture(payload).unwrap()
      if (!previewRes || !previewRes.lignes?.length) return
      await createFacture(payload).unwrap()
      refetchFactures()
    } catch (err: any) {
      if (!err?.data?.error?.includes('existe déjà')) {
        console.warn('Auto-facture:', err?.data?.error || err)
      }
    } finally {
      setFactureAutoGenerating(false)
    }
  }

  // ─── Handlers factures onglet Infos ───────────────────────────
  const fmtEuros = (val: string | number | null | undefined) => {
    if (val == null) return '—'
    return `${parseFloat(String(val)).toFixed(4)} €`
  }
  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }


  // Après facturesClasseFiltrees existante :
    const facturesClasseFiltered = (role === 'admin' || role === 'direction') && factureSearch.trim()
      ? facturesClasseFiltrees.filter(f => {
          const q = factureSearch.toLowerCase()
          return (
            // filtre sur les données de la facture elle-même
            fmtDate(f.date_debut).toLowerCase().includes(q) ||
            fmtDate(f.date_fin).toLowerCase().includes(q) ||
            String(f.montant_total ?? '').includes(q) ||
            String(f.part_prof ?? '').includes(q) ||
            String(f.part_direction ?? '').includes(q) ||
            String(f.honoraire ?? '').includes(q) ||
            (f.statut === 'payee' ? 'payée' : f.statut === 'envoyee' ? 'en attente' : 'brouillon').includes(q) ||
            // filtre sur les élèves dans le détail si déjà chargé
            (factureEleveDetailData ?? []).some((fe: FactureElevePayeItem) =>
              fe.eleve_nom?.toLowerCase().includes(q) ||
              String(fe.montant_a_payer ?? '').includes(q) ||
              String(fe.montant_payer ?? '').includes(q) ||
              (fe.statut === 'confirmee' ? 'confirmé' : fe.statut === 'payee' ? 'à confirmer' : 'émis').includes(q)
            )
          )
        })
      : facturesClasseFiltrees

  const handleFactureConfirmAll = async (factureId: string) => {
    setFactureConfirmingAll(prev => ({ ...prev, [factureId]: true }))
    try {
      const res = await confirmerToutFactureEleve({ facture_id: factureId }).unwrap()
      alert(`✅ ${res.count} paiement(s) confirmé(s)`)
      refetchFactures()
    } catch (err: any) {
      alert(err?.data?.error ?? 'Erreur')
    } finally {
      setFactureConfirmingAll(prev => ({ ...prev, [factureId]: false }))
    }
  }

  const handleFactureConfirmSingle = async (factureEleveId: string) => {
    setFactureConfirmingSingle(prev => ({ ...prev, [factureEleveId]: true }))
    try {
      await confirmerFactureEleve(factureEleveId).unwrap()
      refetchFactures()
    } catch (err: any) {
      alert(err?.data?.error ?? 'Erreur')
    } finally {
      setFactureConfirmingSingle(prev => ({ ...prev, [factureEleveId]: false }))
    }
  }

  const handleFactureSubmit = async (facture: Facture) => {
    setFactureSubmitting(facture.id)
    try {
      await submitFacture({ facture_id: facture.id, methode: 'participants' }).unwrap()
      alert('✅ Facture soumise aux élèves')
      refetchFactures()
    } catch (err: any) {
      alert(err?.data?.error ?? 'Erreur lors de la soumission')
    } finally {
      setFactureSubmitting(null)
    }
  }

  const handleFactureReminder = async (factureId: string) => {
    try {
      await sendFactureReminder(factureId).unwrap()
      alert('🔔 Rappel envoyé')
    } catch {
      alert("Erreur lors de l'envoi du rappel")
    }
  }

  const handleFactureRecall = async (factureId: string) => {
    if (!window.confirm('Rappeler cette facture ? Les demandes de paiement seront marquées comme rappelées.')) return
    setFactureRecalling(prev => ({ ...prev, [factureId]: true }))
    try {
      await api.post(`/factures-emises/${factureId}/recall/`)
      refetchFactures()  // ← comme submit, on refetch sans quitter la classe
    } catch { alert('❌ Impossible de rappeler la facture') }
    finally { setFactureRecalling(prev => ({ ...prev, [factureId]: false })) }
  }


  const todaySeancesForActive = useMemo(() => {
    if (!activeClassId) return []
    return (seancesParClasse[activeClassId] || []).filter(s => s.jour_seance?.toLowerCase() === todayDayName)
  }, [activeClassId, seancesParClasse, todayDayName])

  const defaultSeanceId = todaySeancesForActive.length > 0 ? todaySeancesForActive[0].id : (seancesParClasse[activeClassId] || [])[0]?.id || ''
  const groupedSeances = useMemo(() => {
    const group: Record<string, { cls: Class; seances: Seance[] }> = {}
    if (selectedClassIds.size === 0) return group
    Object.entries(seancesParClasse).forEach(([clsId, seances]) => {
      if (!selectedClassIds.has(clsId)) return
      const filtered = filterDay ? seances.filter(s => s.jour_seance?.toLowerCase() === filterDay.toLowerCase()) : seances
      if (filtered.length > 0) {
        const cls = classes.find(c => c.id === clsId)
        if (cls) group[clsId] = { cls, seances: filtered }
      }
    })
    return group
  }, [seancesParClasse, selectedClassIds, filterDay, classes])

  // 🆕 Données pour le panneau latéral droit
  const classesByStatut = {
    active: allClasses.filter(c => c.statut === 'active' || c.statut === 'active' || !c.statut),
    pause: allClasses.filter(c => c.statut === 'en_pause'),
    delete: allClasses.filter(c => c.statut === 'fin_session' || c.statut === 'a_supprimer'),
  };
  const displayedClasses = classesByStatut[panelTab];

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleClass = (clsId: string) => {
    setSelectedClassIds(prev => {
      const next = new Set(prev)
      next.has(clsId) ? next.delete(clsId) : next.add(clsId)
      return next
    })
  }
  const selectClassBlock = (clsId: string) => {
    setActiveClassId(clsId)
    if (role === 'direction') {
      setActiveTab('chat');
    } else {
      setActiveTab('chat');
    }

    unreadNotifs
    .filter((n: any) => n.classe === clsId && CLASSE_MARK_READ_TYPES.includes(n.type))
    .forEach((n: any) => markRead(n.id))

    if (window.innerWidth < 768) setLeftPanelOpen(false)
  }

  const isClasseLocked = (c: { statut?: string } | null | undefined) =>
  c?.statut === 'a_supprimer' || c?.statut === 'en_pause'

  const getDepartMessage = (statut?: string) => {
  const intro = statut === 'a_supprimer'
    ? `Ce groupe va bientôt être supprimé\nLe professeur est sorti du groupe.`
    : `Ce groupe est en pause\nLe professeur a terminé ses cours`

  return `Nous espérons que vous allez bien

  ${intro}
  Souhaitez poursuivre les cours dans d'autres matières ?
  Vous pouvez faire un essai 3.50€ la séance de 30min avec un autre professeur si vous le souhaitez.

  Voici les cours possibles en solo :
  Apprendre à lire, méthode al madania, nour al bayan, qaida nourania...
  Langue arabe programme forqan ou tome de Médine,
  Tajwid niveau 1 et 2, touhfatoul atfal, jazariyah, oussoul hafs, oussoul warch
  CORAN mémorisation, Correction, tilawa
  Fluidification de la lecture.
  Aquida la croyance, explication des 3 fondements, des 4 règles, des 6 fondements, les annulatifs de l'islam, kashf ach choubouhat, kitab at tawhid, oussoul sounnah...
  Fiqh jurisprudence, la prière, la purification, fiqh du couple, l'éducation des enfants, l'héritage, la vente...
  Tafsir
  Hadith
  Sira la biographie du prophète ﷺ
  Apprendre la Rokia
  Formation pour devenir enseignant.
  Cours mondains : maths, physique chimie...

  Si vous n'êtes pas intéressé pour le moment, vous pouvez nous retrouver ici :
  Canal principal ANNONCE DE COURS en groupe à petit prix
  t.me/sabil_al_ilm
  Canal de support de TAJWID
  t.me/sabil_al_ilm_TAJWID
  FACEBOOK
  https://www.facebook.com/share/1AN1QpNfod/
  INSTAGRAM
  https://www.instagram.com/sabil.al.ilm?igsh=OGk4ZHhkbXZpeHQ0
  CONTACT sœurs : sabil.al.ilm@gmail.com
  CONTACT frères : Sabil.al.ilm.homme@gmail.com
  SITE INTERNET
  https://sabil-al-ilm.org/

  Nous attendons votre retour.
  À bientôt إن شاء الله`
  }

  const handleEditSeance = (seance: Seance) => {
    setEditingSeanceId(seance.id)
    setEditHeure(seance.heure_debut_reelle?.substring(0, 5) || '')
    const fin = calcHeureFin(seance.heure_debut_reelle, seance.duree_reelle_minutes)
    setEditHeureFin(fin === '--:--' ? '' : fin)
  }

  const handleSaveEditSeance = async (seanceId: string) => {
     if (!editHeure || !editHeureFin) { alert('Renseignez l\'heure de début et de fin'); return }
      const [h1, m1] = editHeure.split(':').map(Number)
      const [h2, m2] = editHeureFin.split(':').map(Number)
      const duree = (h2 * 60 + m2) - (h1 * 60 + m1)
      if (duree <= 0) { alert('L\'heure de fin doit être après l\'heure de début'); return }
      setSavingSeance(true)
      try {
        await updateSeance({
          id: seanceId,
          heure_debut_reelle: editHeure.split(':').length === 3 ? editHeure : editHeure + ':00',
          duree_reelle_minutes: duree,   // ← le backend reçoit toujours la durée
        })
      const updatedSeances: Record<string, Seance[]> = { ...seancesParClasse }
      for (const clsId of Object.keys(seancesParClasse)) {
        const res = await api.get(`/classes/${clsId}/seances/`)
        updatedSeances[clsId] = res.data.results || []
      }
      setSeancesParClasse(updatedSeances)
      setEditingSeanceId(null)
    } catch { alert('❌ Impossible de modifier le créneau') }
    finally { setSavingSeance(false) }
  }
  
  const handleJoinSalle = async (seanceOverride?: Seance) => {
    
    if (!activeClassId || todaySeancesForActive.length === 0) return
    // Si > 1 séance aujourd'hui et aucune sélectionnée → ouvrir le popup
    if (todaySeancesForActive.length > 1 && !seanceOverride) {
      setShowSeanceSelectModal(true)
      return
    }
    const seanceToUse = seanceOverride ?? todaySeancesForActive[0]
    
    setJoiningSalle(true)
    try {
      const res = await api.post(`/classes/${activeClassId}/start-session/`, { seance_id: seanceToUse.id})
      setLiveKitSession({ presenceId: res.data.presence_id, seanceId: res.data.seance_id, roomName: res.data.room_name, token: res.data.livekit_token, serverUrl: res.data.livekit_url, isModerator: res.data.is_moderator })
      setActiveTab('salle')
      setShowSeanceSelectModal(false)
    } catch (err: any) { alert(`⚠️ ${err.response?.data?.error || 'Impossible de rejoindre la salle'}`) }
    finally { setJoiningSalle(false) }
  }
  const handleLeaveSession = async (audioUrl?: string) => {
    if (liveKitSession && activeClassId) {
      try {
        await api.post(`/classes/${activeClassId}/end-session/`, { presence_id: liveKitSession.presenceId, audio_url: audioUrl ?? '' })
        if (role === 'professeur') {
          // Auto-génération facture après fin de session (séance système)
          const r = await api.get(`/inscriptions/`, { params: { classe: activeClassId, role: 'eleve' } })
          setStudentsInClass((r.data.results || r.data || []).map((i: any) => ({ id: String(i.eleve_id || i.eleve?.id || i.user?.id), name: i.eleve_nom || i.display_name || 'Élève' })))
          setCoursBienPasse(null); setShowQueryFinModal(true);setCoursBienPasse(true); return
        }
      } catch { }
    }
    setLiveKitSession(null); setActiveTab('chat')
  }
  const handleAddDevoir = async () => {
    if (!newDevoir?.titre.trim() || !defaultSeanceId) return
    try {
      const res = await api.post('/devoirs/', { seance: defaultSeanceId, titre: newDevoir.titre, statut: 'brouillon' })
      if (newDevoir.files?.length > 0) { const fd = new FormData(); newDevoir.files.forEach(f => fd.append('files', f)); await api.post(`/devoirs/${res.data.id}/upload-files/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }) }
      const r2 = await api.get(`/devoirs/`, { params: { seance: defaultSeanceId } }); setDevoirs(r2.data.results || r2.data || []); setNewDevoir(null)
    } catch { alert('❌ Impossible d\'ajouter le devoir') }
  }
  const handleSubmitDevoir = async (devoirId: string) => {
    try { await api.patch(`/devoirs/${devoirId}/`, { statut: 'soumis', submitted_at: new Date().toISOString() }); setDevoirs(prev => prev.map(d => d.id === devoirId ? { ...d, statut: 'soumis', submitted_at: new Date().toISOString() } : d)) }
    catch { alert('❌ Impossible de soumettre') }
  }
  const handleCloturerDevoir = async (devoirId: string) => {
    try { await api.patch(`/devoirs/${devoirId}/`, { statut: 'cloturer' }); setDevoirs(prev => prev.map(d => d.id === devoirId ? { ...d, statut: 'cloturer' } : d)); if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }; setTimerDevoirId(null) }
    catch { alert('❌ Impossible de clôturer') }
  }
  const handleStartTimer = (devoirId: string, minutes: number) => {
    setTimerDevoirId(devoirId); setTimerMinutes(minutes); setTimerRemaining(minutes * 60); setShowTimerModal(false)
    timerRef.current = setInterval(() => {
      setTimerRemaining(prev => { if (prev <= 1) { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; handleCloturerDevoir(devoirId); return 0 }; return prev - 1 })
    }, 1000)
  }
  const handleStudentUpload = async (devoirId: string, files: FileList) => {
    if (!files.length) return
    setUploadingStudentFiles(prev => ({ ...prev, [devoirId]: true }))
    try {
      const fd = new FormData(); Array.from(files).forEach(f => fd.append('files', f)); fd.append('eleve_id', user?.id || '')
      await api.post(`/devoirs/${devoirId}/student-upload/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      alert('✅ Copie envoyée'); const r = await api.get(`/devoirs/`, { params: { seance: defaultSeanceId } }); setDevoirs(r.data.results || r.data || [])
    } catch { alert('❌ Échec de l\'envoi') }
    finally { setUploadingStudentFiles(prev => ({ ...prev, [devoirId]: false })) }
  }
  const handleDownloadFile = (file: any) => { const l = document.createElement('a'); l.href = file.fichier_url || `/api/fichiers/${file.id}/download/`; l.download = file.nom_original; l.click() }
 


  // ═══════════════════════════════════════════════════════════════
  // 🆕 NOUVEAU : Gestion de l'enregistrement vocal
  // ═══════════════════════════════════════════════════════════════
// 🆕 AJOUTER JUSTE AVANT handleSendMessage :
const getExpirationWarning = (msg: Message) => {
  const expiresAt = (msg as any).fichier_expires_at || msg.fichier?.expires_at; 
  const isVoiceNote = (msg as any).is_voice_note || msg.fichier?.is_voice_note || false;
  if (!expiresAt || isVoiceNote) return null;
  const now = new Date().getTime();
  const expTime = new Date(expiresAt).getTime();
  const diffHours = (expTime - now) / (1000 * 60 * 60);
  if (diffHours > 0 && diffHours <= 24) return `⚠️ Suppression dans ${Math.ceil(diffHours)}h`;
  return null;
};

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];
    mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setAudioBlob(blob);
      stream.getTracks().forEach(track => track.stop());
    };
    mediaRecorder.start();
    setIsRecording(true);
  } catch (err) { alert("❌ Accès au microphone refusé."); }
};

const stopRecording = () => {
  if (mediaRecorderRef.current && isRecording) {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  }
};
  // ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// 🆕 MODIFIÉ : Gestion de l'envoi avec FormData (Texte, Fichier, Vocal)
// ═══════════════════════════════════════════════════════════════
const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  shouldAutoScroll.current = true
  if ((!messageText.trim() && selectedFiles.length === 0 && !audioBlob) || !activeClassId) return;

  try {
    const formData = new FormData();
    formData.append('classe_id', activeClassId);
    formData.append('contenu', messageText);

    if (replyToMessage) {
      formData.append('reply_to', replyToMessage.id);
    }

    if (audioBlob) {
      const audioFile = new File([audioBlob], `vocal_${Date.now()}.webm`, { type: 'audio/webm' });
      formData.append('fichier', audioFile);
      formData.append('type_message', 'audio');
      formData.append('is_voice_note', 'true');
    } else if (selectedFiles.length > 0) {
      const file = selectedFiles[0];
      formData.append('fichier', file);
      
      let typeMsg = 'fichier';
      if (file.type.startsWith('image/')) typeMsg = 'image';
      else if (file.type.startsWith('video/')) typeMsg = 'video';
      else if (file.type.startsWith('audio/')) typeMsg = 'audio';
      
      formData.append('type_message', typeMsg);
      formData.append('is_voice_note', 'false');
    } else {
      formData.append('type_message', 'texte');
      formData.append('is_voice_note', 'false');
    }

    await api.post('/messages/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    setMessageText('');
    setSelectedFiles([]);
    setAudioBlob(null);
    setReplyToMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (docInputRef.current) docInputRef.current.value = '';
    
  } catch (err) {
    console.error("Erreur envoi message", err);
    alert("❌ Échec de l'envoi du message");
  }
};
// ═══════════════════════════════════════════════════════════════



  // 🆕 Filtrage des onglets pour directeur
  const availableTabs = useMemo(() => {
    
    const base = [
      ...(role === 'eleve' && annoncesActives.length > 0
        ? [{ id: 'annonces', icon: '📢', label: 'Annonces', hasAlert: hasNonLues }]
        : []),
      { id: 'salle', icon: '🎥', label: 'Salle', hasAlert: unreadNotifs.some(n => n.classe === activeClassId && SALLE_BADGE_TYPES.includes(n.type)) },
      { id: 'chat', icon: '💬', label: 'Chat' , hasAlert: unreadNotifs.some(n => n.classe === activeClassId && CHAT_BADGE_TYPES.includes(n.type))},
      { id: 'tableau', icon: '🖊️', label: 'Tableau' },
      { id: 'supports', icon: '📁', label: 'Supports' },
      { id: 'infos', icon: '💰', label: 'Infos', hasAlert: showFactureBlink || unreadNotifs.some(n => n.classe === activeClassId && (INFOS_BADGE_TYPES[role] || []).includes(n.type)) },
    ];
    if (role === 'direction') return base.filter(t => ['salle', 'chat', 'infos'].includes(t.id));
    return base;
  }, [role, annoncesActives.length, hasNonLues, unreadNotifs, activeClassId]);

 useEffect(() => {
  if (role === 'direction' && !['salle', 'chat', 'infos'].includes(activeTab))
    {
      setActiveTab('chat');
    }
  }, [role, activeTab]);

  // ─── QueryFinModal ────────────────────────────────────────────────────────
  const QueryFinModal = () => {
    const handleSubmit = async () => {
      try {
        if (role === 'eleve' && queryFinResponse) await api.post(`/presences/${liveKitSession?.presenceId}/feedback/`, { type: 'resp_query_fin_eleve', response: queryFinResponse })
        else if (role === 'professeur') await api.post(`/classes/${activeClassId}/absences-profs/`, { seance_id: defaultSeanceId, type: 'resp_query_fin_prof', students: Object.entries(studentPresence).map(([sid, p]) => ({ student_id: sid, present: p })) })
          if (role === 'professeur' && liveKitSession && activeClassId) {
            autoGenerateFacture(liveKitSession.seanceId, activeClassId)
          }
      
        } catch { }
      finally {
               
                setShowQueryFinModal(false); setQueryFinResponse(null); setStudentPresence({}); setLiveKitSession(null); setActiveTab('chat')
              }


    }
    if (role === 'admin' || role === 'direction') {
      setShowQueryFinModal(false); setLiveKitSession(null); setActiveTab('chat')
      return null
    }
   
    if (role === 'professeur' && coursBienPasse === true) {
      return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">📋 Bilan de présence — {activeClass?.nom}</h3>
            <p className="text-sm text-neutral-600 mb-4">Confirmez la présence des élèves :</p>
            {studentsInClass.length > 0 && <div className="flex gap-2 mb-3"><button onClick={() => setStudentPresence(Object.fromEntries(studentsInClass.map(s => [s.id, true])))} className="flex-1 px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200">✅ Tous présents</button><button onClick={() => setStudentPresence(Object.fromEntries(studentsInClass.map(s => [s.id, false])))} className="flex-1 px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200">❌ Tous absents</button></div>}
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">{studentsInClass.map(s => (<label key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-neutral-50"><span className="text-sm">{s.name}</span><div className="flex gap-2"><button type="button" onClick={() => setStudentPresence(prev => ({ ...prev, [s.id]: true }))} className={`px-3 py-1 text-xs rounded border ${studentPresence[s.id] === true ? 'bg-green-100 border-green-500 text-green-700' : 'border-neutral-200 text-neutral-500'}`}>Présent</button><button type="button" onClick={() => setStudentPresence(prev => ({ ...prev, [s.id]: false }))} className={`px-3 py-1 text-xs rounded border ${studentPresence[s.id] === false ? 'bg-red-100 border-red-500 text-red-700' : 'border-neutral-200 text-neutral-500'}`}>Absent</button></div></label>))}</div>
            
            <div className="flex justify-end gap-3 mt-6">
              {/* <button onClick={() => { setShowQueryFinModal(false); setCoursBienPasse(null); setLiveKitSession(null); setActiveTab('chat') }} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg text-sm">Ignorer</button> */}
              <button 
                onClick={handleSubmit} 
                disabled={Object.keys(studentPresence).length === 0}
                className={`px-5 py-2 rounded-xl font-medium text-sm transition ${
                  Object.keys(studentPresence).length === 0
                    ? 'bg-indigo-300 text-white cursor-not-allowed opacity-60'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                }`}
              >
                Terminer
                {Object.keys(studentPresence).length > 0 && (
                  <span className="ml-2 text-xs opacity-80">
                    ({Object.keys(studentPresence).length}/{studentsInClass.length})
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )
    }
    if (role === 'eleve') {
      return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">🏁 Bilan de fin de séance</h3>
            <p className="text-sm text-neutral-600 mb-4">Votre enseignant·e a-t-il/elle été présent·e ?</p>
            <div className="flex gap-3 mb-6">
              <button onClick={() => setQueryFinResponse('oui')} className={`flex-1 py-3 rounded-xl font-medium border-2 transition ${queryFinResponse === 'oui' ? 'border-green-500 bg-green-50 text-green-700' : 'border-neutral-200 hover:border-green-300'}`}>✅ Oui</button>
              <button onClick={() => setQueryFinResponse('non')} className={`flex-1 py-3 rounded-xl font-medium border-2 transition ${queryFinResponse === 'non' ? 'border-red-500 bg-red-50 text-red-700' : 'border-neutral-200 hover:border-red-300'}`}>❌ Non</button>
            </div>
            <div className="flex justify-end gap-3"><button onClick={() => setShowQueryFinModal(false)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg text-sm">Ignorer</button><button onClick={handleSubmit} disabled={!queryFinResponse} className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm disabled:opacity-50">Terminer</button></div>
          </div>
        </div>
      )
    }
    return null
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (!activeClassId && !loadingClasses && classes.length === 0) return (
    <div className="text-center py-12"><p className="text-neutral-600">Aucune classe disponible</p><button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">← Retour</button></div>
  )
  if (activeClassId && !activeClass && !loadingClasses) return (
    <div className="text-center py-12"><p className="text-neutral-600">Classe non trouvée ou accès refusé</p><button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">← Retour</button></div>
  )
const classesFiltrees = classes.filter((cls: Class) =>
  !filterClasse || cls.nom.toLowerCase().includes(filterClasse.toLowerCase())
)
  return (
    <div style={{margin: -24, display: 'flex', height: '92vh', overflow: 'hidden', background: '#f0f2f5', fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif" }}>
      {/* ═══════════════════════════════════════════════════════════════
      PANNEAU LATÉRAL GAUCHE
      ═══════════════════════════════════════════════════════════════ */}
      <aside style={{
        width: leftPanelOpen ? (window.innerWidth < 768 ? '100%' : 310) : 0,
        minWidth: leftPanelOpen ? (window.innerWidth < 768 ? '100%' : 300) : 0,
        maxWidth: window.innerWidth < 768 ? '100%' : 360,
        background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 40%, #1e1b4b 100%)',
        borderRight: 'none', position: 'relative', overflow: 'hidden', flexShrink: 0,  transition: 'width 0.3s ease, min-width 0.3s ease',
      }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -100, right: -60, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ padding: '20px 16px 12px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{role === 'professeur' ? ' Mes cours' : role === 'admin' || role === 'direction' ? '👁️ Classes observées' : '🎓 Mes classes'}
                  {showFactureBlink && (
                    <span
                      onClick={dismissFactureBlink}
                      style={{ cursor: 'pointer', fontSize: 14, animation: 'tab-blink 1.2s ease-in-out infinite', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      title="Nouvelle facture du mois précédent disponible"
                    >
                      💰
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'block' }} />
                    </span>
                  )}
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,.45)' }}>Cliquez sur un bloc pour ouvrir</p>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{user?.prenom?.[0]?.toUpperCase() || '?'}</div>
            </div>
            {/* Boutons de filtrage par classe — commentés : toutes les classes s'affichent directement dans le panneau
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {loadingClasses ? (
                <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: '8px 0' }}><span style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,.2)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'block' }} /></div>
              ) : classes.map((cls: Class) => {
                const isSelected = selectedClassIds.has(cls.id)
                return (
                  <button key={cls.id} onClick={() => toggleClass(cls.id)} style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: isSelected ? '1.5px solid rgba(167,139,250,.8)' : '1.5px solid rgba(255,255,255,.15)',
                    background: isSelected ? 'rgba(139,92,246,.35)' : 'rgba(255,255,255,.07)',
                    color: isSelected ? '#c4b5fd' : 'rgba(255,255,255,.55)',
                    cursor: 'pointer', transition: 'all .18s ease', backdropFilter: 'blur(8px)',
                  }}>{cls.nom}</button>
                )
              })}
            </div>
            */}
          </div>

          <div style={{ padding: '0 16px 12px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
            <div style={{ padding: '0 1px 12px',}}>
              {role === 'direction' && (
                  <input
                    type="text"
                    placeholder="🔍 Filtrer par classe..."
                    value={filterClasse}
                    onChange={e => setFilterClasse(e.target.value)}
                    style={{
                      flex: 1, padding: '5px 10px', borderRadius: 20, fontSize: 11,
                      border: '1.5px solid rgba(255,255,255,.12)',
                      background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)',
                      outline: 'none',
                    }}
                  />
                )}
              </div> 
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {role !== 'direction' && (
                <button
                  onClick={() => setFilterDay(getTodayDayName())}
                  style={{
                    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    border: filterDay === getTodayDayName() ? '1.5px solid rgba(52,211,153,.7)' : '1.5px solid rgba(255,255,255,.12)',
                    background: filterDay === getTodayDayName() ? 'rgba(52,211,153,.2)' : 'rgba(255,255,255,.06)',
                    color: filterDay === getTodayDayName() ? '#6ee7b7' : 'rgba(255,255,255,.45)',
                    cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
                  }}
                >📅 Aujourd'hui</button>
              )}
              
              {role === 'direction' && (
                <select
                  value={directionProfFilter}
                  onChange={e => { setDirectionProfFilter(e.target.value); setFilterClasse('') }}
                  style={{
                    flex: 1, padding: '5px 10px', borderRadius: 20, fontSize: 11,
                    border: '1.5px solid rgba(255,255,255,.12)',
                    background: 'rgba(247, 237, 237, 0.07)', color: 'rgba(255, 251, 251, 0.7)',
                    outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="" style={{ background: '#1e1b4b', color: '#e2e8f0' }}>Tous les profs</option>
                  {directionProfList.map((p: any) => (
                    <option key={p.id} value={p.id} style={{ background: '#1e1b4b', color: '#e2e8f0' }}>
                      {p.display_name} 
                    </option>
                  ))}
                </select>
              )}
              <select
                value={filterDay === getTodayDayName() ? '' : filterDay}
                onChange={e => setFilterDay(e.target.value)}
                style={{
                  flex: 1, padding: '5px 10px', borderRadius: 20, fontSize: 11,
                  border: '1.5px solid rgba(255,255,255,.12)',
                  background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="" style={{ background: '#1e1b4b', color: '#e2e8f0' }}>Tous les jours</option>
                {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map(d => (
                  <option key={d} value={d} style={{ background: '#1e1b4b', color: '#e2e8f0' }}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px', position: 'relative', zIndex: 1 }}>
            {loadingClasses || loadingSeances ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(255,255,255,.3)', fontSize: 13 }}><span style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,.2)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /></div>
            ) : Object.keys(groupedSeances).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'rgba(255,255,255,.3)', fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🌙</div>Aucune séance{filterDay ? ` pour ${filterDay}` : ''}</div>
            
            ) : classesFiltrees.map((cls: Class) => {
                const clsId = cls.id
                const seances = (seancesParClasse[clsId] ?? []).filter(s => s.statut !== 'supprimer' && s.statut !== 'supprimer')
                const isActive = activeClassId === clsId
                console.log('DEBUG clsId', clsId)
                console.log('DEBUG unreadNotifs', unreadNotifs.map(n => ({ classe: n.classe, type: n.type })))
                const hasClassAlert = unreadNotifs.some(n => n.classe === clsId && CLASSE_BADGE_TYPES.includes(n.type))
                return (
                <div key={clsId} style={{
                  marginBottom: 10, borderRadius: 14, cursor: 'pointer',
                  background: isActive ? 'rgba(139,92,246,.15)' : 'rgba(255,255,255,.06)',
                  border: `1.5px solid ${isActive ? 'rgba(139,92,246,.5)' : 'rgba(255,255,255,.08)'}`,
                  overflow: 'hidden', transition: 'all .2s ease',
                }}>
                  <div style={{ padding: '8px 12px', background: isActive ? 'rgba(139,92,246,.25)' : 'rgba(255,255,255,.05)', borderBottom: `1px solid ${isActive ? 'rgba(139,92,246,.3)' : 'rgba(255,255,255,.05)'}`, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => selectClassBlock(clsId)}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#c4b5fd' : 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cls.nom}</span>
                        {hasClassAlert && (
                          <span style={{
                            width: 9, height: 9, borderRadius: '50%',
                            background: '#3ff460',
                            border: '1.5px solid #1e1b4b',
                            animation: 'tab-blink 1.2s ease-in-out infinite',
                            flexShrink: 0,
                          }} />
                        )}
                      {isClasseLocked(cls) && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
                          background: cls.statut === 'a_supprimer' ? 'rgba(239,68,68,.2)' : 'rgba(251,191,36,.2)',
                          color: cls.statut === 'a_supprimer' ? '#f87171' : '#fbbf24',
                          border: `1px solid ${cls.statut === 'a_supprimer' ? 'rgba(239,68,68,.4)' : 'rgba(251,191,36,.4)'}`,
                        }}>
                          {cls.statut === 'a_supprimer' ? '🗑️ Bientôt supprimée' : '⏸️ En pause'}
                        </span>
                      )}
                      {seances.length === 0 && (
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', fontStyle: 'italic', fontWeight: 400 }}>
                          aucun créneau
                        </span>
                      )}
                      {/* Bouton calendrier absences — séances autres jours */}
                      {role === 'professeur' && !isClasseLocked(cls) && (
                        <button
                          onClick={e => { e.stopPropagation(); setAbsCalModal({ classeId: clsId, classeNom: cls.nom }) }}
                          title="Voir absences à justifier (autres séances)"
                          style={{ marginLeft: 'auto', padding: '2px 7px', borderRadius: 8, border: '1px solid rgba(251,191,36,.4)', background: 'rgba(251,191,36,.12)', color: '#fbbf24', fontSize: 10, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'all .15s' }}
                        >📅 Absences</button>
                      )}
                      {/* Bouton + créneau — professeur uniquement */}
                      {role === 'professeur' && (
                        <button
                          onClick={e => { e.stopPropagation(); setAddingCreneauClasse(c => c === clsId ? null : clsId); setNewCreneauDraft({ jour: 'lundi', heure: '', heureFin: '' }) }}
                          title="Ajouter un créneau"
                          style={{ padding: '2px 7px', borderRadius: 8, border: '1px solid rgba(52,211,153,.4)', background: 'rgba(52,211,153,.12)', color: '#34d399', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'all .15s' }}
                        >＋</button>
                      )}
                    </div>
                  
                  </div>
                  {/* Formulaire ajout créneau inline */}
                  {addingCreneauClasse === clsId && (
                    <div style={{ padding: '8px 10px', background: 'rgba(52,211,153,.07)', borderBottom: '1px solid rgba(52,211,153,.15)' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select value={newCreneauDraft.jour} onChange={e => setNewCreneauDraft(d => ({ ...d, jour: e.target.value }))}
                          style={{ padding: '3px 6px', borderRadius: 6, fontSize: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', outline: 'none' }}>
                          {['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'].map(j => (
                            <option key={j} value={j} style={{ background: '#1e1b4b' }}>{j.charAt(0).toUpperCase()+j.slice(1)}</option>
                          ))}
                        </select>
                        <Time24Picker value={newCreneauDraft.heure} onChange={v => setNewCreneauDraft(d => ({ ...d, heure: v }))}
                          style={{ width: 50, padding: '3px 6px', borderRadius: 6, fontSize: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', outline: 'none' }} />
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>→</span>
                        <Time24Picker value={newCreneauDraft.heureFin} onChange={v => setNewCreneauDraft(d => ({ ...d, heureFin: v }))}
                          style={{ width: 50, padding: '3px 6px', borderRadius: 6, fontSize: 10, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff', outline: 'none' }} />
                        {newCreneauDraft.heure && newCreneauDraft.heureFin && (() => {
                          const [h1,m1]=newCreneauDraft.heure.split(':').map(Number)
                          const [h2,m2]=newCreneauDraft.heureFin.split(':').map(Number)
                          const d=(h2*60+m2)-(h1*60+m1)
                          return d>0 ? <span style={{ fontSize: 9, color: '#34d399' }}>{d}min</span> : null
                        })()}
                        <button onClick={() => handleAddCreneau(clsId)} disabled={savingCreneau}
                          style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(52,211,153,.4)', border: 'none', color: '#fff', cursor: 'pointer', opacity: savingCreneau ? .6 : 1 }}>
                          {savingCreneau ? '…' : '✓'}
                        </button>
                        <button onClick={() => setAddingCreneauClasse(null)}
                          style={{ padding: '3px 6px', borderRadius: 6, fontSize: 10, background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  )}
                    {seances.map(seance => {
                      const isEditing = editingSeanceId === seance.id
                      const heureFin = calcHeureFin(seance.heure_debut_reelle, seance.duree_reelle_minutes)
                      return (
                        <div key={seance.id} style={{ padding: '6px 8px', marginBottom: 4, borderRadius: 10, background: isActive ? 'rgba(139,92,246,.15)' : 'transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, cursor: 'pointer' }} onClick={() => selectClassBlock(clsId)}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', minWidth: 35 }}>{(seance.jour_seance || '--').slice(0, 3)}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{seance.heure_debut_reelle?.substring(0, 5) || '--:--'}</span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>→</span>
                              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', fontVariantNumeric: 'tabular-nums' }}>{heureFin}</span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>·</span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{seance.duree_reelle_minutes || '--'}min</span>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                              {/* {(role === 'professeur' || role === 'admin') && ( */}
                              {(role === 'professeur') && !isClasseLocked(cls) && (
                                <button onClick={e => { e.stopPropagation(); handleEditSeance(seance) }} title="Modifier" style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>✏️</button>
                              )}
                              {(role === 'professeur') && !isClasseLocked(cls) && (
                                <button
                                  onClick={async e => {
                                    e.stopPropagation()
                                    if (!window.confirm('Supprimer ce créneau ?')) return
                                    await api.patch(`/seances/${seance.id}/`, { statut: 'supprimer' })
                                    const res = await api.get(`/classes/${clsId}/seances/`)
                                    setSeancesParClasse(prev => ({ ...prev, [clsId]: res.data.results || [] }))
                                  }}
                                  title="Supprimer ce créneau"
                                  style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0, color: '#f87171' }}
                                >✕</button>
                              )}
                              {/* {role === 'professeur' && isActive && !isEditing && todaySeancesForActive.length > 0 && todaySeancesForActive[0].jour_seance == seance.jour_seance && (
                                <button onClick={() => setProfFormOpenId(p => p === seance.id ? null : seance.id)} title="Saisir infos" style={{ width: 22, height: 22, borderRadius: '50%', background: profFormOpenId === seance.id ? 'rgba(139,92,246,.4)' : 'rgba(255,255,255,.1)', border: `1px solid ${profFormOpenId === seance.id ? 'rgba(139,92,246,.6)' : 'rgba(255,255,255,.15)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>📝</button>
                              )} */}
                            </div>
                          </div>
                          {isEditing && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }} onClick={e => e.stopPropagation()}>
                              <Time24Picker
                                value={editHeure}
                                onChange={v => setEditHeure(v)}
                                style={{ padding: '3px 6px', borderRadius: 6, fontSize: 10, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', outline: 'none', width: 70 }}
                              />
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>→</span>
                              <Time24Picker
                                value={editHeureFin}
                                onChange={v => setEditHeureFin(v)}
                                style={{ padding: '3px 6px', borderRadius: 6, fontSize: 10, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', outline: 'none', width: 70 }}
                              />
                              {editHeure && editHeureFin && (() => {
                                const [h1, m1] = editHeure.split(':').map(Number)
                                const [h2, m2] = editHeureFin.split(':').map(Number)
                                const d = (h2 * 60 + m2) - (h1 * 60 + m1)
                                return d > 0 ? <span style={{ fontSize: 9, color: '#34d399' }}>{d}min</span> : null
                              })()}
                              <button onClick={e => { e.stopPropagation(); handleSaveEditSeance(seance.id) }} disabled={savingSeance} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(139,92,246,.6)', border: 'none', color: '#fff', cursor: 'pointer' }}>{savingSeance ? '…' : '✓'}</button>
                              <button onClick={e => { e.stopPropagation(); setEditingSeanceId(null) }} style={{ padding: '2px 6px', borderRadius: 6, fontSize: 11, background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.5)', cursor: 'pointer' }}>✕</button>
                            </div>
                          )}
                          
                          {profFormOpenId === seance.id && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                              <SeanceProfRow
                                seance={seance}
                                openForm={true}
                                dateOverride={profFormDateOverride?.seanceId === seance.id ? profFormDateOverride.date : undefined}
                                heureInit={profFormDateOverride?.seanceId === seance.id ? (seance.heure_debut_reelle?.substring(0,5) ?? '') : undefined}
                                tempsInit={profFormDateOverride?.seanceId === seance.id ? (seance.duree_reelle_minutes ?? undefined) : undefined}
                                onFactureNeeded={(sid, dateOvr) => activeClassId && autoGenerateFacture(sid, activeClassId, dateOvr)}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )
            })}
          </div>
          
      </aside>

      {/* ═══════════════════════════════════════════════════════════════
      ZONE PRINCIPALE DROITE
      ═══════════════════════════════════════════════════════════════ */}
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0,  display: (!activeClass && window.innerWidth < 768) ? 'none' : 'flex'}}>
            {!activeClass && window.innerWidth >= 768 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: 64, marginBottom: 16, opacity: .5 }}>🎓</div>
                  <p style={{ fontSize: 18, fontWeight: 600, color: '#64748b', margin: 0 }}>Sélectionnez une classe</p>
                  <p style={{ fontSize: 13, marginTop: 6, color: '#94a3b8' }}>Choisissez un bloc dans le panneau de gauche</p>
                </div>
              </div>
            ) : !activeClass ? null : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'content-fade-up .3s ease-out' }}>
              <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #1e1b4b 100%)',
                padding: '10px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative', overflow: 'visible'
              }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.025) 1px, transparent 1px)', backgroundSize: '16px 16px', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1, flex: 1, minWidth: 200 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(139,92,246,.2)', border: '2px solid rgba(139,92,246,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    <button onClick={() => setLeftPanelOpen(p => !p)}
                    title={leftPanelOpen ? 'Fermer le panneau' : 'Ouvrir le panneau'}>{leftPanelOpen ? '◀' : '🎓'}</button>
                    </div>
                  <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => setShowClassInfo(!showClassInfo)}
                      style={{ fontSize: 16, fontWeight: 700, color: '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}
                    >
                      {activeClass.nom}
                    </button>

                  

                    {/* 🆕 Popup Info Classe (style identique à Aujourd'hui) */}
                    {showClassInfo && (
                      <>
                        <div onClick={() => setShowClassInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 10px)', left: 0, zIndex: 50, minWidth: 280,
                          background: 'linear-gradient(145deg, #1e1b4b, #2d2a6e)',
                          border: '1.5px solid rgba(139,92,246,.35)',
                          borderRadius: 14,
                          boxShadow: '0 8px 32px rgba(0,0,0,.45), 0 0 0 1px rgba(52,211,153,.1)',
                          overflow: 'hidden',
                          animation: 'todayPopupIn .18s cubic-bezier(.34,1.56,.64,1)',
                        }}>
                          {/* Flèche */}
                          <div style={{ position: 'absolute', top: -6, left: 18, width: 12, height: 12, background: '#1e1b4b', border: '1.5px solid rgba(52,211,153,.35)', borderBottom: 'none', borderRight: 'none', transform: 'rotate(45deg)', zIndex: 1 }} />
                          <div style={{ padding: '12px 14px 6px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '.6px' }}>Détails de la classe</span>
                          </div>
                          <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div><span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>Programme</span><div style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{activeClass.programme || '—'}</div></div>
                            <div><span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>Niveau</span><div style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{activeClass.niveau || '—'}</div></div>
                            <div><span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>Taux horaire</span><div style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{activeClass.taux_horaire ? `${activeClass.taux_horaire} €` : '—'}</div></div>
                            <div><span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>Statut</span><div style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>{activeClass.statut || '—'}</div></div>
                          </div>

                          {/* Édition inline */}
                          {editingClass === activeClassId && (role === 'admin' || role === 'professeur') && (
                            <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="text" placeholder="Nom" value={editClassDraft.nom || activeClass.nom} onChange={e => setEditClassDraft(p => ({ ...p, nom: e.target.value }))} style={{ flex: 1, padding: '4px 8px', borderRadius: 6, fontSize: 11, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.1)', color: '#fff' }} />
                              <button onClick={() => handleEditClass(activeClassId)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, background: '#312e81', color: '#fff', border: 'none' }}>💾</button>
                              <button onClick={(e) => { e.stopPropagation(); setEditingClass(null); }} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, background: 'rgba(255,255,255,.1)', color: '#fff', border: 'none' }}>✕</button>
                            </div>
                          )}

                          {/* 🆕 Élèves inscrits (petits badges/icônes) */}
                          <div style={{ padding: '8px 14px 10px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', display: 'block', marginBottom: 4 }}>Élèves inscrits ({inscritCount})</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {headerInscriptions?.results?.slice(0, 4).map((insc: any) => (
                                <span key={insc.id} style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(255,255,255,.08)', borderRadius: 8, color: '#c4b5fd' }}>👤 {insc.eleve_nom}</span>
                              ))}
                              {inscritCount > 4 && <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(255,255,255,.08)', borderRadius: 8, color: 'rgba(255,255,255,.6)' }}>+{inscritCount - 4} autres</span>}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {role === 'admin' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(251,191,36,.15)', border: '1.5px solid rgba(251,191,36,.4)', color: '#fbbf24' }}>
                        👁️ Mode observation
                      </span>
                    )}
                {/* 📅 Aujourd'hui — texte simple si 1 séance, popup si plusieurs */}
                {todaySeancesForActive.length === 1 && (() => {
                  const s = todaySeancesForActive[0]
                  const fin = calcHeureFin(s.heure_debut_reelle, s.duree_reelle_minutes)
                  const jourStr = s.jour_seance ? s.jour_seance.charAt(0).toUpperCase() + s.jour_seance.slice(1) : 'Aujourd\'hui'
                  return (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: 'rgba(52,211,153,.12)', border: '1.5px solid rgba(52,211,153,.35)',
                      color: '#6ee7b7', letterSpacing: '.2px',
                    }}>
                      📅 {jourStr} {s.heure_debut_reelle?.substring(0,5) || '--:--'} – {fin}
                    </span>
                  )
                })()}
                {todaySeancesForActive.length > 1 && (
                  <div ref={todayPopupRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowTodayPopup(p => !p)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: showTodayPopup ? 'rgba(52,211,153,.25)' : 'rgba(52,211,153,.12)',
                        border: `1.5px solid ${showTodayPopup ? 'rgba(52,211,153,.7)' : 'rgba(52,211,153,.35)'}`,
                        color: '#6ee7b7', cursor: 'pointer', transition: 'all .15s', letterSpacing: '.2px',
                      }}
                    >
                      📅 Créneaux du jour
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'rgba(52,211,153,.3)', fontSize: 10, fontWeight: 800,
                        color: '#34d399',
                      }}>{todaySeancesForActive.length}</span>
                    </button>
                    {showTodayPopup && (
                      <>
                        <div onClick={() => setShowTodayPopup(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 10px)', left: 0, zIndex: 50, minWidth: 220,
                          background: 'linear-gradient(145deg, #1e1b4b, #2d2a6e)', border: '1.5px solid rgba(52,211,153,.35)',
                          borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.45), 0 0 0 1px rgba(52,211,153,.1)',
                          overflow: 'hidden', animation: 'todayPopupIn .18s cubic-bezier(.34,1.56,.64,1)',
                        }}>
                          <div style={{ position: 'absolute', top: -6, left: 18, width: 12, height: 12, background: '#1e1b4b', border: '1.5px solid rgba(52,211,153,.35)', borderBottom: 'none', borderRight: 'none', transform: 'rotate(45deg)', zIndex: 1 }} />
                          <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '.6px' }}>Créneaux du jour</span>
                          </div>
                          {todaySeancesForActive.map((s, i) => {
                            const fin = calcHeureFin(s.heure_debut_reelle, s.duree_reelle_minutes)
                            const statusColor = s.statut === 'en_cours' ? '#34d399' : s.statut === 'terminee' ? '#94a3b8' : '#818cf8'
                            return (
                              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: i < todaySeancesForActive.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{s.heure_debut_reelle?.substring(0, 5) || '--:--'}</span>
                                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>→</span>
                                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', fontVariantNumeric: 'tabular-nums' }}>{fin}</span>
                                </div>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', background: 'rgba(255,255,255,.06)', padding: '2px 7px', borderRadius: 10 }}>⏱ {s.duree_reelle_minutes || '--'} min</span>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                    
                  </div>
                  
                </div>

                <div style={{ display: 'flex', gap: 4, position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
                  {availableTabs.map(tab => {
                    const isSalle = tab.id === 'salle'
                    const isActive = activeTab === tab.id
                    // Style spécifique pour le bouton Salle : fond blanc
                    const salleStyle = isSalle ? {
                      border: isActive ? '1.5px solid #1a73e8' : '1.5px solid #ffffff',
                      background: isActive ? '#d6dce9' : 'rgba(205, 208, 222, 0.95)',
                      color: isActive ? '#1a73e8' : '#1e293b',
                      boxShadow: '0 2px 8px rgba(255,255,255,.25)',
                    } : {
                      border: isActive ? '1.5px solid rgba(139,92,246,.6)' : '1.5px solid rgba(255,255,255,.1)',
                      background: isActive ? 'rgba(139,92,246,.3)' : 'rgba(255,255,255,.07)',
                      color: isActive ? '#c4b5fd' : 'rgba(255,255,255,.5)',
                    }
                    return (
                      <button key={tab.id} onClick={() => {setActiveTab(tab.id as any)
                        if (tab.id === 'infos' && showFactureBlink) dismissFactureBlink()
                        if (tab.id === 'chat') {
                          unreadNotifs
                            .filter((n: any) => n.classe === activeClassId && CHAT_BADGE_TYPES.includes(n.type))
                            .forEach((n: any) => markRead(n.id))
                        }
                      }} style={{
                        padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4, position: 'relative',
                        ...salleStyle,
                      }}>
                        <span style={{
                          animation: (tab as any).hasAlert ? 'tab-blink 1.2s ease-in-out infinite' : 'none'
                        }}>
                          {tab.icon}
                        </span>
                        {(tab as any).hasAlert && (
                          <span style={{
                            width: 9, height: 9, borderRadius: '50%',
                            background: '#3ff460',
                            border: `1.5px solid ${isSalle ? '#fff' : '#1e1b4b'}`,
                            position: 'absolute', top: 3, right: 3
                          }} />
                        )}
                        <span style={{ display: 'none' }} className="sm-show">{tab.label}</span>
                        {tab.id === 'salle' && liveKitSession && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', position: 'absolute', top: 4, right: 4 }} />
                        )}
                      </button>
                    )
                  })}

                  {/* 🆕 Bouton Panneau Classes (admin/prof/direction) */}
                  {(role === 'admin' || role === 'professeur' || role === 'direction') && (
                    <button onClick={() => {
                      setClassPanelOpen(true)
                      unreadNotifs
                        .filter(n => (CLASSES_PANEL_ALERT_TYPES[role] || []).includes(n.type))
                        .forEach(n => markRead(n.id))
                    }} style={{
                      padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: '1.5px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.07)',
                      color: 'rgba(255,255,255,.5)', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4,
                      position: 'relative'
                    }}>
                      📚
                      {unreadNotifs.some(n => (CLASSES_PANEL_ALERT_TYPES[role] || []).includes(n.type)) && (
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#3ff460', border: '1.5px solid #1e1b4b', position: 'absolute', top: 2, right: 2 }} />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
                {activeTab === 'salle' && (
                  <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}>
                    {liveKitSession && activeClass ? (
                      <VideoRoom classe={activeClass} seance={{ id: liveKitSession.seanceId }} role={role === 'admin' || role === 'direction' ? 'eleve' : role} onLeave={(audioUrl?: string) => handleLeaveSession(audioUrl)} roomName={liveKitSession.roomName} token={liveKitSession.token} serverUrl={liveKitSession.serverUrl} isModerator={(role === 'admin' || role === 'direction') ? false : liveKitSession.isModerator} userId={user?.id} userName={user?.display_name || user?.prenom} />
                    ) : (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #0f1117 0%, #1a1d27 55%, #111827 100%)', position: 'relative', overflow: 'hidden', padding: '2rem' }}>
                        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
                          <div style={{ position: 'relative' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: todaySeancesForActive.length > 0 ? 'linear-gradient(135deg, #1a73e8, #0d47a1)' : 'linear-gradient(135deg, #4b5563, #374151)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', boxShadow: todaySeancesForActive.length > 0 ? '0 8px 32px rgba(26,115,232,.4)' : 'none', position: 'relative', zIndex: 1 }}>🎥</div>
                          </div>
                          <div>
                            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#fff' }}>{activeClass.nom}</h2>
                            <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'rgba(255,255,255,.5)' }}>{todaySeancesForActive.length > 0 ? 'Séance(s) du jour prête(s)' : 'Aucune séance prévue aujourd\'hui'}</p>
                          </div>
                          <button onClick={() => handleJoinSalle()} disabled={joiningSalle || todaySeancesForActive.length === 0} className="salle-join-btn">
                            {joiningSalle ? <><span className="spinner" />Connexion…</> : <><span style={{ fontSize: '18px' }}>🚀</span>{role === 'admin' || role === 'direction' ? 'Rejoindre (observation)' : 'Démarrer la session vidéo'}</>}
                          </button>
                          {todaySeancesForActive.length === 0 && <p style={{ margin: 0, fontSize: '13px', color: '#f87171', fontWeight: 500 }}>⛔ Aucun créneau n'est planifié aujourd'hui pour cette classe.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'annonces' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#f0f2f5' }}>
                    <div style={{ padding: '8px 0', marginBottom: 4 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>📢 Annonces</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#667781' }}>{annoncesActives.length} annonce{annoncesActives.length > 1 ? 's' : ''}</p>
                    </div>
                    {annoncesActives.map((annonce: any) => (
                      <AnnonceEleveCard key={annonce.id} annonce={annonce} />
                    ))}
                  </div>
                )}

                {activeTab === 'chat' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#efeae2' }}>
                    {/* <div style={{ padding: '10px 16px', background: '#f0f2f5', borderBottom: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #312e81, #1e1b4b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💬</div>
                      <div><p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111' }}>Chat de classe</p><p style={{ margin: 0, fontSize: 11, color: '#667781' }}>{activeClass.nom}</p></div>
                    </div> */}

                    {canDeleteMessages && selectedMsgIds.size > 0 && (
                      <div style={{ padding: '8px 16px', background: '#111b21', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: '#fff', fontSize: 13 }}>{selectedMsgIds.size} sélectionné(s)</span>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => setSelectedMsgIds(new Set())} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                          <button onClick={handleDeleteSelectedMessages} style={{ background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, padding: '6px 12px', borderRadius: 6, fontWeight: 600 }}>🗑️ Supprimer</button>
                        </div>
                      </div>
                    )}

                    <div 
                      ref={chatScrollRef}
                      onScroll={handleChatScroll}
                      style={{ 
                      flex: 1, 
                      overflowY: 'auto', 
                      padding: '20px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px',
                      background: '#f0f2f5',
                      // ... reste du style (garde le backgroundImage etc.)
                    }}>
                      {messages.length === 0 ? (<div style={{ textAlign: 'center', margin: 'auto', color: '#94a3b8' }}><div style={{ fontSize: 40, marginBottom: 8 }}>💬</div><p style={{ fontSize: 13 }}>Soyez le premier à écrire !</p></div>)
                        : (<>
                            {isClasseLocked(activeClass) && (
                              <div style={{
                                alignSelf: 'flex-start', maxWidth: '85%',
                                background: '#fff', border: '1px solid #fde68a',
                                borderLeft: '4px solid #f59e0b',
                                borderRadius: '0 18px 18px 18px',
                                padding: '12px 16px', fontSize: 13, color: '#451a03',
                                lineHeight: 1.7, whiteSpace: 'pre-wrap',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                              }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                  📢 Message de l'administration
                                </div>
                                {getDepartMessage(activeClass?.statut)}
                              </div>
                            )} {messages.map((msg, idx) => {
                              const prevMsg = messages[idx - 1]
                              const showDateSeparator = !prevMsg || new Date(prevMsg.created_at).toDateString() !== new Date(msg.created_at).toDateString()
                              const isMe = msg.expediteur === user?.id;
                              const warning = getExpirationWarning(msg);
                              const fileUrl = getFullUrl(msg.fichier_url);
                              // 🆕 Utilise en priorité reply_to_preview (envoyé par le backend), sinon fallback sur l'ancien comportement
                              const repliedMsg = msg.reply_to_preview || (typeof msg.reply_to === 'object' ? msg.reply_to : messages.find(m => m.id === msg.reply_to) || null);
                            
                              return (
                                <Fragment key={msg.id}>
                                  {showDateSeparator && (
                                    <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
                                      <span style={{
                                        background: '#e1f3fb', color: '#54656f', fontSize: 12, fontWeight: 600,
                                        padding: '5px 12px', borderRadius: 8, boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                                        textTransform: 'capitalize',
                                      }}>
                                        {formatDateSeparator(msg.created_at)}
                                      </span>
                                    </div>
                                  )}
                                  <div
                                    key={msg.id}
                                    id={`msg-${msg.id}`}
                                    onMouseDown={() => handlePressStart(msg.id)}
                                    onMouseUp={handlePressEnd}
                                    onMouseLeave={handlePressEnd}
                                    onTouchStart={() => handlePressStart(msg.id)}
                                    onTouchEnd={handlePressEnd}
                                    onClick={() => handleMessageClick(msg.id)}
                                    style={{
                                      display: 'flex',
                                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                                      animation: 'content-fade-up 0.3s ease-out',
                                      cursor: canDeleteMessages ? 'pointer' : 'default',
                                      userSelect: 'none',
                                    }}
                                  >

                                  <div style={{ 
                                    maxWidth: '75%', 
                                    borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                                    background: selectedMsgIds.has(msg.id)
                                      ? 'rgba(99,102,241,0.25)'
                                      : (isMe ? 'linear-gradient(135deg, #dcf8c6 0%, #c8e6c9 100%)' : '#ffffff'), 
                                    boxShadow: selectedMsgIds.has(msg.id) ? '0 0 0 2px #6366f1 inset' : '0 2px 8px rgba(0,0,0,0.06)',
                                    overflow: 'hidden',
                                    border: isMe ? '1px solid #b2dfdb' : '1px solid #e0e0e0',
                                    transition: 'background 0.15s, box-shadow 0.15s',
                                  }}>
                                    {/* En-tête du message (Nom) */}
                                    {!isMe && (
                                      <div style={{ padding: '10px 14px 4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#5c3317' }}>
                                          {msg.expediteur_nom}
                                        </span>
                                      </div>
                                    )}

                                    {/* 🆕 BLOC CITATION (Style WhatsApp) */}
                                    {repliedMsg && (
                                      <div
                                        onClick={() => {
                                          const el = document.getElementById(`msg-${repliedMsg.id}`)
                                          if (!el) return
                                          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                          el.style.transition = 'background 0.3s'
                                          el.style.background = 'rgba(139,92,246,0.25)'
                                          setTimeout(() => { el.style.background = 'transparent' }, 1200)
                                        }}
                                        style={{ 
                                          background: isMe ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.04)', 
                                          borderLeft: `3px solid ${isMe ? '#2e7d32' : '#25d366'}`, 
                                          borderRadius: 6, 
                                          padding: '6px 10px', 
                                          margin: '8px 10px 4px',
                                          fontSize: 12,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          overflow: 'hidden',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {repliedMsg.type_message === 'image' && repliedMsg.fichier_url && (
                                          <img
                                            src={getFullUrl(repliedMsg.fichier_url) ?? ''}
                                            alt=""
                                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                          />
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontWeight: 700, color: isMe ? '#2e7d32' : '#25d366', marginBottom: 2 }}>
                                            {repliedMsg.expediteur_nom === user?.display_name ? 'Vous' : (repliedMsg.expediteur_nom || 'Utilisateur')}
                                          </div>
                                          <div style={{ color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {repliedMsg.type_message === 'video' ? '🎬 Vidéo' :
                                            repliedMsg.type_message === 'audio' ? '🎤 Note vocale' :
                                            repliedMsg.type_message === 'fichier' ? '📄 Document' :
                                            repliedMsg.type_message === 'image' ? '📷 Photo' :
                                            (repliedMsg.contenu)}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Contenu Texte */}
                                    {msg.contenu && (
                                      <div style={{ padding: '0 14px 8px', fontSize: '14px', color: '#111', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                        {msg.contenu}
                                      </div>
                                    )}

                                    {/* 🖼️ IMAGE */}
                                    {msg.type_message === 'image' && fileUrl && (
                                      <div style={{ position: 'relative', background: '#f0f0f0', cursor: 'pointer' }}>
                                        <img 
                                          src={getFullUrl(msg.fichier_url)} 
                                          alt="Aperçu" 
                                          style={{ width: '100%', maxWidth: '320px', display: 'block', objectFit: 'cover', cursor: 'zoom-in' }} 
                                          onClick={() => setPreviewMedia({ url: getFullUrl(msg.fichier_url)!, type: 'image', name: msg.nom_fichier })}
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                        {warning && (
                                          <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(220, 38, 38, 0.9)', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', fontWeight: 600, backdropFilter: 'blur(4px)' }}>
                                            {warning}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* 🎬 VIDÉO */}
                                    {msg.type_message === 'video' && fileUrl && (
                                      <div style={{ position: 'relative', background: '#000', overflow: 'hidden' }}>
                                        <video 
                                          controls 
                                          src={getFullUrl(msg.fichier_url)} 
                                          style={{ width: '100%', maxWidth: '320px', display: 'block', maxHeight: '300px', cursor: 'pointer' }} 
                                          onClick={() => setPreviewMedia({ url: getFullUrl(msg.fichier_url)!, type: 'video', name: msg.nom_fichier })}
                                        />
                                        {warning && (
                                          <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(220, 38, 38, 0.9)', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', fontWeight: 600, backdropFilter: 'blur(4px)' }}>
                                            {warning}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* 🎵 AUDIO / VOCAL */}
                                    {msg.type_message === 'audio' && fileUrl && (
                                      <div style={{ padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: isMe ? 'rgba(255,255,255,0.6)' : '#f5f5f5', padding: '8px 12px', borderRadius: '24px' }}>
                                          <span style={{ fontSize: '20px' }}>{msg.is_voice_note ? '🎤' : '🎵'}</span>
                                          <audio 
                                            controls 
                                            src={fileUrl} 
                                            style={{ height: '32px', maxWidth: '200px', outline: 'none' }} 
                                            onError={(e) => console.error("Erreur chargement audio", e)}
                                          />
                                        </div>
                                        {msg.is_voice_note && <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>Note vocale</span>}
                                        {warning && (
                                          <span style={{ fontSize: '10px', color: '#dc2626', background: '#fef2f2', padding: '4px 8px', borderRadius: '8px', border: '1px solid #fecaca', alignSelf: 'flex-start' }}>
                                            ⚠️ {warning}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* 📄 DOCUMENT */}
                                    {msg.type_message === 'fichier' && fileUrl && (
                                      <a 
                                        href={fileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          gap: '12px', 
                                          margin: '8px 14px 12px', 
                                          padding: '12px', 
                                          background: isMe ? 'rgba(255,255,255,0.6)' : '#f8f9fa', 
                                          borderRadius: '12px', 
                                          textDecoration: 'none', 
                                          color: '#1e1b4b', 
                                          border: '1px solid rgba(0,0,0,0.05)',
                                          transition: 'transform 0.2s, background 0.2s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.background = isMe ? 'rgba(255,255,255,0.9)' : '#e9ecef'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = isMe ? 'rgba(255,255,255,0.6)' : '#f8f9fa'; }}
                                      >
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isMe ? 'rgba(255,255,255,0.8)' : '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📄</div>
                                        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                                          <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {msg.nom_fichier || 'Document'}
                                          </div>
                                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Cliquez pour télécharger</div>
                                        </div>
                                        <div style={{ fontSize: '18px', color: '#4f46e5', flexShrink: 0 }}>⬇️</div>
                                        {warning && (
                                          <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#dc2626', color: 'white', fontSize: '9px', padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>
                                            {warning}
                                          </span>
                                        )}
                                      </a>
                                    )}

                                    {/* Pied du message (Heure + Check) */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                      <span style={{ fontSize: 10, color: isMe ? '#2e7d32' : '#999', fontWeight: 500 }}>
                                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                      
                                      </span>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); setReplyToMessage(msg); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: isMe ? '#2e7d32' : '#999', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', opacity: 0.7 }}
                                        title="Répondre"
                                      >
                                        ↩️
                                      </button>
                                      {isMe && <MsgTicks msg={msg} userId={user?.id ?? ''} />}
                                    </div>

                                  </div>
                                </div>
                                </Fragment>
                              );
                            })}
                            </>)
                            }
                            
                      <div ref={messagesEndRef} />
                    </div>
                    
                      <form onSubmit={handleSendMessage} style={{ padding: '10px 16px', background: '#f0f2f5', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(0,0,0,.06)', position: 'relative' }}>
                        
                        {/* 1. Inputs fichiers cachés (séparés pour contrôler le type) */}
                        <input type="file" ref={photoInputRef} accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)); setShowAttachMenu(false); }} />
                        <input type="file" ref={docInputRef} multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)); setShowAttachMenu(false); }} />


                        {/* 🆕 BANNIÈRE DE RÉPONSE (Style WhatsApp) */}
                        {replyToMessage && (
                          <div style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                            padding: '8px 12px', background: '#e9ecef', borderRadius: '12px 12px 0 0', 
                            borderLeft: '4px solid #25d366', margin: '0 4px'
                          }}>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#25d366', marginBottom: 2 }}>
                                Répondre à {replyToMessage.expediteur_nom === user?.display_name ? 'vous' : replyToMessage.expediteur_nom}
                              </div>
                              <div style={{ fontSize: 13, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {replyToMessage.type_message === 'image' ? '📷 Photo' : 
                                replyToMessage.type_message === 'video' ? '🎬 Vidéo' : 
                                replyToMessage.type_message === 'audio' ? '🎤 Vocal' : 
                                replyToMessage.type_message === 'fichier' ? '📄 Document' : replyToMessage.contenu}
                              </div>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setReplyToMessage(null)} 
                              style={{ background: 'none', border: 'none', fontSize: 18, color: '#64748b', cursor: 'pointer', padding: '4px 8px' }}
                            >
                              ✕
                            </button >
                          </div>
                        )}


                        {/* 2. Prévisualisation des fichiers sélectionnés */}
                        {/* 2. Prévisualisation des fichiers ET audio sélectionnés */}
                        {(selectedFiles.length > 0 || audioBlob) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                            {selectedFiles.map((file, index) => (
                              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f1f5f9', borderRadius: 8, fontSize: 12 }}>
                                <span>{file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('video/') ? '🎬' : file.type.startsWith('audio/') ? '🎵' : '📄'}</span>
                                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                              </div>
                            ))}
                            
                            {/* 🆕 Affichage de l'audio enregistré */}
                            {audioBlob && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#dcfce7', borderRadius: 8, fontSize: 12 }}>
                                <span>🎤</span>
                                <span>Vocal prêt à l'envoi</span>
                                <button type="button" onClick={() => setAudioBlob(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. Menu Pop-up d'Attachment (Style WhatsApp) */}
                        {showAttachMenu && (
                          <>
                            {/* Overlay pour fermer le menu en cliquant à côté */}
                            <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} onClick={() => setShowAttachMenu(false)} />
                            
                            {/* Le Menu lui-même */}
                            <div style={{ position: 'absolute', bottom: '70px', left: '16px', background: '#fff', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 20, animation: 'content-fade-up .2s ease-out', minWidth: '200px' }}>
                              <button type="button" onClick={() => photoInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#111', textAlign: 'left', transition: 'background .15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <span style={{ background: '#e0f2fe', padding: '10px', borderRadius: '50%', fontSize: '18px' }}>📷</span> 
                                <div><div style={{fontWeight: 600}}>Photo & Vidéo</div><div style={{fontSize: 11, color: '#6b7280'}}>Depuis la galerie ou la caméra</div></div>
                              </button>
                              
                              <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }} />
                              
                              <button type="button" onClick={() => docInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#111', textAlign: 'left', transition: 'background .15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <span style={{ background: '#f3e8ff', padding: '10px', borderRadius: '50%', fontSize: '18px' }}>📄</span> 
                                <div><div style={{fontWeight: 600}}>Document</div><div style={{fontSize: 11, color: '#6b7280'}}>PDF, Word, Excel, ZIP, etc.</div></div>
                              </button>
                            </div>
                          </>
                        )}

                        {/* 4. Barre de saisie principale */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {/* Bouton 📎 qui ouvre le menu */}
                          <button
                            type="button"
                            onClick={() => setShowAttachMenu(!showAttachMenu)}
                            className={`chat-icon-btn chat-attach-btn${showAttachMenu ? ' chat-attach-active' : ''}`}
                            title="Joindre un fichier"
                            style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: showAttachMenu ? '#e2e8f0' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: showAttachMenu ? '#3b82f6' : '#546572'
                            }}
                            >
                            <ChatAttachIcon />
                          </button>

                          {/* Input Texte */}
                          <input type="text" value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Écrire un message…" style={{ flex: 1, padding: '10px 16px', borderRadius: 24, border: 'none', background: '#fff', fontSize: 15, outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }} />
                          
                          {/* Bouton Micro (Vocal) */}
                          <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`chat-icon-btn${isRecording ? ' chat-mic-recording' : ''}`}
                            title={isRecording ? "Arrêter l'enregistrement" : "Enregistrer une note vocale"}
                            style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: isRecording ? '#ef4444' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: isRecording ? '#fff' : '#546572'
                            }}
                            >
                            {isRecording ? <ChatStopIcon /> : <ChatMicIcon />}
                          </button>
                          
                          {/* Bouton Envoyer */}
                          <button type="submit" disabled={!messageText.trim() && selectedFiles.length === 0 && !audioBlob} style={{ width: 40, height: 40, borderRadius: '50%', background: (messageText.trim() || selectedFiles.length > 0 || audioBlob) ? '#25d366' : '#e2e8f0', border: 'none', cursor: (messageText.trim() || selectedFiles.length > 0 || audioBlob) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, color: (messageText.trim() || selectedFiles.length > 0 || audioBlob) ? '#fff' : '#9ca3af', transition: 'all .15s' }}>
                            ➤
                          </button>
                        </div>
                      </form>
                    
                  </div>
                )}

                {activeTab === 'tableau' && activeClassId && defaultSeanceId && (
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><CollaborativeWhiteboard classeId={activeClassId} seanceId={defaultSeanceId} role={role === 'admin' || role === 'direction' ? 'eleve' : role} /></div>
                )}

                {activeTab === 'supports' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e1b4b' }}>📋 Devoirs de la classe</h3>
                      {role === 'professeur' && !newDevoir && (<button onClick={() => setNewDevoir({ titre: '', files: [] })} style={{ padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: '#312e81', color: '#fff', border: 'none', cursor: 'pointer' }}>+ Ajouter un devoir</button>)}
                    </div>
                    {loadingDevoirs ? (<div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><span style={{ width: 24, height: 24, border: '2px solid #e2e8f0', borderTopColor: '#312e81', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'block' }} /></div>)
                      : (<>
                        {role === 'professeur' && newDevoir && (
                          <div style={{ background: '#ede9fe', border: '2px solid #a78bfa', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              <input type="text" placeholder="Titre du devoir *" value={newDevoir.titre} onChange={e => setNewDevoir({ ...newDevoir, titre: e.target.value })} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #c4b5fd', fontSize: 14, outline: 'none' }} autoFocus />
                              <label style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #c4b5fd', fontSize: 13, cursor: 'pointer', background: '#fff', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>📎 Fichiers<input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setNewDevoir({ ...newDevoir, files: Array.from(e.target.files) }) }} style={{ display: 'none' }} /></label>
                            </div>
                            {newDevoir.files.length > 0 && <p style={{ fontSize: 12, color: '#7c3aed', marginTop: 6 }}>{newDevoir.files.length} fichier(s) : {newDevoir.files.map(f => f.name).join(', ')}</p>}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                              <button onClick={() => setNewDevoir(null)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #c4b5fd', background: 'transparent', color: '#7c3aed', fontSize: 13, cursor: 'pointer' }}>Annuler</button>
                              <button onClick={handleAddDevoir} disabled={!newDevoir.titre.trim()} style={{ padding: '6px 14px', borderRadius: 8, background: '#312e81', color: '#fff', fontSize: 13, border: 'none', cursor: 'pointer', opacity: newDevoir.titre.trim() ? 1 : .5 }}>✅ Enregistrer</button>
                            </div>
                          </div>
                        )}
                        {devoirs.length === 0 && !newDevoir ? (<p style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0', fontStyle: 'italic' }}>{role === 'professeur' ? 'Aucun devoir. Cliquez sur "+ Ajouter" pour commencer.' : 'Aucun devoir disponible.'}</p>)
                          : (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {devoirs.map(devoir => {
                              const isCloture = devoir.statut === 'cloturer'
                              const isSubmitted = devoir.statut === 'soumis'
                              const teacherFiles = (devoir.fichiers || []).filter((f: any) => !f.eleve)
                              const studentFiles = (devoir.fichiers || []).filter((f: any) => f.eleve === user?.id)
                              const isTimerActive = timerDevoirId === devoir.id
                              return (
                                <div key={devoir.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: isCloture ? '#f8fafc' : '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1e1b4b' }}>{devoir.titre || 'Sans titre'}</h4>
                                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: isCloture ? '#f1f5f9' : isSubmitted ? '#dcfce7' : '#ede9fe', color: isCloture ? '#64748b' : isSubmitted ? '#166534' : '#4c1d95', fontWeight: 600 }}>{devoir.statut}</span>
                                      {devoir.submitted_at && <span style={{ fontSize: 11, color: '#94a3b8' }}>Soumis le {new Date(devoir.submitted_at).toLocaleDateString('fr-FR')}</span>}
                                    </div>
                                    {role === 'professeur' && !isCloture && (
                                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {!isTimerActive ? <button onClick={() => setShowTimerModal(true)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer' }}>⏱️ Chrono</button> : <span style={{ padding: '4px 10px', fontSize: 12, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, fontFamily: 'monospace' }}>{Math.floor(timerRemaining / 60)}:{String(timerRemaining % 60).padStart(2, '0')}</span>}
                                        {!isSubmitted && <button onClick={() => handleSubmitDevoir(devoir.id)} style={{ padding: '4px 10px', fontSize: 12, background: '#dcfce7', color: '#166534', border: 'none', borderRadius: 8, cursor: 'pointer' }}>✅ Soumettre</button>}
                                        <button onClick={() => handleCloturerDevoir(devoir.id)} style={{ padding: '4px 10px', fontSize: 12, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer' }}>🔒 Clôturer</button>
                                      </div>
                                    )}
                                  </div>
                                  {teacherFiles.length > 0 && (<div style={{ marginBottom: 10 }}><p style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>📎 Fichiers du devoir :</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{teacherFiles.map((file: any) => <button key={file.id} onClick={() => handleDownloadFile(file)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer' }}>📄 {file.nom_original}</button>)}</div></div>)}
                                  {role === 'eleve' && isSubmitted && !isCloture && (<div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}><p style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>📤 Votre copie :</p>{studentFiles.length > 0 && <p style={{ fontSize: 12, color: '#166834', marginBottom: 6 }}>✅ {studentFiles.map((f: any) => f.nom_original).join(', ')}</p>}<label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, cursor: 'pointer' }}>{uploadingStudentFiles[devoir.id] ? 'Envoi…' : '📁 Uploader ma copie'}<input type="file" multiple style={{ display: 'none' }} disabled={uploadingStudentFiles[devoir.id] || isCloture} onChange={e => e.target.files && handleStudentUpload(devoir.id, e.target.files)} /></label></div>)}
                                  {isCloture && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>🔒 Devoir clôturé.</p>}
                                </div>
                              )
                            })}
                          </div>)}
                      </>)}
                    {showTimerModal && (
                      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
                        <div style={{ background: '#fff', borderRadius: 20, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
                          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#1e1b4b' }}>⏱️ Temps limite</h3>
                          <label style={{ display: 'block', fontSize: 13, color: '#64748b', marginBottom: 8 }}>Durée en minutes :</label>
                          <input type="number" min="1" max="180" value={timerMinutes || ''} onChange={e => setTimerMinutes(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', marginBottom: 16 }} placeholder="Ex: 30" autoFocus />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={() => { setShowTimerModal(false); setTimerMinutes(0) }} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 13, cursor: 'pointer', color: '#64748b' }}>Annuler</button>
                            <button onClick={() => { if (timerMinutes > 0 && devoirs.length > 0) handleStartTimer(devoirs[0].id, timerMinutes) }} disabled={!timerMinutes} style={{ padding: '8px 16px', borderRadius: 10, background: '#312e81', color: '#fff', fontSize: 13, border: 'none', cursor: 'pointer', opacity: timerMinutes ? 1 : .5 }}>Démarrer</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'facture' && role === 'eleve' && (<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 15 }}>💰 Section Facture (à développer)</div>)}

                {activeTab === 'infos' && activeClass && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f8fafc' }}>
                    <div style={{ maxWidth: 700 }}>
                     
                      {/* ── Section Factures selon le rôle ── */}
                      {role === 'eleve' && activeClassId && (
                        <EleveFacturesInline classeId={activeClassId} />
                      )}

                      {(role === 'professeur' || role === 'admin' || role === 'direction') && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: 8 }}>
                              🧾 Factures émises — {activeClass.nom}
                              {factureAutoGenerating && (
                                <span style={{ fontSize: 11, color: '#7c3aed', background: '#ede9fe', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ width: 8, height: 8, border: '1.5px solid #a78bfa', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'block' }} />
                                  Génération…
                                </span>
                              )}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="month"
                                  value={factureFilterMonth}
                                  disabled={factureFilterAll}
                                  onChange={e => { setFactureFilterMonth(e.target.value); setFactureFilterAll(false) }}
                                  style={{
                                    padding: '4px 8px', borderRadius: 8, border: '1px solid #e2e8f0',
                                    fontSize: 12, color: factureFilterAll ? '#94a3b8' : '#1e1b4b',
                                    background: factureFilterAll ? '#f8fafc' : '#fff', cursor: factureFilterAll ? 'not-allowed' : 'pointer'
                                  }}
                                />
                                <button
                                  onClick={() => setFactureFilterAll(p => !p)}
                                  style={{
                                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                    border: '1px solid ' + (factureFilterAll ? '#4f46e5' : '#e2e8f0'),
                                    background: factureFilterAll ? '#eef2ff' : '#f8fafc',
                                    color: factureFilterAll ? '#4f46e5' : '#64748b',
                                  }}>
                                  {factureFilterAll ? '✓ Tout' : 'Tout voir'}
                                </button>
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                                  {facturesClasseFiltered.length} facture(s)
                                </span>
                              </div>
                            </div>

                            {/* Barre de recherche — admin/direction uniquement */}
                            {(role === 'admin' || role === 'direction') && (
                              <input
                                type="text"
                                placeholder="🔍 Rechercher par élève, montant, statut…"
                                value={factureSearch}
                                onChange={e => setFactureSearch(e.target.value)}
                                style={{
                                  width: '100%', padding: '8px 12px', borderRadius: 10,
                                  border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
                                  background: '#fff', boxSizing: 'border-box',
                                  boxShadow: '0 1px 3px rgba(0,0,0,.04)'
                                }}
                              />
                            )}

                          {facturesClasseFiltered.length === 0 ? (
                            <div style={{ background: '#fff', borderRadius: 12, padding: '32px 16px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8' }}>
                              <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
                              <p style={{ margin: 0, fontSize: 14 }}>
                                {factureFilterAll
                                  ? 'Aucune facture pour cette classe.'
                                  : `Aucune facture pour ${new Date(factureFilterMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}.`
                                }
                                
                                <br /><span style={{ fontSize: 12 }}>
                                  {factureFilterAll
                                    ? 'Les factures sont générées automatiquement après chaque séance validée.'
                                    : <button onClick={() => setFactureFilterAll(true)} style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Voir toutes les factures</button>
                                  }
                                  </span>
                              </p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {facturesClasseFiltered.map((f: Facture) => (
                                <div key={f.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                                  <div
                                    style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: factureExpandedId === f.id ? '#f5f3ff' : '#fff', borderBottom: factureExpandedId === f.id ? '1px solid #ede9fe' : 'none', transition: 'background .15s' }}
                                    onClick={() => setFactureExpandedId(p => p === f.id ? null : f.id)}
                                  >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>
                                          {fmtDate(f.date_debut)}
                                          {f.date_debut !== f.date_fin && ` → ${fmtDate(f.date_fin)}`}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                          background: f.statut === 'payee' ? '#dcfce7' : f.statut === 'envoyee' ? '#fef9c3' : '#f1f5f9',
                                          color: f.statut === 'payee' ? '#166534' : f.statut === 'envoyee' ? '#854d0e' : '#475569'
                                        }}>
                                          {f.statut === 'payee' ? '✅ Payée' : f.statut === 'envoyee' ? '⏳ En attente' : '📝 Brouillon'}
                                        </span>
                                        {(f.nb_paiements_a_confirmer ?? 0) > 0 && (
                                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'block' }} />
                                            {f.nb_paiements_a_confirmer} à confirmer
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 12, color: '#64748b' }}>⏱ {f.honoraire}h</span>
                                        <span style={{ fontSize: 12, color: '#1e1b4b', fontWeight: 600 }}>Total : {fmtEuros(f.montant_total)}</span>
                                        {f.part_prof && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Votre part : {fmtEuros(f.part_prof)}</span>}
                                        {f.part_direction && parseFloat(String(f.part_direction)) > 0 && (
                                          <span style={{ fontSize: 12, color: '#ea580c' }}>Direction : {fmtEuros(f.part_direction)}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                      {f.statut === 'brouillon' && role === 'professeur' && (
                                        <button onClick={() => setFactureASoumettre(f)} disabled={factureSubmitting === f.id}
                                          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: factureSubmitting === f.id ? .6 : 1 }}>
                                          {factureSubmitting === f.id ? '⏳' : '📤 Soumettre'}
                                        </button>
                                      )}
                                      {f.statut === 'envoyee' && role === 'professeur' && (
                                        <>
                                          <button onClick={() => handleFactureReminder(f.id)}
                                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fde68a', background: '#fef9c3', color: '#854d0e', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                            🔔 Rappel
                                          </button>
                                          {/* ← NOUVEAU bouton recall */}
                                          <button
                                            onClick={() => handleFactureRecall(f.id)}
                                            disabled={factureRecalling[f.id]}
                                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: factureRecalling[f.id] ? .6 : 1 }}>
                                            {factureRecalling[f.id] ? '⏳' : '↩️ Rappeler'}
                                          </button>
                                        </>
                                      )}
                                      <button style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 11, cursor: 'pointer' }}
                                        onClick={() => setFactureExpandedId(p => p === f.id ? null : f.id)}>
                                        {factureExpandedId === f.id ? '▲' : '▼'}
                                      </button>
                                    </div>
                                  </div>
                                  {factureExpandedId === f.id && (
                                    <div style={{ padding: '16px' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                                        {[
                                          { label: 'Total élèves', val: f.montant_total, color: '#1e1b4b', bg: '#f8fafc', border: '#e2e8f0' },
                                          { label: 'Votre part', val: f.part_prof, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
                                          { label: 'Part direction', val: f.part_direction, color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
                                        ].map(({ label, val, color, bg, border }) => (
                                          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color }}>{fmtEuros(val)}</div>
                                          </div>
                                        ))}
                                      </div>
                                      {(f.nb_paiements_a_confirmer ?? 0) > 0 && role === 'professeur' && (
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                                          <button onClick={() => handleFactureConfirmAll(f.id)} disabled={factureConfirmingAll[f.id]}
                                            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: factureConfirmingAll[f.id] ? .6 : 1 }}>
                                            {factureConfirmingAll[f.id] ? '⏳ ...' : '✅ Confirmer tous les paiements'}
                                          </button>
                                        </div>
                                      )}
                                      {factureEleveDetailData && factureEleveDetailData.length > 0 ? (
                                        <div style={{ overflowX: 'auto' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                              <tr style={{ background: '#f1f5f9' }}>
                                                {['Élève', 'Montant dû', 'Payé', 'Statut', 'Action'].map(h => (
                                                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {factureEleveDetailData.map((fe: FactureElevePayeItem) => (
                                                <tr key={fe.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                  <td style={{ padding: '8px 10px', fontWeight: 500, color: '#1e1b4b' }}>{fe.eleve_nom}</td>
                                                  <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{fmtEuros(fe.montant_a_payer)}</td>
                                                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#16a34a', fontWeight: 600 }}>{fmtEuros(fe.montant_payer)}</td>
                                                  <td style={{ padding: '8px 10px' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                                                      background: fe.statut === 'confirmee' ? '#dcfce7' : fe.statut === 'payee' ? '#fff7ed' : '#f1f5f9',
                                                      color: fe.statut === 'confirmee' ? '#166534' : fe.statut === 'payee' ? '#c2410c' : '#64748b'
                                                    }}>
                                                      {fe.statut === 'confirmee' ? '✅ Confirmé' : fe.statut === 'payee' ? '⏳ À confirmer' : '📝 Émis'}
                                                    </span>
                                                  </td>
                                                  <td style={{ padding: '8px 10px' }}>
                                                    {fe.statut === 'payee' && role === 'professeur' && (
                                                      <button onClick={() => handleFactureConfirmSingle(fe.id)} disabled={factureConfirmingSingle[fe.id]}
                                                        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: factureConfirmingSingle[fe.id] ? .6 : 1 }}>
                                                        {factureConfirmingSingle[fe.id] ? '⏳' : '✓ Confirmer'}
                                                      </button>
                                                    )}
                                                    {fe.statut === 'confirmee' && <span style={{ fontSize: 12, color: '#16a34a' }}>✓</span>}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '16px 0' }}>
                                          {f.statut === 'brouillon' ? '📝 Soumettez la facture pour envoyer les demandes de paiement.' : 'Aucun paiement enregistré.'}
                                        </p>
                                      )}
                                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                          <div style={{ height: '100%', background: '#16a34a', borderRadius: 3, width: f.nb_paiements_total ? `${((f.nb_paiements_confirmes ?? 0) / f.nb_paiements_total) * 100}%` : '0%', transition: 'width .4s' }} />
                                        </div>
                                        <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                                          {f.nb_paiements_confirmes ?? 0}/{f.nb_paiements_total ?? 0} confirmés
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      
                    </div>
                  </div>
                )}
                      
              </div>
            </div>
            )}
      </main>


      {/* 🆕 LIGHTBOX / PRÉVISUALISATION MÉDIA (Style Telegram) */}
      {previewMedia && (
        <div 
          style={{ 
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 
          }}
          onClick={() => setPreviewMedia(null)} // Ferme en cliquant en dehors
        >
          {/* Bouton Fermer */}
          <button 
            onClick={() => setPreviewMedia(null)}
            style={{ 
              position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', 
              border: 'none', borderRadius: '50%', width: 44, height: 44, color: '#fff', 
              fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)'
            }}
          >
            ✕
          </button>
          
          {/* Contenu Média */}
          {previewMedia.type === 'image' ? (
            <img 
              src={previewMedia.url} 
              alt="Aperçu" 
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
              onClick={(e) => e.stopPropagation()} // Empêche la fermeture si on clique sur l'image
            />
          ) : (
            <video 
              src={previewMedia.url} 
              controls 
              autoPlay 
              style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          {/* Nom du fichier en bas (optionnel mais utile) */}
          {previewMedia.name && (
            <div style={{ 
              position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', 
              background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '8px 16px', 
              borderRadius: 20, fontSize: 13, backdropFilter: 'blur(8px)', textAlign: 'center', maxWidth: '90%'
            }}>
              {previewMedia.name}
            </div>
          )}
        </div>
      )}

      {/* 🆕 PANNEAU LATÉRAL DROIT (Admin/Prof uniquement) */}
      {classPanelOpen && (role === 'admin' || role === 'professeur' || role === 'direction') && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', zIndex: 40 }} onClick={() => setClassPanelOpen(false)} />
          <div style={{
            position: 'fixed', right: 0, top: 0, height: '100vh', width: 320, background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,.15)', zIndex: 50, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight .22s cubic-bezier(0.34,1.56,0.64,1)'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
              <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>📚 Gestion des Classes</span>
              <button onClick={() => setClassPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ display: 'flex', padding: '8px', gap: '4px', background: '#f3f4f6' }}>
              {(['active', 'pause', 'delete'] as const).map(tab => {
                const count = classesByStatut[tab].length;
                const isActive = panelTab === tab;
                return (
                  <button key={tab} onClick={() => setPanelTab(tab)} style={{
                    flex: 1, padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    background: isActive ? (tab === 'active' ? '#3b82f6' : tab === 'pause' ? '#f97316' : '#ef4444') : 'transparent',
                    color: isActive ? '#fff' : '#4b5563',
                    transition: 'all 0.2s'
                  }}>{tab === 'active' ? 'Actives' : tab === 'pause' ? 'Pause' : 'Supprimer'} ({count})</button>
                )
              })}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {displayedClasses.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>Aucune classe</div>}
              {displayedClasses.map((classe: Class) => {
                const loading = actionLoading[classe.id];
                return (
                  <div key={classe.id} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{classe.nom}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{classe.programme || ''} • {classe.niveau || ''}</div>
                      </div>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: panelTab === 'active' ? '#dbeafe' : panelTab === 'pause' ? '#ffedd5' : '#fee2e2', color: panelTab === 'active' ? '#1d4ed8' : panelTab === 'pause' ? '#c2410c' : '#b91c1c' }}>
                        {panelTab === 'active' ? 'Active' : panelTab === 'pause' ? 'En pause' : 'Signalée'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(panelTab === 'active' || panelTab === 'pause') && (
                        <button onClick={() => handleFlagDeleteClass(classe.id)} disabled={!!loading} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '11px', background: '#fee2e2', color: '#b91c1c', border: 'none', cursor: 'pointer' }}>{loading === 'delete' ? '…' : '🗑 Supprimer'}</button>
                      )}
                      {(panelTab === 'active') && (
                        <button onClick={() => handlePauseClass(classe.id)} disabled={!!loading} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '11px', background: '#ffedd5', color: '#c2410c', border: 'none', cursor: 'pointer' }}>{loading === 'pause' ? '…' : '⏸ Pause'}</button>
                      )}
                      {(panelTab === 'pause' || panelTab === 'delete') && (
                        <button onClick={() => handleReactivateClass(classe.id)} disabled={!!loading} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', border: 'none', cursor: 'pointer' }}>{loading === 'active' ? '…' : '✅ Activer'}</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Modal Saisir Infos (depuis calendrier absences) ── */}
      {saisirInfosModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 75, padding: 16, backdropFilter: 'blur(4px)' }} onClick={() => setSaisirInfosModal(null)}>
          <div style={{ background: 'linear-gradient(145deg, #1e1b4b, #2d2a6e)', borderRadius: 20, padding: 24, maxWidth: 400, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,.5)', border: '1.5px solid rgba(139,92,246,.4)', animation: 'todayPopupIn .2s cubic-bezier(.34,1.56,.64,1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.6px', fontWeight: 700 }}>Saisir infos — absence justifiée</p>
              <h3 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {saisirInfosModal.seance.jour_seance} · {saisirInfosModal.date}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#a78bfa' }}>
                {saisirInfosModal.seance.heure_debut_reelle?.substring(0,5)} · {saisirInfosModal.seance.duree_reelle_minutes}min
              </p>
            </div>
            <SeanceProfRow
              seance={saisirInfosModal.seance}
              openForm={true}
              dateOverride={saisirInfosModal.date}
              heureInit={saisirInfosModal.seance.heure_debut_reelle?.substring(0,5) ?? ''}
              tempsInit={saisirInfosModal.seance.duree_reelle_minutes ?? undefined}
              onFactureNeeded={async (sid, dateOvr) => {
                if (activeClassId) autoGenerateFacture(sid, activeClassId, dateOvr)
                if (dateOvr) {
                  try {
                    await api.post('/absences/signaler/', {
                      seance_id: sid,
                      date_absence: dateOvr,
                      statut: 'justifie',
                    })
                  } catch { }
                }
                setSaisirInfosModal(null)
              }}
              
            />
            <button onClick={() => setSaisirInfosModal(null)} style={{ marginTop: 12, width: '100%', padding: '8px', borderRadius: 10, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>Fermer</button>
          </div>
        </div>
      )}
      {absCalModal && user && (
        <AbsCalendarModal
          classeId={absCalModal.classeId}
          classeNom={absCalModal.classeNom}
          profId={user.id}
          year={absCalYear}
          month={absCalMonth}
          onPrevMonth={() => {
            if (absCalMonth === 1) { setAbsCalYear(y => y - 1); setAbsCalMonth(12) }
            else setAbsCalMonth(m => m - 1)
          }}
          onNextMonth={() => {
            if (absCalMonth === 12) { setAbsCalYear(y => y + 1); setAbsCalMonth(1) }
            else setAbsCalMonth(m => m + 1)
          }}
          onSelectAbsence={(seanceId, date) => {
            const seancesClasse = seancesParClasse[absCalModal.classeId] ?? []
            const seance = seancesClasse.find(s => s.id === seanceId)
            if (seance) {
              setActiveClassId(absCalModal.classeId)
              setSelectedClassIds(prev => { const n = new Set(prev); n.add(absCalModal.classeId); return n })
              setProfFormDateOverride({ seanceId, date })
              setSaisirInfosModal({ seance, date })
              setAbsCalModal(null)
            }
          }}
          onClose={() => setAbsCalModal(null)}
        />
      )}

      {/* ── Modal sélection séance (si > 1 séance aujourd'hui) ── */}
      {showSeanceSelectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'linear-gradient(145deg, #1e1b4b, #2d2a6e)', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,.5)', border: '1.5px solid rgba(139,92,246,.4)', animation: 'todayPopupIn .2s cubic-bezier(.34,1.56,.64,1)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>Quelle séance souhaitez-vous démarrer ?</h3>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,.5)' }}>Plusieurs séances sont planifiées aujourd'hui pour cette classe</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {todaySeancesForActive.map((s, i) => {
                const fin = calcHeureFin(s.heure_debut_reelle, s.duree_reelle_minutes)
                const isSelected = selectedSeanceForJoin?.id === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSeanceForJoin(s)}
                    style={{
                      padding: '14px 18px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                      background: isSelected ? 'rgba(139,92,246,.35)' : 'rgba(255,255,255,.07)',
                      border: `2px solid ${isSelected ? 'rgba(139,92,246,.8)' : 'rgba(255,255,255,.12)'}`,
                      transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                        {s.heure_debut_reelle?.substring(0, 5) || '--:--'} → {fin}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>
                        {s.duree_reelle_minutes || '--'} min · Séance {i + 1}
                      </div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isSelected ? '#a78bfa' : 'rgba(255,255,255,.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'rgba(139,92,246,.4)' : 'transparent', flexShrink: 0 }}>
                      {isSelected && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#a78bfa', display: 'block' }} />}
                    </div>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowSeanceSelectModal(false); setSelectedSeanceForJoin(null) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >Annuler</button>
              <button
                onClick={() => { if (selectedSeanceForJoin) handleJoinSalle(selectedSeanceForJoin) }}
                disabled={!selectedSeanceForJoin || joiningSalle}
                style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: selectedSeanceForJoin ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,.1)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: selectedSeanceForJoin ? 'pointer' : 'not-allowed', opacity: selectedSeanceForJoin ? 1 : .5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: selectedSeanceForJoin ? '0 4px 16px rgba(124,58,237,.4)' : 'none', transition: 'all .15s' }}
              >
                {joiningSalle ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'block' }} />Connexion…</> : <><span>🚀</span>Démarrer cette séance</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Indicateur auto-génération facture ── */}
      {factureAutoGenerating && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 70, background: 'rgba(30,27,75,.95)', border: '1.5px solid rgba(139,92,246,.5)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>
          <span style={{ width: 16, height: 16, border: '2px solid rgba(139,92,246,.4)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'block', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', fontWeight: 500 }}>💰 Génération facture…</span>
        </div>
      )}
      {factureASoumettre && (
        <SubmitFactureModal
          facture={factureASoumettre}
          onClose={() => setFactureASoumettre(null)}
          onSuccess={() => {
            setFactureASoumettre(null)
            refetchFactures()
          }}
        />
      )}
      {showQueryFinModal && <QueryFinModal />}
    </div>
  )
}
