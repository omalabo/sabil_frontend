// ClassDetail.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { useGetClassQuery } from '../../store/apiSlice'
import VideoRoom from '../../components/classroom/VideoRoom'
import StatusBadge from '../../components/shared/StatusBadge'
import api from '../../config/axios'
import { Class, Message } from '../../types'

interface ClasseDetailProps {
  role: 'eleve' | 'professeur'
}

interface LiveKitSession {
  presenceId: string
  seanceId: string
  roomName: string
  token: string
  serverUrl: string
  isModerator: boolean
}

interface Seance {
  id: string
  date_seance: string
  jour_seance: string | null
  heure_debut_reelle: string | null
  duree_reelle_minutes: number | null
  statut: string | null
}

// Présence manuelle (enregistrement_system=false, aujourd'hui)
interface PresenceManuelle {
  id: string
  heure_connexion_prof: string | null  // "HH:MM:SS"
  temps_prof: number | null
  created_at: string
}

// Ligne élève dans le modal
interface EleveRow {
  absence_id: string | null
  eleve_id: string
  eleve_nom: string
  temps_effectif: boolean | null
  durree_eleve: number | null
  presence_id: string
}


// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDateSeance(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function SeanceStatusBadge({ statut }: { statut: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    en_cours:  { label: '🟢 En cours',  cls: 'bg-green-100 text-green-800' },
    terminee:  { label: '✅ Terminée',  cls: 'bg-neutral-100 text-neutral-600' },
    planifiee: { label: '📅 Planifiée', cls: 'bg-blue-100 text-blue-800' },
  }
  const s = map[statut ?? ''] ?? { label: statut ?? '-', cls: 'bg-neutral-100 text-neutral-500' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}

