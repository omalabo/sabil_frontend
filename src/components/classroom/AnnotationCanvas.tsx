// components/classroom/AnnotationCanvas.tsx
import { useEffect, useRef, useState } from 'react'

type Tool = 'move' | 'pen' | 'eraser' | 'highlighter'

interface Props {
  pageKey: string // reset canvas quand la page change
  isPresenter: boolean
  send: (data: any) => void
  remoteEvents: any[] // événements reçus via WS
  onEventConsumed: () => void
}

const COLORS = [
  { label: 'Rouge', value: '#e63946' },
  { label: 'Bleu', value: '#1d6fa4' },
  { label: 'Vert', value: '#2d9e6b' },
  { label: 'Noir', value: '#1a1a2e' },
  { label: 'Orange', value: '#f4a261' },
  { label: 'Blanc', value: '#ffffff' },
]

const hexToRgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function AnnotationCanvas({
  pageKey, isPresenter, send, remoteEvents, onEventConsumed
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<ImageData[]>([])

  // 'move' par défaut : le calque laisse passer molette / glisser / pincer au document
  const [tool, setTool] = useState<Tool>('move')
  const [color, setColor] = useState('#e63946')
  const [lineWidth, setLineWidth] = useState(4)
  const [toolsVisible, setToolsVisible] = useState(false)

  const drawingActive = isPresenter && tool !== 'move'

  // ── Init canvas ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctxRef.current = ctx
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  // ── Reset canvas à chaque changement de page ──
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    historyRef.current = []
  }, [pageKey])

  // ── Appliquer les événements distants ──
  useEffect(() => {
    if (remoteEvents.length === 0) return
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return

    remoteEvents.forEach(evt => {
      if (evt.type === 'anno_draw') {
        ctx.globalCompositeOperation = evt.tool === 'eraser' ? 'destination-out' : 'source-over'
        ctx.strokeStyle = evt.tool === 'highlighter' ? hexToRgba(evt.color, 0.35) : evt.color
        ctx.lineWidth = evt.lineWidth
        ctx.globalAlpha = evt.tool === 'highlighter' ? 0.35 : 1
        ctx.beginPath()
        ctx.moveTo(evt.from.x, evt.from.y)
        ctx.lineTo(evt.to.x, evt.to.y)
        ctx.stroke()
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
      } else if (evt.type === 'anno_clear' || evt.type === 'anno_page_change') {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        historyRef.current = []
      } else if (evt.type === 'anno_state') {
        const img = new Image()
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        }
        img.src = evt.dataUrl
      }
    })
    onEventConsumed()
  }, [remoteEvents, onEventConsumed])

  // Si on quitte le mode dessin en plein trait, on arrête proprement
  useEffect(() => {
    if (tool === 'move') {
      isDrawing.current = false
      lastPos.current = null
    }
  }, [tool])

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPresenter || tool === 'move') return
    const canvas = canvasRef.current
    if (!canvas) return
    const pos = getPos(e, canvas)
    isDrawing.current = true
    lastPos.current = pos

    const ctx = ctxRef.current
    if (!ctx) return
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !isPresenter || tool === 'move') return
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return

    const pos = getPos(e, canvas)
    const from = lastPos.current!

    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = tool === 'highlighter' ? hexToRgba(color, 0.35) : color
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth
    ctx.globalAlpha = tool === 'highlighter' ? 0.35 : 1
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1

    send({
      type: 'anno_draw',
      tool, color,
      lineWidth: tool === 'eraser' ? lineWidth * 4 : lineWidth,
      from, to: pos,
    })

    lastPos.current = pos
  }

  const stopDraw = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    lastPos.current = null

    // État complet après chaque trait (pour les élèves qui arrivent en cours de route)
    if (isPresenter) {
      const canvas = canvasRef.current
      if (canvas) {
        send({ type: 'anno_state', dataUrl: canvas.toDataURL() })
      }
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    historyRef.current = []
    send({ type: 'anno_clear' })
  }

  const handleUndo = () => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx || !historyRef.current.length) return
    const prev = historyRef.current.pop()!
    ctx.putImageData(prev, 0, 0)
    send({ type: 'anno_state', dataUrl: canvas.toDataURL() })
  }

  const toggleTools = () => {
    if (toolsVisible) setTool('move') // on ferme les outils => retour au mode Déplacer
    setToolsVisible(v => !v)
  }

  const toolIcon = (t: Tool) =>
    t === 'move' ? '✋' : t === 'pen' ? '✏️' : t === 'highlighter' ? '🖊️' : '⬜'

  const toolTitle = (t: Tool) =>
    t === 'move' ? 'Déplacer / défiler'
    : t === 'pen' ? 'Stylo'
    : t === 'highlighter' ? 'Surligneur'
    : 'Gomme'

  return (
    <>
      {/* Canvas transparent par-dessus le document.
          Il ne capte les événements que si un outil de dessin est actif. */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
        className="absolute inset-0 w-full h-full"
        style={{
          cursor: drawingActive ? 'crosshair' : 'default',
          touchAction: drawingActive ? 'none' : 'auto',
          background: 'transparent',
          pointerEvents: drawingActive ? 'auto' : 'none',
        }}
      />

      {/* Bouton flottant pour afficher/masquer les outils (prof uniquement) */}
      {isPresenter && (
        <button
          onClick={toggleTools}
          className="pointer-events-auto absolute top-3 right-3 z-30 w-11 h-11 rounded-full bg-white/95 hover:bg-white shadow-lg flex items-center justify-center text-lg transition"
          title="Outils d'annotation"
        >
          {toolsVisible ? '✕' : '✏️'}
        </button>
      )}

      {/* Toolbar flottante */}
      {isPresenter && toolsVisible && (
        <div className="pointer-events-auto absolute top-16 right-3 z-30 bg-white/95 backdrop-blur rounded-xl shadow-xl p-3 flex flex-col gap-3 min-w-[200px]">
          {/* Outils */}
          <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
            {(['move', 'pen', 'highlighter', 'eraser'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTool(t)}
                title={toolTitle(t)}
                className={`flex-1 h-8 flex items-center justify-center rounded text-sm transition ${
                  tool === t ? 'bg-white shadow text-indigo-700' : 'text-neutral-500 hover:bg-white/60'
                }`}
              >
                {toolIcon(t)}
              </button>
            ))}
          </div>

          {/* Couleurs */}
          <div className="flex gap-1 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                style={{ background: c.value }}
                className={`w-6 h-6 rounded-full border-2 transition ${
                  color === c.value ? 'border-indigo-500 scale-110' : 'border-neutral-300'
                }`}
                title={c.label}
              />
            ))}
          </div>

          {/* Épaisseur */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={e => setLineWidth(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-neutral-500 w-6">{lineWidth}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <button
              onClick={handleUndo}
              className="flex-1 px-2 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 rounded transition"
            >
              ↩ Annuler
            </button>
            <button
              onClick={handleClear}
              className="flex-1 px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded transition"
            >
              🗑️ Effacer
            </button>
          </div>
        </div>
      )}
    </>
  )
}
