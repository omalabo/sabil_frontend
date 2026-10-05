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
const MAX_ZOOM = 1.5 // 150%
const ZOOM_FACTOR = 1.25
const PAD = 16
const MAX_CANVAS_PIXELS = 16_000_000

const clamp = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v))

const DocumentViewer = forwardRef<DocumentViewerHandle, Props>(
  ({ fichierUrl, typeFichier, onPageChange }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true) // true jusqu'à ce que la page 1 soit prête
    const [ready, setReady] = useState(false) // 1er rendu terminé
    const [rendering, setRendering] = useState(false)
    const [bgProgress, setBgProgress] = useState({ done: 0, total: 0 }) // préchargement des autres pages
    const [error, setError] = useState<string | null>(null)
    const [docxHtml, setDocxHtml] = useState('')
    const [imageUrl, setImageUrl] = useState<string | null>(null)

    // zoom 1 = page ENTIÈRE visible (fit page)
    const [zoom, setZoom] = useState(1)
    const [box, setBox] = useState({ w: 0, h: 0 })
    const [pageSize, setPageSize] = useState<{ n: number; w: number; h: number; base: number } | null>(null)
    const [dragging, setDragging] = useState(false)

    const pdfDocRef = useRef<any>(null)
    const zoomRef = useRef(1)
    const pendingScrollRef = useRef<{ left: number; top: number } | null>(null)
    const renderTaskRef = useRef<any>(null)
    const readyRef = useRef(false)
    const dragRef = useRef<{ x: number; y: number; l: number; t: number } | null>(null)

    // ── Zoom centré sur un point écran (par défaut le centre de la vue) ──
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

    const resetView = useCallback(() => {
      zoomRef.current = 1
      pendingScrollRef.current = { left: 0, top: 0 }
      setZoom(1)
      scrollRef.current?.scrollTo(0, 0)
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
          if (p === currentPage) return
          // le zoom est conservé, on remonte juste en haut de la page
          scrollRef.current?.scrollTo({ top: 0 })
          setCurrentPage(p)
        },
        currentPage,
        totalPages,
      }),
      [currentPage, totalPages]
    )

    useEffect(() => {
      if (!loading && !error) onPageChange?.(currentPage, totalPages)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, totalPages, loading, error])

    // ── Chargement du document ──
    useEffect(() => {
      let cancelled = false
      setLoading(true)
      setError(null)
      setReady(false)
      readyRef.current = false
      setRendering(false)
      setPageSize(null)
      setBgProgress({ done: 0, total: 0 })
      pdfDocRef.current = null
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
            pdfDocRef.current = pdf
            setTotalPages(pdf.numPages)

            // 1) Page 1 d'abord : c'est elle qui débloque l'affichage
            const first = await pdf.getPage(1)
            await first.getOperatorList()
            if (cancelled) return
            setLoading(false)

            // 2) Les autres pages en arrière-plan (2e loader)
            setBgProgress({ done: 1, total: pdf.numPages })
            for (let i = 2; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i)
              await page.getOperatorList() // retire cette ligne si PDF énorme
              if (cancelled) return
              setBgProgress({ done: i, total: pdf.numPages })
            }
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

    // ── Taille du conteneur (largeur + hauteur) ──
    useEffect(() => {
      const el = scrollRef.current
      if (!el) return
      const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [typeFichier, !!error, loading])

    // ── Taille de base = PAGE ENTIÈRE visible (min largeur / hauteur) ──
    useEffect(() => {
      if (typeFichier !== 'pdf' || loading || !box.w || !box.h || !pdfDocRef.current) return
      let cancelled = false
      ;(async () => {
        try {
          const page = await pdfDocRef.current.getPage(currentPage)
          if (cancelled) return
          const vp = page.getViewport({ scale: 1 })
          const base = Math.max(
            0.05,
            Math.min((box.w - PAD * 2) / vp.width, (box.h - PAD * 2) / vp.height)
          )
          setPageSize({ n: currentPage, w: vp.width * base, h: vp.height * base, base })
        } catch (e) {
          /* ignore */
        }
      })()
      return () => {
        cancelled = true
      }
    }, [typeFichier, loading, box.w, box.h, currentPage])

    // ── Rendu net (debounced, annulable, canvas hors-écran => pas de flash) ──
    useEffect(() => {
      if (typeFichier !== 'pdf' || loading || error || !pageSize) return
      if (pageSize.n !== currentPage) return // taille de la page précédente, on attend
      let cancelled = false

      setRendering(true)
      const timer = setTimeout(async () => {
        try {
          const page = await pdfDocRef.current.getPage(currentPage)
          if (cancelled) return
          const canvas = canvasRef.current
          if (!canvas) return
          renderTaskRef.current?.cancel()

          const dpr = window.devicePixelRatio || 1
          const vp1 = page.getViewport({ scale: 1 })
          let scale = pageSize.base * zoom * dpr
          const px = vp1.width * vp1.height * scale * scale
          if (px > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / px)
          const vp = page.getViewport({ scale })

          const off = document.createElement('canvas')
          off.width = Math.max(1, Math.floor(vp.width))
          off.height = Math.max(1, Math.floor(vp.height))
          const task = page.render({ canvasContext: off.getContext('2d')!, viewport: vp })
          renderTaskRef.current = task
          await task.promise
          if (cancelled) return

          canvas.width = off.width
          canvas.height = off.height
          canvas.getContext('2d')!.drawImage(off, 0, 0)
          readyRef.current = true
          setReady(true)
          setRendering(false)
        } catch (err: any) {
          if (err?.name === 'RenderingCancelledException') return
          if (cancelled) return
          console.error('❌ Erreur rendu PDF:', err)
          setError(`Erreur de rendu : ${err.message}`)
          setRendering(false)
        }
      }, readyRef.current ? 120 : 0)

      return () => {
        cancelled = true
        clearTimeout(timer)
        renderTaskRef.current?.cancel()
      }
    }, [typeFichier, loading, error, pageSize, zoom, currentPage])

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
    const bgLoading = !loading && bgProgress.total > 1 && bgProgress.done < bgProgress.total
    const bgPct = bgProgress.total ? Math.round((bgProgress.done / bgProgress.total) * 100) : 0

    return (
      <div className="relative flex-1 min-h-0 min-w-0 w-full h-full flex flex-col bg-neutral-900">
        {/* Barre de zoom FIXE */}
        <div className="relative shrink-0 z-20 flex items-center justify-center gap-3 py-2 bg-neutral-800 border-b border-neutral-700">
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

          {/* 2e loader : pages restantes en arrière-plan */}
          {bgLoading && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-700/80 text-neutral-200 text-xs"
              title="Chargement des autres pages en cours"
            >
              <div className="w-3.5 h-3.5 border-2 border-neutral-500 border-t-indigo-400 rounded-full animate-spin" />
              <span className="whitespace-nowrap">
                Pages {bgProgress.done}/{bgProgress.total}
              </span>
              <div className="hidden sm:block w-14 h-1 bg-neutral-600 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 transition-all" style={{ width: `${bgPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Zone scrollable */}
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
          {/* m-auto = centré sans jamais couper le contenu quand ça déborde */}
          <div className="m-auto shrink-0" style={{ padding: PAD }}>
            <canvas
              ref={canvasRef}
              className="shadow-2xl bg-white block select-none"
              style={{
                width: pageSize ? pageSize.w * zoom : 0,
                height: pageSize ? pageSize.h * zoom : 0,
              }}
            />
          </div>
        </div>

        {/* Mini spinner pendant un re-rendu (zoom / changement de page) */}
        {!showOverlay && rendering && (
          <div className="absolute top-14 right-4 z-10 w-6 h-6 border-2 border-neutral-600 border-t-indigo-500 rounded-full animate-spin" />
        )}

        {/* Loader plein écran : seulement jusqu'à l'affichage de la 1re page */}
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
