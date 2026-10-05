// components/classroom/DocumentViewer.tsx
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

export interface DocumentViewerHandle {
  goToPage: (page: number) => void
  scrollBy: (dx: number, dy: number) => void
  zoomBy: (factor: number, cx?: number, cy?: number) => void
  currentPage: number
  totalPages: number
}

interface Props {
  fichierUrl: string
  typeFichier: 'pdf' | 'docx' | 'image'
  onPageChange?: (page: number, total: number) => void
}

const MIN_ZOOM = 0.1 // 10%
const MAX_ZOOM = 5 // 500%
const ZOOM_FACTOR = 1.25
const PAD = 16
const PAGE_GAP = 16
const MAX_CANVAS_PIXELS = 16_000_000
const BG_DONE_VISIBLE_MS = 1500

const clamp = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v))

type Dim = { w: number; h: number }

const DocumentViewer = forwardRef<DocumentViewerHandle, Props>(
  ({ fichierUrl, typeFichier, onPageChange }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const wrapperRefs = useRef<(HTMLDivElement | null)[]>([])
    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])

    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true) // données du PDF
    const [ready, setReady] = useState(false) // page 1 dessinée
    const [rendering, setRendering] = useState(false)

    // 2e loader : pages réellement dessinées
    const [bgProgress, setBgProgress] = useState({ done: 0, total: 0 })
    const [bgDone, setBgDone] = useState(false)
    const [bgHidden, setBgHidden] = useState(false)

    const [error, setError] = useState<string | null>(null)
    const [docxHtml, setDocxHtml] = useState('')
    const [imageUrl, setImageUrl] = useState<string | null>(null)

    // zoom 1 = page ENTIÈRE visible
    const [zoom, setZoom] = useState(1)
    const [box, setBox] = useState({ w: 0, h: 0 })
    const [dims, setDims] = useState<Dim[]>([])
    const [visible, setVisible] = useState<number[]>([])
    const [dragging, setDragging] = useState(false)

    const pagesRef = useRef<any[]>([])
    const dimsRef = useRef<Dim[]>([])
    const boxRef = useRef({ w: 0, h: 0 })
    const zoomRef = useRef(1)
    const currentRef = useRef(1)
    const pendingScrollRef = useRef<{ left: number; top: number } | null>(null)
    const renderedRef = useRef<(number | undefined)[]>([])
    const inflightRef = useRef<({ target: number; task: any; promise?: Promise<void> } | undefined)[]>([])
    const doneSetRef = useRef<Set<number>>(new Set())
    const boxKeyRef = useRef('')
    const readyRef = useRef(false)
    const dragRef = useRef<{ x: number; y: number; l: number; t: number } | null>(null)

    const onPageChangeRef = useRef(onPageChange)
    onPageChangeRef.current = onPageChange
    const scrollLockRef = useRef(0) // évite que le scroll écrase une page demandée par le bas

    boxRef.current = box
    dimsRef.current = dims
    currentRef.current = currentPage

    // taille de base d'une page (page entière visible)
    const fitBase = (i: number) => {
      const d = dimsRef.current[i]
      const b = boxRef.current
      if (!d || !b.w || !b.h) return 1
      return Math.max(0.05, Math.min((b.w - PAD * 2) / d.w, (b.h - PAD * 2) / d.h))
    }

    // ── Zoom centré sur un point écran ──
    const applyZoom = useCallback((next: number, cx?: number, cy?: number) => {
      const el = scrollRef.current
      const old = zoomRef.current
      next = clamp(next)
      if (!el || Math.abs(next - old) < 0.0001) return
      const rect = el.getBoundingClientRect()
      const px = (cx ?? rect.left + rect.width / 2) - rect.left
      const py = (cy ?? rect.top + rect.height / 2) - rect.top
      const ratio = next / old
      pendingScrollRef.current = {
        left: (el.scrollLeft + px) * ratio - px,
        top: (el.scrollTop + py) * ratio - py,
      }
      zoomRef.current = next
      setZoom(next)
    }, [])

    const scrollToPage = (page: number) => {
      const el = scrollRef.current
      const w = wrapperRefs.current[page - 1]
      if (!el || !w) return
      const er = el.getBoundingClientRect()
      const wr = w.getBoundingClientRect()
      el.scrollTo({
        top: el.scrollTop + (wr.top - er.top) - PAD,
        left: el.scrollLeft + (wr.left - er.left) - (er.width - wr.width) / 2,
      })
    }

    const resetView = useCallback(() => {
      zoomRef.current = 1
      setZoom(1)
      // revient au début de la page courante
      requestAnimationFrame(() => scrollToPage(currentRef.current))
    }, [])

    useLayoutEffect(() => {
      const el = scrollRef.current
      const p = pendingScrollRef.current
      if (el && p) {
        el.scrollLeft = p.left
        el.scrollTop = p.top
        pendingScrollRef.current = null
      }
    }, [zoom])

    useImperativeHandle(
      ref,
      () => ({
        goToPage: (page: number) => {
          const p = Math.max(1, Math.min(totalPages, page))
          scrollLockRef.current = Date.now() + 400
          scrollToPage(p)
          setCurrentPage(p)
        },
        scrollBy: (dx: number, dy: number) => scrollRef.current?.scrollBy(dx, dy),
        zoomBy: (factor: number, cx?: number, cy?: number) => applyZoom(zoomRef.current * factor, cx, cy),
        currentPage,
        totalPages,
      }),
      [currentPage, totalPages]
    )

    // Notifie le parent dès que le total est connu, puis à chaque changement de page
    useEffect(() => {
      if (error) return
      onPageChangeRef.current?.(currentPage, totalPages)
    }, [currentPage, totalPages, error])

    // ── Chargement du document ──
    useEffect(() => {
      let cancelled = false
      setLoading(true)
      setError(null)
      setReady(false)
      readyRef.current = false
      setRendering(false)
      setDims([])
      setVisible([])
      setBgProgress({ done: 0, total: 0 })
      setBgDone(false)
      setBgHidden(false)
      pagesRef.current = []
      renderedRef.current = []
      inflightRef.current = []
      doneSetRef.current = new Set()
      boxKeyRef.current = ''
      setDocxHtml('')
      setImageUrl(null)
      setCurrentPage(1)
      zoomRef.current = 1
      setZoom(1)

      const load = async () => {
        try {
          if (!fichierUrl) throw new Error('URL du fichier manquante')

          if (typeFichier === 'pdf') {
            const pdf = await pdfjsLib.getDocument({
              url: fichierUrl,
              cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
              cMapPacked: true,
            }).promise
            if (cancelled) return
            setTotalPages(pdf.numPages) // le parent affiche tout de suite « 1/17 »

            const pages = await Promise.all(
              Array.from({ length: pdf.numPages }, (_, k) => pdf.getPage(k + 1))
            )
            if (cancelled) return
            pagesRef.current = pages
            setBgProgress({ done: 0, total: pdf.numPages })
            setDims(
              pages.map((p) => {
                const v = p.getViewport({ scale: 1 })
                return { w: v.width, h: v.height }
              })
            )
            setLoading(false)
            return
          } else if (typeFichier === 'docx') {
            const resp = await fetch(fichierUrl)
            if (!resp.ok) throw new Error(`Erreur HTTP: ${resp.status}`)
            const buf = await resp.arrayBuffer()
            const result = await mammoth.convertToHtml({ arrayBuffer: buf })
            if (cancelled) return
            setDocxHtml(result.value)
            setTotalPages(1)
          } else if (typeFichier === 'image') {
            setImageUrl(fichierUrl)
            setTotalPages(1)
          }
          if (!cancelled) setLoading(false)
        } catch (err: any) {
          if (cancelled) return
          console.error('❌ Erreur chargement:', err)
          setError(`Impossible de charger : ${err.message || 'erreur inconnue'}`)
          setLoading(false)
        }
      }

      load()
      return () => {
        cancelled = true
      }
    }, [fichierUrl, typeFichier])

    // ── Taille du conteneur ──
    useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [typeFichier, !!error, loading])

    // ── Pages visibles (IntersectionObserver) ──
    useEffect(() => {
      const root = scrollRef.current
      if (!root || typeFichier !== 'pdf' || !dims.length) return
      const set = new Set<number>()
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const idx = Number((e.target as HTMLElement).dataset.idx)
            if (e.isIntersecting) set.add(idx)
            else set.delete(idx)
          }
          setVisible([...set].sort((a, b) => a - b))
        },
        { root, rootMargin: '300px 0px' }
      )
      wrapperRefs.current.forEach((w) => w && io.observe(w))
      return () => io.disconnect()
    }, [typeFichier, dims.length])

    // ── Page courante selon le scroll ──
    const updateCurrent = useCallback(() => {
      if (Date.now() < scrollLockRef.current) return
      const el = scrollRef.current
      if (!el) return
      const er = el.getBoundingClientRect()
      const limit = er.top + er.height / 3
      let found = 1
      wrapperRefs.current.forEach((w, i) => {
        if (w && w.getBoundingClientRect().top <= limit) found = i + 1
      })
      if (found !== currentRef.current) setCurrentPage(found)
    }, [])

    useEffect(() => {
      const el = scrollRef.current
      if (!el || typeFichier !== 'pdf') return
      let raf = 0
      const onScroll = () => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(updateCurrent)
      }
      el.addEventListener('scroll', onScroll, { passive: true })
      return () => {
        cancelAnimationFrame(raf)
        el.removeEventListener('scroll', onScroll)
      }
    }, [typeFichier, updateCurrent, loading, !!error])

    // ── Rendu d'UNE page (annulable, canvas hors-écran => pas de flash) ──
    const renderPage = useCallback((i: number, target: number): Promise<void> => {
      const page = pagesRef.current[i]
      const canvas = canvasRefs.current[i]
      if (!page || !canvas) return Promise.resolve()

      const cur = inflightRef.current[i]
      if (cur && Math.abs(cur.target - target) < 0.001 && cur.promise) return cur.promise
      cur?.task?.cancel()

      const entry: { target: number; task: any; promise?: Promise<void> } = { target, task: null }
      entry.promise = (async () => {
        try {
          const dpr = window.devicePixelRatio || 1
          const vp1 = page.getViewport({ scale: 1 })
          let scale = fitBase(i) * target * dpr
          const px = vp1.width * vp1.height * scale * scale
          if (px > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / px)
          const vp = page.getViewport({ scale })

          const off = document.createElement('canvas')
          off.width = Math.max(1, Math.floor(vp.width))
          off.height = Math.max(1, Math.floor(vp.height))
          const task = page.render({ canvasContext: off.getContext('2d')!, viewport: vp })
          entry.task = task
          await task.promise
          if (inflightRef.current[i] !== entry) return

          canvas.width = off.width
          canvas.height = off.height
          canvas.getContext('2d')!.drawImage(off, 0, 0)
          renderedRef.current[i] = target

          if (!doneSetRef.current.has(i)) {
            doneSetRef.current.add(i)
            setBgProgress((p) => ({ ...p, done: doneSetRef.current.size }))
          }
          if (i === 0 && !readyRef.current) {
            readyRef.current = true
            setReady(true)
          }
        } catch (err: any) {
          if (err?.name === 'RenderingCancelledException') return
          throw err
        } finally {
          if (inflightRef.current[i] === entry) inflightRef.current[i] = undefined
        }
      })()
      inflightRef.current[i] = entry
      return entry.promise
    }, [])

    // ── Orchestration : visibles d'abord (au zoom courant), puis le reste en arrière-plan ──
    useEffect(() => {
      if (typeFichier !== 'pdf' || loading || error || !dims.length || !box.w || !box.h) return

      const boxKey = `${box.w}x${box.h}`
      if (boxKeyRef.current !== boxKey) {
        boxKeyRef.current = boxKey
        renderedRef.current = []
      }

      let cancelled = false
      setRendering(true)

      const timer = setTimeout(
        async () => {
          try {
            const vis = visible.length ? visible : [0]
            const visSet = new Set(vis)

            for (const i of vis) {
              if (cancelled) return
              const r = renderedRef.current[i]
              if (r === undefined || Math.abs(r - zoom) > 0.001) await renderPage(i, zoom)
            }
            if (cancelled) return
            setRendering(false)

            // pages restantes, les plus proches de la page courante d'abord
            const cur = currentRef.current - 1
            const others = dims
              .map((_, i) => i)
              .filter((i) => !visSet.has(i))
              .sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur))
            for (const i of others) {
              if (cancelled) return
              if (renderedRef.current[i] === undefined) await renderPage(i, Math.min(zoom, 1))
            }
          } catch (err: any) {
            if (cancelled) return
            console.error('❌ Erreur rendu PDF:', err)
            setError(`Erreur de rendu : ${err.message}`)
            setRendering(false)
          }
        },
        readyRef.current ? 120 : 0
      )

      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }, [typeFichier, loading, error, dims, box.w, box.h, zoom, visible, renderPage])

    // ── Fin du chargement des pages : message "prêtes" puis disparition ──
    useEffect(() => {
      if (bgProgress.total > 1 && bgProgress.done >= bgProgress.total) {
        setBgDone(true)
        const t = setTimeout(() => setBgHidden(true), BG_DONE_VISIBLE_MS)
        return () => clearTimeout(t)
      }
    }, [bgProgress.done, bgProgress.total])

    // ── Ctrl+molette / pinch trackpad + pinch tactile ──
    useEffect(() => {
      const el = scrollRef.current
      if (!el || typeFichier !== 'pdf') return

      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return
        e.preventDefault()
        applyZoom(zoomRef.current * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY)
      }

      let startDist = 0
      let startZoom = 1
      const dist = (t: TouchList) =>
        Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          startDist = dist(e.touches)
          startZoom = zoomRef.current
        }
      }
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && startDist > 0) {
          e.preventDefault()
          const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2
          const my = (e.touches[0].clientY + e.touches[1].clientY) / 2
          applyZoom(startZoom * (dist(e.touches) / startDist), mx, my)
        }
      }
      const onTouchEnd = () => {
        startDist = 0
      }

      el.addEventListener('wheel', onWheel, { passive: false })
      el.addEventListener('touchstart', onTouchStart, { passive: true })
      el.addEventListener('touchmove', onTouchMove, { passive: false })
      el.addEventListener('touchend', onTouchEnd)
      return () => {
        el.removeEventListener('wheel', onWheel)
        el.removeEventListener('touchstart', onTouchStart)
        el.removeEventListener('touchmove', onTouchMove)
        el.removeEventListener('touchend', onTouchEnd)
      }
    }, [typeFichier, applyZoom, !!error, loading])

    // ── Glisser pour déplacer (souris) ──
    const onMouseDown = (e: React.MouseEvent) => {
      const el = scrollRef.current
      if (!el || e.button !== 0) return
      dragRef.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop }
      setDragging(true)
    }
    const onMouseMove = (e: React.MouseEvent) => {
      const el = scrollRef.current
      const d = dragRef.current
      if (!el || !d) return
      el.scrollLeft = d.l - (e.clientX - d.x)
      el.scrollTop = d.t - (e.clientY - d.y)
    }
    const endDrag = () => {
      dragRef.current = null
      setDragging(false)
    }

    // ── Erreur ──
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-900 p-8">
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 max-w-md text-center">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )
    }

    // ── DOCX ──
    if (typeFichier === 'docx') {
      if (loading) return <Loader label="Chargement du document…" />
      return (
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          <div className="p-8 max-w-4xl mx-auto prose" dangerouslySetInnerHTML={{ __html: docxHtml }} />
        </div>
      )
    }

    // ── Image ──
    if (typeFichier === 'image') {
      if (loading) return <Loader label="Chargement de l'image…" />
      return (
        <div className="flex-1 min-h-0 flex items-center justify-center bg-neutral-900 overflow-auto">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Document"
              className="max-w-full max-h-full object-contain"
              draggable={false}
              onError={() => setError('Image introuvable')}
            />
          )}
        </div>
      )
    }

    // ── PDF ──
    const showOverlay = loading || !ready
    const showBg = !showOverlay && bgProgress.total > 1 && !bgHidden
    const bgPct = bgProgress.total ? Math.round((bgProgress.done / bgProgress.total) * 100) : 0

    return (
      <div className="relative flex-1 min-h-0 min-w-0 w-full h-full flex flex-col bg-neutral-900">
        {/* Barre de zoom FIXE + 2e loader */}
        <div className="shrink-0 z-20 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-3 py-2 bg-neutral-800 border-b border-neutral-700">
          <button
            onClick={() => applyZoom(zoomRef.current / ZOOM_FACTOR)}
            disabled={zoom <= MIN_ZOOM + 0.001}
            className="w-8 h-8 rounded-full bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 text-white flex items-center justify-center text-lg transition"
            title="Dézoomer"
          >
            −
          </button>
          <span className="text-white text-sm font-mono w-16 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => applyZoom(zoomRef.current * ZOOM_FACTOR)}
            disabled={zoom >= MAX_ZOOM - 0.001}
            className="w-8 h-8 rounded-full bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 text-white flex items-center justify-center text-lg transition"
            title="Zoomer"
          >
            +
          </button>
          <button
            onClick={resetView}
            className="px-3 h-8 rounded-full bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-medium transition"
            title="Page entière"
          >
            Reset
          </button>

          {showBg && (
            <div
              className={`flex items-center gap-2 px-3 h-8 rounded-full text-xs border transition-colors ${
                bgDone
                  ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
                  : 'bg-indigo-900/40 border-indigo-700 text-indigo-200'
              }`}
              title={bgDone ? 'Toutes les pages sont chargées' : 'Chargement des autres pages en cours'}
            >
              {bgDone ? (
                <>
                  <span className="text-sm leading-none">✓</span>
                  <span className="whitespace-nowrap">Toutes les pages prêtes</span>
                </>
              ) : (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-indigo-700 border-t-indigo-300 rounded-full animate-spin" />
                  <span className="whitespace-nowrap">
                    Chargement des pages {bgProgress.done}/{bgProgress.total}
                  </span>
                  <div className="w-14 h-1.5 bg-indigo-950 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 transition-all" style={{ width: `${bgPct}%` }} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Zone scrollable : TOUTES les pages empilées */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-auto flex"
          style={{
            cursor: dragging ? 'grabbing' : 'grab',
            touchAction: 'pan-x pan-y',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          <div
            className="m-auto shrink-0 flex flex-col items-center"
            style={{ padding: PAD, gap: PAGE_GAP }}
          >
            {dims.map((d, i) => {
              const base = fitBase(i)
              return (
                <div
                  key={i}
                  data-idx={i}
                  ref={(el) => {
                    wrapperRefs.current[i] = el
                  }}
                  className="bg-white shadow-2xl shrink-0"
                  style={{ width: d.w * base * zoom, height: d.h * base * zoom }}
                >
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[i] = el
                    }}
                    className="block select-none"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Mini spinner pendant un re-rendu (zoom) */}
        {!showOverlay && rendering && (
          <div className="absolute bottom-4 left-4 z-10 w-6 h-6 border-2 border-neutral-600 border-t-indigo-500 rounded-full animate-spin" />
        )}

        {/* Loader plein écran : jusqu'à l'affichage de la page 1 */}
        {showOverlay && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-neutral-900">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-neutral-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-neutral-400 text-sm">Chargement du document…</p>
            </div>
          </div>
        )}
      </div>
    )
  }
)

function Loader({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-neutral-900">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-neutral-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-neutral-400 text-sm">{label}</p>
      </div>
    </div>
  )
}

DocumentViewer.displayName = 'DocumentViewer'
export default DocumentViewer


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


// components/classroom/PresentationMode.tsx
import { useState, useRef, useEffect, useMemo } from 'react'
import { useGetLivresClasseQuery } from '../../store/apiSlice'
import { usePresentation } from '../../hooks/usePresentation'
import { usePartage } from '../../context/PartageContext'
import DocumentViewer, { DocumentViewerHandle } from './DocumentViewer'
import AnnotationCanvas from './AnnotationCanvas'

interface Props {
  classeId: string
  seanceId: string
  role: 'eleve' | 'professeur' | 'admin' | 'direction'
  userId?: string
  userName?: string
}

export default function PresentationMode({
  classeId, seanceId, role, userId, userName
}: Props) {
  const { data } = useGetLivresClasseQuery({ classe_id: classeId })
  const livres = (data?.results ?? data ?? []) as any[]

  // Queue d'événements d'annotation à appliquer
  const [annoEvents, setAnnoEvents] = useState<any[]>([])
  const pushAnnoEvent = (evt: any) => setAnnoEvents(prev => [...prev, evt])
  const clearAnnoEvents = () => setAnnoEvents([])

  const { state, send, startPresentation, goToPage, stopPresentation } = usePresentation(
    classeId, seanceId, pushAnnoEvent
  )
  const partage = usePartage()
  const viewerRef = useRef<DocumentViewerHandle>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const isPresenter = role === 'professeur'
  const isPresenting = !!state.livreId

  const [selectedLivreId, setSelectedLivreId] = useState<string | null>(null)
  const livre = useMemo(
    () => livres.find(l => l.id === (state.livreId || selectedLivreId)),
    [livres, state.livreId, selectedLivreId]
  )

  const [localPage, setLocalPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)   // ← état, alimenté par le viewer
  const currentPage = isPresenting ? state.page : localPage

const readyLivres = useMemo(
  () => livres.filter(l => ['pdf', 'image', 'docx'].includes(l.type_fichier)),
  [livres]
)

  // ── Navigation clavier ──
  useEffect(() => {
    if (!isPresenter || !livre) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        const next = Math.min(currentPage + 1, totalPages)
        if (isPresenting) goToPage(next)
        else { setLocalPage(next); viewerRef.current?.goToPage(next) }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        const prev = Math.max(1, currentPage - 1)
        if (isPresenting) goToPage(prev)
        else { setLocalPage(prev); viewerRef.current?.goToPage(prev) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isPresenter, livre, currentPage, totalPages, isPresenting, goToPage])

  // ── Sync viewer ↔ state WS ──
  useEffect(() => {
    if (isPresenting && viewerRef.current) {
      viewerRef.current.goToPage(state.page)
    }
  }, [state.page, isPresenting])

  // ── La molette traverse le calque d'annotation et agit sur le document ──
  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        viewerRef.current?.zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY)
      } else {
        viewerRef.current?.scrollBy(e.deltaX, e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [livre?.id])

  useEffect(() => { partage.markAsSeen('editeur') }, [])

  const syncedRef = useRef(false)
    useEffect(() => { syncedRef.current = false }, [livre?.id])
    
    const handleViewerPageChange = (page: number, total: number) => {
      setTotalPages(total)
      setLocalPage(page)
    
      // Le prof qui défile pendant la présentation entraîne la classe avec lui.
      // On ignore la 1re notification complète (chargement) pour ne pas écraser la page en cours.
      if (total > 1 && !syncedRef.current) { syncedRef.current = true; return }
      if (isPresenter && isPresenting && total > 1 && page !== state.page) goToPage(page)
    }
  
  const handleStartPresenting = () => {
    if (!livre || !userId) return
    startPresentation(livre.id, totalPages, userId, userName)
    setLocalPage(1)
    viewerRef.current?.goToPage(1)
  }

  const handleStopPresenting = () => {
    stopPresentation()
  }

  const handleLocalPageChange = (page: number) => {
    setLocalPage(page)
    viewerRef.current?.goToPage(page)
  }
console.log('📚 Livre sélectionné:', livre)
  // ── Écran de sélection ──
  if (!livre) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-neutral-900 text-white p-8 overflow-y-auto">
        <div className="max-w-3xl w-full">
          <h2 className="text-2xl font-bold mb-2 text-center">🎬 Mode Présentation</h2>
          <p className="text-neutral-400 text-center mb-8">
            {isPresenter
              ? 'Sélectionnez un document à projeter à la classe'
              : 'En attente du document du professeur...'}
          </p>

          {isPresenter && readyLivres.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {readyLivres.map((l: any) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLivreId(l.id)}
                  className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-indigo-500 rounded-xl p-4 text-left transition group"
                >
                  <div className="text-3xl mb-2">
                    
                      {l.type_fichier === 'pdf' ? '📕' : l.type_fichier === 'docx' ? '📄' : '🖼️'}
                  </div>
                  <p className="font-semibold text-sm truncate group-hover:text-indigo-300">{l.titre}</p>
                  <p className="text-xs text-neutral-400 mt-1">{l.type_fichier.toUpperCase()}</p>
                </button>
              ))}
            </div>
          )}

          {isPresenter && readyLivres.length === 0 && (
            <div className="text-center bg-neutral-800 rounded-xl p-8 border border-neutral-700">
              <p className="text-neutral-300">Aucun document prêt.</p>
              <p className="text-sm text-neutral-500 mt-2">
                Importez des PDF/PPTX/DOCX/Images dans l'onglet "Livres" d'abord.
              </p>
            </div>
          )}

          {!isPresenter && !isPresenting && (
            <div className="text-center bg-neutral-800 rounded-xl p-8 border border-neutral-700">
              <div className="text-5xl mb-3">⏳</div>
              <p className="text-neutral-300">Le professeur n'a pas encore démarré la présentation.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Écran de présentation ──
  return (
    <div className="flex-1 flex flex-col bg-neutral-950 relative overflow-hidden">
      {/* Bandeau info */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl flex-shrink-0">
            {livre.type_fichier === 'pdf' ? '📕' : livre.type_fichier === 'docx' ? '📄' :
             livre.type_fichier === 'pptx' ? '📊' : '🖼️'}
          </span>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{livre.titre}</p>
            {isPresenting && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {state.byUserName || 'Présentation en direct'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isPresenter && (
            <>
              {!isPresenting ? (
                <button
                  onClick={handleStartPresenting}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  📡 Partager à la classe
                </button>
              ) : (
                <button
                  onClick={handleStopPresenting}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition"
                >
                  ⏹ Arrêter
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setSelectedLivreId(null)}
            className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-xs rounded-lg transition"
          >
            ↩ Changer
          </button>
        </div>
      </div>

      {/* Zone de projection */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        {/* Document en fond */}
        <DocumentViewer
          ref={viewerRef}
          fichierUrl={livre.fichier_url}
          typeFichier={livre.type_fichier}
          onPageChange={handleViewerPageChange}
        />
        
        {/* Overlay d'annotations — INDÉPENDANT du tableau blanc */}
        <div ref={overlayRef} className="absolute inset-0 pointer-events-none">
        <AnnotationCanvas
          pageKey={`${livre.id}-${currentPage}`}
          isPresenter={isPresenter}
          send={send}
          remoteEvents={annoEvents}
          onEventConsumed={clearAnnoEvents}
        />
        </div>
      </div>

      {/* Barre de navigation */}
      <div className="bg-neutral-900 border-t border-neutral-800 px-4 py-3 flex items-center justify-center gap-4 flex-shrink-0 z-20">
        <button
          onClick={() => {
            const p = Math.max(1, currentPage - 1)
            if (isPresenting) goToPage(p)
            else handleLocalPageChange(p)
          }}
          disabled={currentPage <= 1}
          className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-lg transition flex items-center justify-center"
        >
          ◀
        </button>

        <div className="flex items-center gap-2 text-white">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => {
              const p = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1))
              if (isPresenting) goToPage(p)
              else handleLocalPageChange(p)
            }}
            className="w-14 text-center bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
          />
          <span className="text-neutral-400 text-sm">/ {totalPages}</span>
        </div>

        <button
          onClick={() => {
            const p = Math.min(totalPages, currentPage + 1)
            if (isPresenting) goToPage(p)
            else handleLocalPageChange(p)
          }}
          disabled={currentPage >= totalPages}
          className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-lg transition flex items-center justify-center"
        >
          ▶
        </button>

        <div className="ml-4 text-xs text-neutral-500 hidden md:block">
          ⌨️ Utilisez ← → pour naviguer
        </div>
      </div>
    </div>
  )
}
