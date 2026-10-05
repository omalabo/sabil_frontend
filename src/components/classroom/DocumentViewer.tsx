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