// ─── Modal Élèves ────────────────────────────────────────────────────────────
function ElevesModal({ seance, onClose }: { seance: Seance; onClose: () => void }) {
  const [rows, setRows]     = useState<EleveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [drafts, setDrafts] = useState<Record<string, Partial<EleveRow>>>({})

  useEffect(() => {
    setLoading(true)
    api.get('/absences-eleves/', { params: { seance_id: seance.id } })
      .then(res => {
        if (res.data.has_presence) setRows(res.data.eleves || [])
      })
      .catch(err => console.error('Erreur élèves:', err))
      .finally(() => setLoading(false))
  }, [seance.id])

  const getDraft = (row: EleveRow): EleveRow => ({ ...row, ...(drafts[row.eleve_id] ?? {}) })
  const setDraft = (eleveId: string, field: keyof EleveRow, value: any) =>
    setDrafts(prev => ({ ...prev, [eleveId]: { ...(prev[eleveId] ?? {}), [field]: value } }))

  const hasDraft = (eleveId: string) =>
    !!drafts[eleveId] && Object.keys(drafts[eleveId]).length > 0

  const handleSave = async (row: EleveRow) => {
    const d = drafts[row.eleve_id]
    if (!d) return
    setSaving(prev => ({ ...prev, [row.eleve_id]: true }))
    try {
      const payload = {
        presence_id:   row.presence_id,
        eleve_id:      row.eleve_id,
        temps_effectif: d.temps_effectif ?? row.temps_effectif,
        durree_eleve:   d.durree_eleve  ?? row.durree_eleve,
      }
      const res = await api.post('/absences-eleves/', payload)
      // Mise à jour locale de la ligne
      setRows(prev => prev.map(r =>
        r.eleve_id === row.eleve_id
          ? { ...r, absence_id: res.data.id, temps_effectif: res.data.temps_effectif, durree_eleve: res.data.durree_eleve }
          : r
      ))
      setDrafts(prev => { const n = { ...prev }; delete n[row.eleve_id]; return n })
    } catch (err) {
      console.error('Erreur save élève:', err)
      alert('❌ Impossible de sauvegarder')
    } finally {
      setSaving(prev => ({ ...prev, [row.eleve_id]: false }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              👥 Élèves — {formatDateSeance(seance.date_seance)}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Présence et durée de participation
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">✕</button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <span className="w-6 h-6 border-2 border-neutral-300 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-neutral-500 py-12">Aucun élève inscrit à cette classe.</p>
          ) : (
            <div className="space-y-2">
              {/* En-tête */}
              <div className="grid grid-cols-[1fr_140px_140px_80px] gap-3 px-3 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wide border-b border-neutral-100">
                <span>Élève</span>
                <span>Cours complet ?</span>
                <span>Durée (min)</span>
                <span></span>
              </div>

              {rows.map(row => {
                const d = getDraft(row)
                const dirty = hasDraft(row.eleve_id)
                return (
                  <div key={row.eleve_id}
                    className={`grid grid-cols-[1fr_140px_140px_80px] gap-3 items-center px-3 py-3 rounded-xl border transition-all ${dirty ? 'border-primary-200 bg-primary-50' : 'border-neutral-100 hover:border-neutral-200 bg-white'}`}
                  >
                    {/* Nom */}
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{row.eleve_nom}</p>
                      {row.absence_id && (
                        <span className="text-xs text-green-600">✓ déjà enregistré</span>
                      )}
                    </div>

                    {/* temps_effectif */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setDraft(row.eleve_id, 'temps_effectif', true)
                          setDraft(row.eleve_id, 'durree_eleve', null)
                        }}
                        className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition ${d.temps_effectif === true ? 'bg-green-100 border-green-400 text-green-700' : 'border-neutral-200 text-neutral-500 hover:border-green-300'}`}
                      >✅ Oui</button>
                      <button
                        onClick={() => setDraft(row.eleve_id, 'temps_effectif', false)}
                        className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition ${d.temps_effectif === false ? 'bg-red-100 border-red-400 text-red-700' : 'border-neutral-200 text-neutral-500 hover:border-red-300'}`}
                      >❌ Non</button>
                    </div>

                    {/* durree_eleve */}
                    <div>
                      {d.temps_effectif === false ? (
                        <input
                          type="number" min="1" max="480" placeholder="minutes"
                          value={d.durree_eleve ?? ''}
                          onChange={e => setDraft(row.eleve_id, 'durree_eleve', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full px-2 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-400"
                        />
                      ) : (
                        <span className="text-xs text-neutral-400 italic">
                          {d.temps_effectif === true ? 'Cours complet' : '—'}
                        </span>
                      )}
                    </div>

                    {/* Sauvegarder */}
                    <button
                      onClick={() => handleSave(row)}
                      disabled={!dirty || saving[row.eleve_id]}
                      className={`px-2 py-1.5 text-xs rounded-lg font-medium transition ${dirty ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-neutral-100 text-neutral-400 cursor-default'} disabled:opacity-60`}
                    >
                      {saving[row.eleve_id] ? '...' : '💾'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-neutral-200 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-neutral-100 text-neutral-700 rounded-xl hover:bg-neutral-200 font-medium text-sm transition">
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SeanceProfRow : inputs + bouton Élèves pour une séance ─────────────────
function SeanceProfRow({
  seance,
  isSelected,
  onSelect,
}: {
  seance: Seance
  isSelected: boolean
  onSelect: () => void
}) {
  const [presence, setPresence]     = useState<PresenceManuelle | null>(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [heureConnexion, setHeureConnexion] = useState('')
  const [tempsProf, setTempsProf]   = useState('')
  const [showEleves, setShowEleves] = useState(false)
  // true = la présence manuelle d'aujourd'hui existe → on peut ouvrir Élèves
  const [hasPresenceToday, setHasPresenceToday] = useState(false)

  // Chargement initial
  useEffect(() => {
    setLoading(true)
    api.get('/presences-manuelle/', { params: { seance_id: seance.id } })
      .then(res => {
        const p: PresenceManuelle | null = res.data
        setPresence(p)
        setHasPresenceToday(!!p)
        if (p) {
          setHeureConnexion(p.heure_connexion_prof ? p.heure_connexion_prof.substring(0, 5) : '')
          setTempsProf(p.temps_prof !== null && p.temps_prof !== undefined ? String(p.temps_prof) : '')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [seance.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        seance_id:           seance.id,
        heure_connexion_prof: heureConnexion ? heureConnexion + ':00' : null,
        temps_prof:          tempsProf !== '' ? parseInt(tempsProf) : null,
      }

      let res
      if (presence?.id) {
        // Update
        res = await api.patch(`/presences-manuelle/${presence.id}/`, payload)
      } else {
        // Crée (ou update si déjà une aujourd'hui côté serveur)
        res = await api.post('/presences-manuelle/', payload)
      }

      setPresence(res.data)
      setHasPresenceToday(true)
    } catch (err) {
      console.error('Erreur save présence manuelle:', err)
      alert('❌ Impossible de sauvegarder')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className={`rounded-lg border transition-all ${isSelected ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-300' : 'border-neutral-200 hover:border-neutral-300 bg-white'}`}>
        {/* Ligne principale — clic pour sélectionner */}
        <button onClick={onSelect} className="w-full text-left px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-primary-500' : 'bg-neutral-200'}`} />
              <div>
                <span className="text-sm font-medium text-neutral-900">{formatDateSeance(seance.date_seance)}</span>
                {seance.heure_debut_reelle && <span className="text-xs text-neutral-500 ml-2">🕐 {seance.heure_debut_reelle}</span>}
                {seance.duree_reelle_minutes && <span className="text-xs text-neutral-400 ml-2">({seance.duree_reelle_minutes} min)</span>}
              </div>
            </div>
            <SeanceStatusBadge statut={seance.statut} />
          </div>
        </button>

        {/* Zone prof */}
        <div className="px-4 pb-3 pt-0 border-t border-neutral-100">
          {loading ? (
            <p className="text-xs text-neutral-400 py-2 flex items-center gap-1.5">
              <span className="w-3 h-3 border border-neutral-300 border-t-primary-400 rounded-full animate-spin" />
              Chargement…
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-2 pt-2">
              {/* Heure début cours */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-neutral-500">Heure début cours</label>
                <input
                  type="time"
                  value={heureConnexion}
                  onChange={e => setHeureConnexion(e.target.value)}
                  className="px-2 py-1 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-400 w-32"
                />
              </div>

              {/* Durée */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-neutral-500">Durée (min)</label>
                <input
                  type="number" min="1" max="480" placeholder="ex: 60"
                  value={tempsProf}
                  onChange={e => setTempsProf(e.target.value)}
                  className="px-2 py-1 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-primary-400 w-24"
                />
              </div>

              {/* Boutons */}
              <div className="flex gap-1.5 pb-0.5">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition flex items-center gap-1"
                >
                  {saving
                    ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Enregistrement…</>
                    : '💾 Enregistrer'}
                </button>

                <button
                  onClick={() => setShowEleves(true)}
                  disabled={!hasPresenceToday}
                  title={!hasPresenceToday ? 'Enregistrez d\'abord le cours pour accéder aux élèves' : ''}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1 ${
                    hasPresenceToday
                      ? 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                      : 'border-neutral-200 text-neutral-300 cursor-not-allowed'
                  }`}
                >
                  👥 Élèves
                </button>
              </div>

              {/* Indicateur présence existante */}
              {hasPresenceToday && (
                <span className="text-xs text-green-600 flex items-center gap-1 pb-0.5">
                  ✓ enregistré aujourd'hui
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {showEleves && (
        <ElevesModal seance={seance} onClose={() => setShowEleves(false)} />
      )}
    </>
  )
}

// ─── Tableau collaboratif (inchangé) ────────────────────────────────────────
interface WhiteboardProps { classeId: string; seanceId: string; role: 'eleve' | 'professeur' }

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
  const [textPos, setTextPos] = useState<{x:number;y:number}|null>(null)
  const [remoteCursor, setRemoteCursor] = useState<{x:number;y:number}|null>(null)
  const [wsStatus, setWsStatus] = useState<'connecting'|'connected'|'disconnected'>('connecting')
  const COLORS = [
    { label:'Noir',  value:'#1a1a2e' },{ label:'Rouge', value:'#e63946' },
    { label:'Bleu',  value:'#1d6fa4' },{ label:'Vert',  value:'#2d9e6b' },
    { label:'Orange',value:'#f4a261' },{ label:'Violet',value:'#7b2d8b' },
    { label:'Blanc', value:'#ffffff' },
  ]
  const ARABIC_CHARS = [
    'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض',
    'ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي','ة','ى',
    'لا','أ','إ','آ','ئ','ؤ',' ','،','.'
  ]
  useEffect(() => {
    const token = localStorage.getItem('sabil_token')
    if (!token) { setWsStatus('disconnected'); return }
    const wsUrl = `${window.location.protocol==='https:' ? 'wss':'ws'}://localhost:8000/ws/tableau/${classeId}/${seanceId}/?token=${token}`
    const connect = () => {
      const ws = new WebSocket(wsUrl); wsRef.current = ws; setWsStatus('connecting')
      ws.onopen  = () => { setWsStatus('connected'); ws.send(JSON.stringify({type:'request_state'})) }
      ws.onmessage = e => { try { handleRemoteEvent(JSON.parse(e.data)) } catch {} }
      ws.onclose = () => { setWsStatus('disconnected'); setTimeout(connect,3000) }
      ws.onerror = () => setWsStatus('disconnected')
    }
    connect()
    return () => wsRef.current?.close()
  }, [classeId, seanceId])
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctxRef.current = ctx; ctx.lineCap='round'; ctx.lineJoin='round'
    fillBg(ctx, canvas, bgColor)
  }, [bgColor])
  const fillBg = (ctx:CanvasRenderingContext2D, canvas:HTMLCanvasElement, bg:string) => {
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height)
    if (bg==='grid') {
      ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=1
      for (let x=0;x<canvas.width;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}
      for (let y=0;y<canvas.height;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
    } else if (bg==='lines') {
      ctx.strokeStyle='#dbeafe'; ctx.lineWidth=1
      for (let y=40;y<canvas.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
    }
  }
  const hexToRgba = (hex:string,a:number)=>{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${a})`}
  const handleRemoteEvent = useCallback((data:any) => {
    const canvas=canvasRef.current; const ctx=ctxRef.current; if (!canvas||!ctx) return
    if (data.type==='draw'){
      ctx.globalCompositeOperation=data.tool==='eraser'?'destination-out':'source-over'
      ctx.strokeStyle=data.tool==='highlighter'?hexToRgba(data.color,0.35):data.color
      ctx.lineWidth=data.lineWidth; ctx.globalAlpha=data.tool==='highlighter'?0.35:1
      ctx.beginPath(); ctx.moveTo(data.from.x,data.from.y); ctx.lineTo(data.to.x,data.to.y); ctx.stroke()
      ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1
    } else if (data.type==='text'){
      ctx.font=`${data.fontSize||20}px 'Amiri',serif`; ctx.fillStyle=data.color
      ctx.direction='rtl'; ctx.fillText(data.text,data.x,data.y); ctx.direction='ltr'
    } else if (data.type==='clear'){ fillBg(ctx,canvas,bgColor)
    } else if (data.type==='cursor'&&role==='eleve'){ setRemoteCursor({x:data.x,y:data.y})
    } else if (data.type==='canvas_state'){ const img=new Image(); img.onload=()=>ctx.drawImage(img,0,0); img.src=data.dataUrl
    } else if (data.type==='undo'&&data.dataUrl){ const img=new Image(); img.onload=()=>{fillBg(ctx,canvas,bgColor);ctx.drawImage(img,0,0)}; img.src=data.dataUrl }
  },[bgColor,role])
  const getPos=(e:React.MouseEvent|React.TouchEvent,canvas:HTMLCanvasElement)=>{
    const rect=canvas.getBoundingClientRect(); const sx=canvas.width/rect.width; const sy=canvas.height/rect.height
    if ('touches' in e){const t=e.touches[0];return{x:(t.clientX-rect.left)*sx,y:(t.clientY-rect.top)*sy}}
    return{x:(e.clientX-rect.left)*sx,y:(e.clientY-rect.top)*sy}
  }
  const broadcast=(data:object)=>{if(wsRef.current?.readyState===WebSocket.OPEN)wsRef.current.send(JSON.stringify(data))}
  const saveHistory=()=>{const canvas=canvasRef.current;const ctx=ctxRef.current;if(!canvas||!ctx)return;historyRef.current.push(ctx.getImageData(0,0,canvas.width,canvas.height));if(historyRef.current.length>50)historyRef.current.shift();redoRef.current=[]}
  const startDraw=(e:React.MouseEvent|React.TouchEvent)=>{
    if(role!=='professeur'||tool==='cursor')return
    const canvas=canvasRef.current;const ctx=ctxRef.current;if(!canvas||!ctx)return
    const pos=getPos(e,canvas)
    if(tool==='text'){setTextPos(pos);setShowArabicKeyboard(true);return}
    saveHistory();isDrawing.current=true;lastPos.current=pos
    ctx.beginPath();ctx.arc(pos.x,pos.y,(tool==='eraser'?lineWidth*3:lineWidth)/2,0,Math.PI*2)
    ctx.fillStyle=tool==='eraser'?'#ffffff':color;ctx.fill()
  }
  const draw=(e:React.MouseEvent|React.TouchEvent)=>{
    const canvas=canvasRef.current;const ctx=ctxRef.current;if(!canvas||!ctx)return
    const pos=getPos(e,canvas)
    if(role==='professeur'&&tool==='cursor'){broadcast({type:'cursor',x:pos.x,y:pos.y});return}
    if(!isDrawing.current||!lastPos.current||role!=='professeur')return
    const ew=tool==='eraser'?lineWidth*4:tool==='highlighter'?lineWidth*3:lineWidth
    ctx.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over'
    ctx.strokeStyle=tool==='highlighter'?hexToRgba(color,0.35):color
    ctx.lineWidth=ew;ctx.globalAlpha=tool==='highlighter'?0.35:1;ctx.lineCap='round';ctx.lineJoin='round'
    ctx.beginPath();ctx.moveTo(lastPos.current.x,lastPos.current.y);ctx.lineTo(pos.x,pos.y);ctx.stroke()
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1
    broadcast({type:'draw',tool,color,lineWidth:ew,from:lastPos.current,to:pos})
    lastPos.current=pos
  }
  const stopDraw=()=>{if(!isDrawing.current)return;isDrawing.current=false;lastPos.current=null}
  const handleClear=()=>{const canvas=canvasRef.current;const ctx=ctxRef.current;if(!canvas||!ctx)return;saveHistory();fillBg(ctx,canvas,bgColor);broadcast({type:'clear'})}
  const handleUndo=()=>{const canvas=canvasRef.current;const ctx=ctxRef.current;if(!canvas||!ctx||!historyRef.current.length)return;const last=historyRef.current.pop()!;redoRef.current.push(ctx.getImageData(0,0,canvas.width,canvas.height));ctx.putImageData(last,0,0);broadcast({type:'undo',dataUrl:canvas.toDataURL()})}
  const handleRedo=()=>{const canvas=canvasRef.current;const ctx=ctxRef.current;if(!canvas||!ctx||!redoRef.current.length)return;const next=redoRef.current.pop()!;historyRef.current.push(ctx.getImageData(0,0,canvas.width,canvas.height));ctx.putImageData(next,0,0);broadcast({type:'canvas_state',dataUrl:canvas.toDataURL()})}
  const handleArabicConfirm=()=>{
    if(!arabicText.trim()||!textPos)return
    const ctx=ctxRef.current;if(!ctx)return;saveHistory()
    const fs=lineWidth*6+12;ctx.font=`${fs}px 'Amiri',serif`;ctx.fillStyle=color;ctx.direction='rtl'
    ctx.fillText(arabicText,textPos.x,textPos.y);ctx.direction='ltr'
    broadcast({type:'text',text:arabicText,x:textPos.x,y:textPos.y,color,fontSize:fs})
    setArabicText('');setTextPos(null);setShowArabicKeyboard(false)
  }
  const handleExport=()=>{const canvas=canvasRef.current;if(!canvas)return;const l=document.createElement('a');l.download=`tableau-${seanceId}.png`;l.href=canvas.toDataURL();l.click()}
  return (
    <div className="flex flex-col h-full bg-neutral-50">
      {role==='professeur'&&(
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b border-neutral-200 shadow-sm">
          <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
            {[{id:'pen',icon:'✏️'},{id:'highlighter',icon:'🖍️'},{id:'eraser',icon:'🧹'},{id:'text',icon:'أ'},{id:'cursor',icon:'🔴'}].map(t=>(
              <button key={t.id} onClick={()=>setTool(t.id as any)} className={`px-2.5 py-1.5 rounded text-sm font-medium transition-all ${tool===t.id?'bg-white shadow text-primary-700 ring-1 ring-primary-300':'text-neutral-600 hover:bg-neutral-200'}`}>{t.icon}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500">Taille</span>
            <input type="range" min="1" max="20" value={lineWidth} onChange={e=>setLineWidth(parseInt(e.target.value))} className="w-20 accent-primary-600"/>
            <span className="text-xs text-neutral-600 w-5">{lineWidth}</span>
          </div>
          <div className="flex gap-1 items-center">
            {COLORS.map(c=>(
              <button key={c.value} onClick={()=>setColor(c.value)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color===c.value?'border-primary-600 scale-110 shadow-md':'border-neutral-300'}`} style={{backgroundColor:c.value}}/>
            ))}
            <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border border-neutral-300"/>
          </div>
          <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
            {[{id:'white',label:'⬜'},{id:'grid',label:'⊞'},{id:'lines',label:'☰'}].map(b=>(
              <button key={b.id} onClick={()=>setBgColor(b.id as any)} className={`px-2 py-1 rounded text-sm transition ${bgColor===b.id?'bg-white shadow text-primary-700':'text-neutral-500 hover:bg-neutral-200'}`}>{b.label}</button>
            ))}
          </div>
          <div className="flex gap-1 ml-auto">
            <button onClick={handleUndo}   className="px-2 py-1.5 text-sm border border-neutral-200 rounded hover:bg-neutral-100">↩️</button>
            <button onClick={handleRedo}   className="px-2 py-1.5 text-sm border border-neutral-200 rounded hover:bg-neutral-100">↪️</button>
            <button onClick={handleClear}  className="px-2 py-1.5 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50">🗑️</button>
            <button onClick={handleExport} className="px-2 py-1.5 text-sm border border-neutral-200 rounded hover:bg-neutral-100">⬇️</button>
          </div>
        </div>
      )}
      <div className={`px-3 py-1 text-xs flex items-center justify-between ${wsStatus==='connected'?'bg-green-50 text-green-700':wsStatus==='connecting'?'bg-yellow-50 text-yellow-700':'bg-red-50 text-red-700'}`}>
        <span>{wsStatus==='connected'?'🟢 Tableau connecté':wsStatus==='connecting'?'🟡 Connexion…':'🔴 Déconnecté — reconnexion…'}</span>
        {role==='eleve'&&<span className="text-neutral-500 italic">👁️ Vue en direct</span>}
      </div>
      <div className="relative flex-1 overflow-hidden">
        <canvas ref={canvasRef} width={1600} height={900} className="w-full h-full"
          style={{cursor:role!=='professeur'?'default':tool==='eraser'?'cell':tool==='text'?'text':'crosshair',touchAction:'none'}}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}/>
        {role==='eleve'&&remoteCursor&&(
          <div className="absolute pointer-events-none z-10" style={{left:`${(remoteCursor.x/1600)*100}%`,top:`${(remoteCursor.y/900)*100}%`,transform:'translate(-50%,-50%)'}}>
            <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow-lg animate-pulse"/>
            <div className="absolute -bottom-5 left-5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap shadow">Prof</div>
          </div>
        )}
      </div>
      {showArabicKeyboard&&role==='professeur'&&(
        <div className="border-t border-neutral-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-neutral-700">⌨️ Clavier arabe</h4>
            <button onClick={()=>{setShowArabicKeyboard(false);setArabicText('')}} className="text-xs text-neutral-400 hover:text-neutral-600">✕</button>
          </div>
          <div className="w-full border border-neutral-200 rounded px-3 py-2 mb-2 text-right text-lg bg-neutral-50 min-h-[40px]" style={{fontFamily:"'Amiri',serif",direction:'rtl'}}>
            {arabicText||<span className="text-neutral-300">Votre texte…</span>}
          </div>
          <div className="flex flex-wrap gap-1 mb-2 max-h-28 overflow-y-auto">
            {ARABIC_CHARS.map((char,i)=>(
              <button key={i} onClick={()=>setArabicText(p=>p+char)} className="w-8 h-8 border border-neutral-200 rounded hover:bg-primary-50 text-sm font-medium" style={{fontFamily:"'Amiri',serif"}}>{char}</button>
            ))}
            <button onClick={()=>setArabicText(p=>p.slice(0,-1))} className="px-2 h-8 border border-red-200 text-red-500 rounded hover:bg-red-50 text-xs">⌫</button>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={()=>{setShowArabicKeyboard(false);setArabicText('')}} className="px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 rounded">Annuler</button>
            <button onClick={handleArabicConfirm} disabled={!arabicText.trim()} className="btn-primary text-sm px-4 py-1 disabled:opacity-50">Écrire sur le tableau</button>
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Composant principal ─────────────────────────────────────────────────────
export default function ClasseDetail({ role }: ClasseDetailProps) {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAppSelector(selectAuth)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<'salle'|'chat'|'tableau'|'supports'|'facture'|'infos'>(
    (searchParams.get('tab') as any) || 'chat'
  )
  const [messageText, setMessageText]   = useState('')
  const [messages, setMessages]         = useState<Message[]>([])
  const [showPreCheckModal, setShowPreCheckModal] = useState(false)
  const [seances, setSeances]           = useState<Seance[]>([])
  const [selectedSeance, setSelectedSeance] = useState<Seance | null>(null)
  const [loadingSeances, setLoadingSeances] = useState(false)
  const [liveKitSession, setLiveKitSession] = useState<LiveKitSession | null>(null)
  const [joiningSalle, setJoiningSalle] = useState(false)

  const { data: classe, isLoading: loadingClass } = useGetClassQuery(id!, { skip: !id })

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const [devoirs, setDevoirs]           = useState<any[]>([])
  const [loadingDevoirs, setLoadingDevoirs] = useState(false)
  const [newDevoir, setNewDevoir]       = useState<{titre:string;files:File[]}|null>(null)
  const [timerDevoirId, setTimerDevoirId] = useState<string|null>(null)
  const [timerMinutes, setTimerMinutes] = useState<number>(0)
  const [timerRemaining, setTimerRemaining] = useState<number>(0)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [uploadingStudentFiles, setUploadingStudentFiles] = useState<Record<string,boolean>>({})
  const timerRef = useRef<NodeJS.Timeout|null>(null)

  useEffect(() => {
    if (!id) return
    setLoadingSeances(true)
    api.get(`/classes/${id}/seances/`)
      .then(res => setSeances(res.data.results || []))
      .catch(err => console.error(err))
      .finally(() => setLoadingSeances(false))
  }, [id])

  useEffect(() => {
    if (!id || activeTab !== 'chat') return
    const load = async () => {
      try {
        const res = await api.get('/messages/', { params: { classe_id: id } })
        setMessages(res.data.results || [])
      } catch {}
    }
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [id, activeTab])

  useEffect(() => {
    if (activeTab !== 'salle') navigate(`?tab=${activeTab}`, { replace: true })
  }, [activeTab, navigate])

  useEffect(() => {
    if (role === 'eleve' && activeTab === 'chat' && classe?.creneau_confirme_prof === false) {
      setShowPreCheckModal(true)
    }
  }, [role, activeTab, classe])

  useEffect(() => {
    if (!selectedSeance?.id) return
    setLoadingDevoirs(true)
    api.get(`/devoirs/`, { params: { seance: selectedSeance.id } })
      .then(res => setDevoirs(res.data.results || res.data || []))
      .catch(() => {})
      .finally(() => setLoadingDevoirs(false))
  }, [selectedSeance?.id])

  const handleSelectSeance = (seance: Seance) => {
    setSelectedSeance(seance)
    setActiveTab('chat')
  }

  // ── Rejoindre la salle — uniquement via bouton explicite ──────────────────
  const handleJoinSalle = async () => {
    if (!id) return
    setJoiningSalle(true)
    try {
      const res = await api.post(`/classes/${id}/start-session/`, { seance_id: selectedSeance?.id ?? null })
      setLiveKitSession({
        presenceId:  res.data.presence_id,
        seanceId:    res.data.seance_id,
        roomName:    res.data.room_name,
        token:       res.data.livekit_token,
        serverUrl:   res.data.livekit_url,
        isModerator: res.data.is_moderator,
      })
      setActiveTab('salle')
    } catch (err: any) {
      alert(`⚠️ ${err.response?.data?.error || 'Impossible de rejoindre la salle'}`)
    } finally {
      setJoiningSalle(false)
    }
  }

  const [showQuery10Modal, setShowQuery10Modal]   = useState(false)
  const [hasTriggeredQuery10, setHasTriggeredQuery10] = useState(false)
  const [showQueryFinModal, setShowQueryFinModal] = useState(false)
  const [query10Response, setQuery10Response]     = useState<'oui'|'non'|null>(null)
  const [queryFinResponse, setQueryFinResponse]   = useState<'oui'|'non'|null>(null)
  const [studentPresence, setStudentPresence]     = useState<Record<string,boolean>>({})
  const [studentsInClass, setStudentsInClass]     = useState<Array<{id:string;name:string}>>([])

  useEffect(() => {
    if (!liveKitSession?.presenceId || hasTriggeredQuery10) return
    const timer = setTimeout(() => {
      setHasTriggeredQuery10(true); setShowQuery10Modal(true)
      if (role === 'professeur') {
        api.get(`/inscriptions/?classe=${id}&role=eleve`)
          .then(res => setStudentsInClass((res.data.results||res.data||[]).map((i:any)=>({id:String(i.eleve_id||i.eleve?.id||i.user?.id),name:i.eleve_nom||i.display_name||'Élève'}))))
          .catch(() => {})
      }
    }, 3*60*1000)
    return () => clearTimeout(timer)
  }, [liveKitSession, id, role, hasTriggeredQuery10])

  useEffect(() => { if (liveKitSession) setHasTriggeredQuery10(false) }, [liveKitSession])

  const handleLeaveSession = async (audioUrl?: string) => {
    let shouldShowFin = false
    if (liveKitSession && id) {
      try {
        const res = await api.post(`/classes/${id}/end-session/`, { presence_id: liveKitSession.presenceId, audio_url: audioUrl ?? '' })
        const { duree_presence_minutes } = res.data
        if (duree_presence_minutes && selectedSeance?.duree_reelle_minutes && duree_presence_minutes/selectedSeance.duree_reelle_minutes >= 0.7) {
          shouldShowFin = true
          if (role === 'professeur') {
            const r = await api.get(`/inscriptions/`, { params: { classe: id, role: 'eleve' } })
            setStudentsInClass((r.data.results||r.data||[]).map((i:any)=>({id:String(i.eleve_id||i.eleve?.id||i.user?.id),name:i.eleve_nom||i.display_name||'Élève'})))
          }
          setShowQueryFinModal(true)
        }
      } catch {}
    }
    if (!shouldShowFin) { setLiveKitSession(null); setActiveTab('chat') }
  }

  const handleAddDevoir = async () => {
    if (!newDevoir?.titre.trim()||!selectedSeance?.id) return
    try {
      const res = await api.post('/devoirs/', { seance:selectedSeance.id, titre:newDevoir.titre, statut:'brouillon' })
      if (newDevoir.files?.length>0) {
        const fd = new FormData(); newDevoir.files.forEach(f=>fd.append('files',f))
        await api.post(`/devoirs/${res.data.id}/upload-files/`, fd, { headers:{'Content-Type':'multipart/form-data'} })
      }
      const r2 = await api.get(`/devoirs/`, { params:{seance:selectedSeance.id} })
      setDevoirs(r2.data.results||r2.data||[]); setNewDevoir(null)
    } catch { alert('❌ Impossible d\'ajouter le devoir') }
  }

  const handleSubmitDevoir = async (devoirId:string) => {
    try {
      await api.patch(`/devoirs/${devoirId}/`, { statut:'soumis', submitted_at:new Date().toISOString() })
      setDevoirs(prev=>prev.map(d=>d.id===devoirId?{...d,statut:'soumis',submitted_at:new Date().toISOString()}:d))
    } catch { alert('❌ Impossible de soumettre') }
  }

  const handleCloturerDevoir = async (devoirId:string) => {
    try {
      await api.patch(`/devoirs/${devoirId}/`, { statut:'cloturer' })
      setDevoirs(prev=>prev.map(d=>d.id===devoirId?{...d,statut:'cloturer'}:d))
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current=null }
      setTimerDevoirId(null)
    } catch { alert('❌ Impossible de clôturer') }
  }

  const handleStartTimer = (devoirId:string, minutes:number) => {
    setTimerDevoirId(devoirId); setTimerMinutes(minutes); setTimerRemaining(minutes*60); setShowTimerModal(false)
    timerRef.current = setInterval(()=>{
      setTimerRemaining(prev=>{
        if (prev<=1){if(timerRef.current)clearInterval(timerRef.current);timerRef.current=null;handleCloturerDevoir(devoirId);return 0}
        return prev-1
      })
    },1000)
  }

  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current)},[])

  const handleStudentUpload = async (devoirId:string, files:FileList) => {
    if (!files.length) return
    setUploadingStudentFiles(prev=>({...prev,[devoirId]:true}))
    try {
      const fd=new FormData(); Array.from(files).forEach(f=>fd.append('files',f)); fd.append('eleve_id',user?.id||'')
      await api.post(`/devoirs/${devoirId}/student-upload/`, fd, {headers:{'Content-Type':'multipart/form-data'}})
      alert('✅ Copie envoyée'); const r=await api.get(`/devoirs/`,{params:{seance:selectedSeance?.id}}); setDevoirs(r.data.results||r.data||[])
    } catch { alert('❌ Échec de l\'envoi') }
    finally { setUploadingStudentFiles(prev=>({...prev,[devoirId]:false})) }
  }

  const handleDownloadFile=(file:any)=>{const l=document.createElement('a');l.href=file.fichier_url||`/api/fichiers/${file.id}/download/`;l.download=file.nom_original;l.click()}

  if (!id||(!classe&&!loadingClass)) return (
    <div className="text-center py-12">
      <p className="text-neutral-600">Classe non trouvée ou accès refusé</p>
      <button onClick={()=>navigate(-1)} className="btn-primary mt-4">← Retour</button>
    </div>
  )
  if (loadingClass) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"/>
    </div>
  )

  const handleSendMessage = async (e:React.FormEvent) => {
    e.preventDefault(); if (!messageText.trim()||!id) return
    try { await api.post('/messages/',{classe_id:id,contenu:messageText,type_message:'texte'}); setMessageText('') } catch {}
  }

  const PreClassCheckModal = () => {
    const [profAbsent,setProfAbsent]=useState(false)
    const [profRetard,setProfRetard]=useState(false)
    const [retardMinutes,setRetardMinutes]=useState('')
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">🕐 Vérification avant le cours</h3>
          <p className="text-sm text-neutral-600 mb-4">Pour la classe <strong>{classe?.nom}</strong> prévue {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][(classe?.jour_semaine??1)-1]} {classe?.heure_debut?.substring(0,5)} :</p>
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-neutral-50 cursor-pointer">
              <input type="checkbox" checked={profAbsent} onChange={e=>setProfAbsent(e.target.checked)} className="w-4 h-4 text-primary-600 rounded"/>
              <span className="text-sm">Ma mou3alima est absente aujourd'hui</span>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-neutral-50 cursor-pointer">
              <input type="checkbox" checked={profRetard} onChange={e=>setProfRetard(e.target.checked)} className="w-4 h-4 text-primary-600 rounded"/>
              <span className="text-sm">Ma mou3alima est en retard de plus de 10 minutes</span>
            </label>
            {profRetard&&<div className="pl-7"><input type="number" placeholder="Minutes de retard" value={retardMinutes} onChange={e=>setRetardMinutes(e.target.value)} className="form-input" min="10"/></div>}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={()=>setShowPreCheckModal(false)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">Annuler</button>
            <button onClick={()=>setShowPreCheckModal(false)} className="btn-primary">Valider</button>
          </div>
        </div>
      </div>
    )
  }

  const Query10Modal = () => {
    const handleSubmit = async () => {
      try {
        if (role==='eleve'&&query10Response) await api.post(`/presences/${liveKitSession?.presenceId}/feedback/`,{type:'resp_query_10_eleve',response:query10Response})
        else if (role==='professeur') await api.post(`/classes/${id}/absences-profs/`,{seance_id:selectedSeance?.id,type:'resp_query_10_prof',students:Object.entries(studentPresence).map(([sid,p])=>({student_id:sid,present:p}))})
      } catch {}
      finally{setShowQuery10Modal(false);setQuery10Response(null);setStudentPresence({})}
    }
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">🕐 Point à 11 minutes</h3>
          {role==='eleve'?(
            <><p className="text-sm text-neutral-600 mb-4">Votre enseignant·e est-il/elle présent·e ?</p>
            <div className="flex gap-3">
              <button onClick={()=>setQuery10Response('oui')} className={`flex-1 py-3 rounded-lg font-medium border-2 transition ${query10Response==='oui'?'border-green-500 bg-green-50 text-green-700':'border-neutral-200 hover:border-green-300'}`}>✅ Oui</button>
              <button onClick={()=>setQuery10Response('non')} className={`flex-1 py-3 rounded-lg font-medium border-2 transition ${query10Response==='non'?'border-red-500 bg-red-50 text-red-700':'border-neutral-200 hover:border-red-300'}`}>❌ Non</button>
            </div></>
          ):(
            <><p className="text-sm text-neutral-600 mb-4">Présence des élèves :</p>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {studentsInClass.map(s=>(
                <label key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-neutral-50">
                  <span className="text-sm">{s.name}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setStudentPresence(prev=>({...prev,[s.id]:true}))} className={`px-3 py-1 text-xs rounded border ${studentPresence[s.id]===true?'bg-green-100 border-green-500 text-green-700':'border-neutral-200 text-neutral-500'}`}>Présent</button>
                    <button type="button" onClick={()=>setStudentPresence(prev=>({...prev,[s.id]:false}))} className={`px-3 py-1 text-xs rounded border ${studentPresence[s.id]===false?'bg-red-100 border-red-500 text-red-700':'border-neutral-200 text-neutral-500'}`}>Absent</button>
                  </div>
                </label>
              ))}
            </div></>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={()=>setShowQuery10Modal(false)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">Plus tard</button>
            <button onClick={handleSubmit} disabled={role==='eleve'&&!query10Response} className="btn-primary disabled:opacity-50">Valider</button>
          </div>
        </div>
      </div>
    )
  }

  const QueryFinModal = () => {
    const handleSubmit = async () => {
      try {
        if (role==='eleve'&&queryFinResponse) await api.post(`/presences/${liveKitSession?.presenceId}/feedback/`,{type:'resp_query_fin_eleve',response:queryFinResponse})
        else if (role==='professeur') await api.post(`/classes/${id}/absences-profs/`,{seance_id:selectedSeance?.id,type:'resp_query_fin_prof',students:Object.entries(studentPresence).map(([sid,p])=>({student_id:sid,present:p}))})
      } catch {}
      finally{setShowQueryFinModal(false);setQueryFinResponse(null);setStudentPresence({});setLiveKitSession(null);setActiveTab('chat')}
    }
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">🏁 Bilan de fin de séance</h3>
          {role==='eleve'?(
            <><p className="text-sm text-neutral-600 mb-4">Votre enseignant·e a-t-il/elle été présent·e ?</p>
            <div className="flex gap-3">
              <button onClick={()=>setQueryFinResponse('oui')} className={`flex-1 py-3 rounded-lg font-medium border-2 transition ${queryFinResponse==='oui'?'border-green-500 bg-green-50 text-green-700':'border-neutral-200 hover:border-green-300'}`}>✅ Oui</button>
              <button onClick={()=>setQueryFinResponse('non')} className={`flex-1 py-3 rounded-lg font-medium border-2 transition ${queryFinResponse==='non'?'border-red-500 bg-red-50 text-red-700':'border-neutral-200 hover:border-red-300'}`}>❌ Non</button>
            </div></>
          ):(
            <><p className="text-sm text-neutral-600 mb-4">Confirmez la présence des élèves :</p>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {studentsInClass.map(s=>(
                <label key={s.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-neutral-50">
                  <span className="text-sm">{s.name}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={()=>setStudentPresence(prev=>({...prev,[s.id]:true}))} className={`px-3 py-1 text-xs rounded border ${studentPresence[s.id]===true?'bg-green-100 border-green-500 text-green-700':'border-neutral-200 text-neutral-500'}`}>Présent</button>
                    <button type="button" onClick={()=>setStudentPresence(prev=>({...prev,[s.id]:false}))} className={`px-3 py-1 text-xs rounded border ${studentPresence[s.id]===false?'bg-red-100 border-red-500 text-red-700':'border-neutral-200 text-neutral-500'}`}>Absent</button>
                  </div>
                </label>
              ))}
            </div></>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={()=>setShowQueryFinModal(false)} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">Ignorer</button>
            <button onClick={handleSubmit} disabled={role==='eleve'&&!queryFinResponse} className="btn-primary disabled:opacity-50">Terminer</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div className="bg-white rounded-lg p-4 border border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{classe?.nom}</h1>
            <p className="text-neutral-600">{classe?.programme} • Niveau {classe?.niveau}</p>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={classe?.statut||'actif'} color={classe?.couleur||'normal'}/>
              {classe?.professeur && <span className="text-sm text-neutral-600">👨‍🏫 {classe.professeur.display_name}</span>}
              {liveKitSession && (
                <span className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>Session active
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {liveKitSession && activeTab !== 'salle' && (
              <button onClick={()=>setActiveTab('salle')} className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-green-100 text-green-700 hover:bg-green-200 transition">
                🎥 Retour en salle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Liste des séances */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-700">📋 Séances de la classe</h2>
          {loadingSeances && (
            <span className="text-xs text-neutral-400 flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-neutral-300 border-t-primary-500 rounded-full animate-spin"/>Chargement…
            </span>
          )}
        </div>
        {!loadingSeances && seances.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-4">Aucune séance enregistrée pour cette classe.</p>
        )}
        {seances.length > 0 && (
          <div className="flex flex-col gap-2">
            {seances.map(seance =>
              role === 'professeur' ? (
                // ── Vue prof : composant complet avec inputs + bouton élèves
                <SeanceProfRow
                  key={seance.id}
                  seance={seance}
                  isSelected={selectedSeance?.id === seance.id}
                  onSelect={() => handleSelectSeance(seance)}
                />
              ) : (
                // ── Vue élève : ligne simple
                <button
                  key={seance.id}
                  onClick={() => handleSelectSeance(seance)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${selectedSeance?.id===seance.id?'border-primary-500 bg-primary-50 ring-1 ring-primary-300':'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedSeance?.id===seance.id?'bg-primary-500':'bg-neutral-200'}`}/>
                      <div>
                        <span className="text-sm font-medium text-neutral-900">{formatDateSeance(seance.date_seance)}</span>
                        {seance.heure_debut_reelle&&<span className="text-xs text-neutral-500 ml-2">🕐 {seance.heure_debut_reelle}</span>}
                        {seance.duree_reelle_minutes&&<span className="text-xs text-neutral-400 ml-2">({seance.duree_reelle_minutes} min)</span>}
                      </div>
                    </div>
                    <SeanceStatusBadge statut={seance.statut}/>
                  </div>
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Zone principale */}
      {!selectedSeance ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center text-neutral-500">
          <div className="text-4xl mb-3">☝️</div>
          <p className="text-base font-medium">Sélectionnez une séance ci-dessus</p>
          <p className="text-sm mt-1">Le chat, la salle de cours et les autres onglets s'activeront.</p>
        </div>
      ) : (
        <>
          {/* Onglets */}
          <div className="flex overflow-x-auto gap-1 border-b border-neutral-200 pb-1">
            {[
              { id:'salle',    label:'🎥 Salle de cours',    condition:true },
              { id:'chat',     label:'💬 Chat de classe',    condition:true },
              { id:'tableau',  label:'🖊️ Tableau',           condition:true },
              { id:'supports', label:'📁 Supports & Devoirs', condition:true },
              { id:'facture',  label:'💰 Facture',           condition:role==='eleve' },
              { id:'infos',    label:'ℹ️ Infos',             condition:true },
            ].filter(t=>t.condition).map(tab=>(
              <button key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}   // ← simple changement d'onglet, JAMAIS de join auto
                className={`relative px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${activeTab===tab.id?'bg-white border-x border-t border-neutral-200 text-primary-700 -mb-px':'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'}`}
              >
                {tab.label}
                {tab.id==='salle'&&liveKitSession&&<span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500"/>}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-neutral-200 h-[75vh] flex flex-col overflow-hidden">

            {/* 🎥 Salle */}
            <div className={activeTab==='salle'?'flex-1 min-h-0':'hidden'}>
              {liveKitSession && classe ? (
                <VideoRoom
                  classe={classe} seance={{id:liveKitSession.seanceId}} role={role}
                  onLeave={(audioUrl?:string)=>handleLeaveSession(audioUrl)}
                  roomName={liveKitSession.roomName} token={liveKitSession.token}
                  serverUrl={liveKitSession.serverUrl} isModerator={liveKitSession.isModerator}
                />
              ) : (
                /* ── Pas de session : bouton explicite "Démarrer" ── */
                <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-8">
                  <div className="text-5xl mb-4">🎥</div>
                  <p className="text-lg font-medium mb-2">Prêt à rejoindre le cours ?</p>
                  <p className="text-sm text-center max-w-md mb-6">
                    Séance du <strong>{formatDateSeance(selectedSeance.date_seance)}</strong>.<br/>
                    Cliquez sur le bouton ci-dessous pour démarrer la session vidéo.
                  </p>
                  <button
                    onClick={handleJoinSalle}
                    disabled={joiningSalle}
                    className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
                  >
                    {joiningSalle
                      ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Connexion en cours…</>
                      : '🚀 Démarrer la session vidéo'}
                  </button>
                </div>
              )}
            </div>

            {/* 💬 Chat */}
            {activeTab==='chat'&&(
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length===0?(
                    <p className="text-center text-neutral-500 py-8">💬 Soyez le premier à écrire !</p>
                  ):messages.map(msg=>(
                    <div key={msg.id} className={`flex gap-3 ${msg.expediteur===user?.id?'flex-row-reverse':''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${msg.expediteur===user?.id?'bg-primary-100 text-primary-700':'bg-neutral-100 text-neutral-700'}`}>
                        {msg.expediteur_nom?.[0]?.toUpperCase()||'?'}
                      </div>
                      <div className={`max-w-lg px-4 py-2 rounded-2xl ${msg.expediteur===user?.id?'bg-primary-600 text-white rounded-br-none':'bg-neutral-100 text-neutral-900 rounded-bl-none'}`}>
                        {msg.expediteur!==user?.id&&<p className="text-xs font-medium text-neutral-500 mb-1">{msg.expediteur_nom}</p>}
                        <p className="text-sm">{msg.contenu}</p>
                        <p className={`text-xs mt-1 ${msg.expediteur===user?.id?'text-primary-100':'text-neutral-500'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef}/>
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-200 flex gap-2">
                  <input type="text" value={messageText} onChange={e=>setMessageText(e.target.value)} placeholder="Écrire un message…" className="form-input flex-1"/>
                  <button type="submit" disabled={!messageText.trim()} className="btn-primary px-6">Envoyer</button>
                </form>
              </div>
            )}

            {/* 🖊️ Tableau */}
            {activeTab==='tableau'&&id&&selectedSeance&&(
              <CollaborativeWhiteboard classeId={id} seanceId={selectedSeance.id} role={role}/>
            )}

            {/* 📁 Supports & Devoirs */}
            {activeTab==='supports'&&(
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-neutral-900">📋 Devoirs de la séance</h3>
                  {role==='professeur'&&!newDevoir&&(
                    <button onClick={()=>setNewDevoir({titre:'',files:[]})} className="btn-primary text-sm px-3 py-1.5">+ Ajouter un devoir</button>
                  )}
                </div>
                {loadingDevoirs?(
                  <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-neutral-300 border-t-primary-500 rounded-full animate-spin"/></div>
                ):(
                  <>
                    {role==='professeur'&&newDevoir&&(
                      <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-4 mb-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input type="text" placeholder="Titre du devoir *" value={newDevoir.titre} onChange={e=>setNewDevoir({...newDevoir,titre:e.target.value})} className="form-input flex-1" autoFocus/>
                          <label className="btn-secondary whitespace-nowrap cursor-pointer flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-white transition">
                            📎 Ajouter des fichiers
                            <input type="file" multiple className="hidden" onChange={e=>{if(e.target.files)setNewDevoir({...newDevoir,files:Array.from(e.target.files)})}}/>
                          </label>
                        </div>
                        {newDevoir.files.length>0&&<p className="text-xs text-neutral-600 mt-2">{newDevoir.files.length} fichier(s) : {newDevoir.files.map(f=>f.name).join(', ')}</p>}
                        <div className="flex gap-2 mt-3 justify-end">
                          <button onClick={()=>setNewDevoir(null)} className="px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 rounded">Annuler</button>
                          <button onClick={handleAddDevoir} disabled={!newDevoir.titre.trim()} className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">✅ Enregistrer</button>
                        </div>
                      </div>
                    )}
                    {devoirs.length===0&&!newDevoir?(
                      <p className="text-center text-neutral-500 py-8">
                        {role==='professeur'?'Aucun devoir. Cliquez sur "+ Ajouter" pour commencer.':'Aucun devoir disponible.'}
                      </p>
                    ):(
                      <div className="space-y-3">
                        {devoirs.map(devoir=>{
                          const isCloture=devoir.statut==='cloturer'
                          const isSubmitted=devoir.statut==='soumis'
                          const teacherFiles=(devoir.fichiers||[]).filter((f:any)=>!f.eleve)
                          const studentFiles=(devoir.fichiers||[]).filter((f:any)=>f.eleve===user?.id)
                          const isTimerActive=timerDevoirId===devoir.id
                          return (
                            <div key={devoir.id} className={`border rounded-lg p-4 ${isCloture?'bg-neutral-50':'bg-white'}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-3">
                                  <h4 className="font-medium text-neutral-900">{devoir.titre||'Sans titre'}</h4>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${isCloture?'bg-neutral-200 text-neutral-700':isSubmitted?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{devoir.statut}</span>
                                  {devoir.submitted_at&&<span className="text-xs text-neutral-500">Soumis le {new Date(devoir.submitted_at).toLocaleDateString('fr-FR')}</span>}
                                </div>
                                {role==='professeur'&&!isCloture&&(
                                  <div className="flex items-center gap-2">
                                    {!isTimerActive?(
                                      <button onClick={()=>setShowTimerModal(true)} className="px-2 py-1 text-xs border border-neutral-300 rounded hover:bg-neutral-50 flex items-center gap-1">⏱️ Chrono</button>
                                    ):(
                                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded font-mono">{Math.floor(timerRemaining/60)}:{String(timerRemaining%60).padStart(2,'0')}</span>
                                    )}
                                    {!isSubmitted&&<button onClick={()=>handleSubmitDevoir(devoir.id)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">✅ Soumettre</button>}
                                    <button onClick={()=>handleCloturerDevoir(devoir.id)} className="px-2 py-1 text-xs bg-neutral-200 text-neutral-700 rounded hover:bg-neutral-300">🔒 Clôturer</button>
                                  </div>
                                )}
                              </div>
                              {teacherFiles.length>0&&(
                                <div className="mb-3">
                                  <p className="text-xs font-medium text-neutral-500 mb-2">📎 Fichiers du devoir :</p>
                                  <div className="flex flex-wrap gap-2">
                                    {teacherFiles.map((file:any)=>(
                                      <button key={file.id} onClick={()=>handleDownloadFile(file)} className="flex items-center gap-1 px-3 py-1.5 text-xs border border-neutral-200 rounded hover:bg-neutral-50">📄 {file.nom_original}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {role==='eleve'&&isSubmitted&&!isCloture&&(
                                <div className="mt-3 pt-3 border-t border-neutral-100">
                                  <p className="text-xs font-medium text-neutral-500 mb-2">📤 Votre copie :</p>
                                  {studentFiles.length>0&&<p className="text-xs text-neutral-600 mb-2">✅ {studentFiles.map((f:any)=>f.nom_original).join(', ')}</p>}
                                  <label className="btn-secondary text-xs px-3 py-1.5 cursor-pointer inline-flex items-center gap-1">
                                    {uploadingStudentFiles[devoir.id]?'Envoi…':'📁 Uploader ma copie'}
                                    <input type="file" multiple className="hidden" disabled={uploadingStudentFiles[devoir.id]||isCloture} onChange={e=>e.target.files&&handleStudentUpload(devoir.id,e.target.files)}/>
                                  </label>
                                </div>
                              )}
                              {isCloture&&<p className="text-xs text-neutral-500 mt-2 italic">🔒 Devoir clôturé.</p>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
                {showTimerModal&&(
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                      <h3 className="text-lg font-semibold text-neutral-900 mb-4">⏱️ Temps limite</h3>
                      <label className="block text-sm text-neutral-600 mb-2">Durée en minutes :</label>
                      <input type="number" min="1" max="180" value={timerMinutes||''} onChange={e=>setTimerMinutes(parseInt(e.target.value)||0)} className="form-input w-full mb-4" placeholder="Ex: 30" autoFocus/>
                      <div className="flex justify-end gap-3">
                        <button onClick={()=>{setShowTimerModal(false);setTimerMinutes(0)}} className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg">Annuler</button>
                        <button onClick={()=>{if(timerMinutes>0){const last=[...devoirs].reverse().find(d=>d.seance===selectedSeance?.id);if(last)handleStartTimer(last.id,timerMinutes)}}} disabled={!timerMinutes} className="btn-primary disabled:opacity-50">Démarrer</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 💰 Facture */}
            {activeTab==='facture'&&role==='eleve'&&(
              <div className="p-6 text-center text-neutral-600">💰 Section Facture (à développer)</div>
            )}

            {/* ℹ️ Infos */}
            {activeTab==='infos'&&classe&&(
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><p className="text-sm text-neutral-500">Programme</p><p className="font-medium">{classe.programme||'-'}</p></div>
                  <div><p className="text-sm text-neutral-500">Niveau</p><p className="font-medium">{classe.niveau||'-'}</p></div>
                  <div><p className="text-sm text-neutral-500">Créneau</p><p className="font-medium">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'][(classe.jour_semaine??1)-1]} {classe.heure_debut?.substring(0,5)||'-'}</p></div>
                  <div><p className="text-sm text-neutral-500">Taux horaire</p><p className="font-medium">{classe.taux_horaire||'-'} €</p></div>
                </div>
                <div className="pt-4 border-t border-neutral-200">
                  <p className="text-sm text-neutral-500 mb-2">Règles de communication</p>
                  <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
                    <li>Les échanges avec le professeur se font uniquement dans ce chat de classe</li>
                    <li>Pas de messagerie privée directe élève ↔ professeur</li>
                    <li>Pour contacter l'administration : onglet "Chat Admin" dans le menu</li>
                    <li>L'historique complet des conversations est conservé</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showPreCheckModal&&<PreClassCheckModal/>}
      {showQuery10Modal&&<Query10Modal/>}
      {showQueryFinModal&&<QueryFinModal/>}
    </div>
  )
}