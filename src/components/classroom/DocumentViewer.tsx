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

    const scrollToPage = (page: number) => {
      const el = scrollRef.current
      const w = wrapperRefs.current[page - 1]
      if (!el || !w) return
      const er = el.getBoundingClientRect()
      const wr = w.getBoundingClientRect()
      el.scrollTo({ top: el.scrollTop + (wr.top - er.top) - PAD, left: el.scrollLeft + (wr.left - er.left) - (er.width - wr.width) / 2 })
    }

    useImperativeHandle(
      ref,
      () => ({
        goToPage: (page: number) => {
          const p = Math.max(1, Math.min(totalPages, page))
          scrollToPage(p)
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

    // ──
