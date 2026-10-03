// components/classroom/DocumentViewer.tsx
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// ❌ SUPPRIMER : import pptxjs from 'pptxjs'

// Worker PDF.js via CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export interface DocumentViewerHandle {
  goToPage: (page: number) => void
  currentPage: number
  totalPages: number
}

interface Props {
  fichierUrl: string
  typeFichier: 'pdf' | 'docx' | 'image'  // 🆕 PPTX retiré
  onPageChange?: (page: number, total: number) => void
}

const DocumentViewer = forwardRef<DocumentViewerHandle, Props>(
  ({ fichierUrl, typeFichier, onPageChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [docxHtml, setDocxHtml] = useState<string>('')

    const pdfDocRef = useRef<any>(null)
    const renderingRef = useRef(false)

    useImperativeHandle(ref, () => ({
      goToPage: (page: number) => {
        const p = Math.max(1, Math.min(totalPages, page))
        setCurrentPage(p)
      },
      currentPage,
      totalPages,
    }))

    // ── Chargement du document ──
    useEffect(() => {
      let cancelled = false
      setLoading(true)
      setError(null)
      pdfDocRef.current = null
      setDocxHtml('')

      const load = async () => {
        try {
          if (typeFichier === 'pdf') {
            const pdf = await pdfjsLib.getDocument({
              url: fichierUrl,
              cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
              cMapPacked: true,
            }).promise
            if (cancelled) return
            pdfDocRef.current = pdf
            setTotalPages(pdf.numPages)
            setCurrentPage(1)
            onPageChange?.(1, pdf.numPages)
          }
          else if (typeFichier === 'docx') {
            const resp = await fetch(fichierUrl)
            const buf = await resp.arrayBuffer()
            const result = await mammoth.convertToHtml({ arrayBuffer: buf })
            if (cancelled) return
            setDocxHtml(result.value)
            setTotalPages(1)
            setCurrentPage(1)
            onPageChange?.(1, 1)
          }
          else if (typeFichier === 'image') {
            setTotalPages(1)
            setCurrentPage(1)
            onPageChange?.(1, 1)
          }
        } catch (err: any) {
          console.error('❌ Erreur chargement:', err)
          setError(`Impossible de charger : ${err.message || 'erreur inconnue'}`)
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      load()
      return () => { cancelled = true }
    }, [fichierUrl, typeFichier])

    // ── Rendu de la page courante ──
    useEffect(() => {
      if (loading || error) return
      if (typeFichier === 'docx' || typeFichier === 'image') return

      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const render = async () => {
        if (renderingRef.current) return
        renderingRef.current = true

        try {
          const ctx = canvas.getContext('2d')!
          const containerWidth = container.clientWidth || 1200
          const containerHeight = container.clientHeight || 700

          if (typeFichier === 'pdf' && pdfDocRef.current) {
            const page = await pdfDocRef.current.getPage(currentPage)
            const viewport = page.getViewport({ scale: 1 })
            const scale = Math.min(
              containerWidth / viewport.width,
              containerHeight / viewport.height
            ) * 0.95
            const scaledViewport = page.getViewport({ scale })

            canvas.width = scaledViewport.width
            canvas.height = scaledViewport.height
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            await page.render({
              canvasContext: ctx,
              viewport: scaledViewport,
            }).promise
          }
        } catch (err: any) {
          console.error('❌ Erreur rendu:', err)
          setError(`Erreur de rendu : ${err.message}`)
        } finally {
          renderingRef.current = false
        }
      }

      render()
    }, [currentPage, loading, error, typeFichier])

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-900">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-neutral-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-neutral-400 text-sm">Chargement du document…</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-900 p-8">
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 max-w-md text-center">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )
    }

    // ── DOCX : HTML ──
    if (typeFichier === 'docx') {
      return (
        <div ref={containerRef} className="flex-1 overflow-auto bg-white">
          <div
            className="p-8 max-w-4xl mx-auto"
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        </div>
      )
    }

    // ── Image ──
    if (typeFichier === 'image') {
      return (
        <div ref={containerRef} className="flex-1 flex items-center justify-center bg-neutral-900 overflow-hidden">
          <img
            src={fichierUrl}
            alt="Document"
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        </div>
      )
    }

    // ── PDF : canvas ──
    return (
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-neutral-900 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full shadow-2xl"
          style={{ imageRendering: 'auto' }}
        />
      </div>
    )
  }
)

DocumentViewer.displayName = 'DocumentViewer'
export default DocumentViewer
