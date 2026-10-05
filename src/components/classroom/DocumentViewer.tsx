// components/classroom/DocumentViewer.tsx
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// ✅ Worker PDF.js stable (v3.11.174)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

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

const DocumentViewer = forwardRef<DocumentViewerHandle, Props>(
  ({ fichierUrl, typeFichier, onPageChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [isRendering, setIsRendering] = useState(false) // 🆕 État de rendu canvas
    const [error, setError] = useState<string | null>(null)
    const [docxHtml, setDocxHtml] = useState<string>('')
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    
    // 🆕 Zoom par défaut à 1.5 (150%) pour que ce ne soit pas "trop petit"
    const [zoom, setZoom] = useState(1.5)

    const pdfDocRef = useRef<any>(null)
    const renderingRef = useRef(false)

    useImperativeHandle(ref, () => ({
      goToPage: (page: number) => {
        const p = Math.max(1, Math.min(totalPages, page))
        setCurrentPage(p)
        // 🆕 CORRECTION : On NE réinitialise PAS le zoom quand on change de page
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
      setImageUrl(null)

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
            setCurrentPage(1)
            onPageChange?.(1, pdf.numPages)
          }
          else if (typeFichier === 'docx') {
            const resp = await fetch(fichierUrl)
            if (!resp.ok) throw new Error(`Erreur HTTP: ${resp.status}`)
            const buf = await resp.arrayBuffer()
            const result = await mammoth.convertToHtml({ arrayBuffer: buf })
            if (cancelled) return
            setDocxHtml(result.value)
            setTotalPages(1)
            setCurrentPage(1)
            onPageChange?.(1, 1)
          }
          else if (typeFichier === 'image') {
            setImageUrl(fichierUrl)
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

    // ── Rendu de la page courante (PDF uniquement) ──
    useEffect(() => {
      if (loading || error || typeFichier !== 'pdf') return

      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const render = async () => {
        if (renderingRef.current) return
        renderingRef.current = true
        setIsRendering(true) // 🆕 Déclenche le loader de rendu

        try {
          const page = await pdfDocRef.current.getPage(currentPage)
          const viewport = page.getViewport({ scale: 1 })
          
          // 🆕 Calcul : on s'adapte à la largeur du conteneur, puis on applique le zoom utilisateur
          const containerWidth = container.clientWidth || 800
          const baseScale = containerWidth / viewport.width
          const finalScale = baseScale * zoom
          
          const scaledViewport = page.getViewport({ scale: finalScale })

          // 🆕 Gestion High-DPI (Retina) pour une netteté parfaite
          const pixelRatio = window.devicePixelRatio || 1
          canvas.width = scaledViewport.width * pixelRatio
          canvas.height = scaledViewport.height * pixelRatio
          
          // On force la taille CSS pour qu'elle corresponde à la taille logique (évite les débordements)
          canvas.style.width = `${scaledViewport.width}px`
          canvas.style.height = `${scaledViewport.height}px`

          const ctx = canvas.getContext('2d')!
          ctx.scale(pixelRatio, pixelRatio)

          ctx.clearRect(0, 0, canvas.width, canvas.height)
          await page.render({
            canvasContext: ctx,
            viewport: scaledViewport,
          }).promise
          
        } catch (err: any) {
          console.error('❌ Erreur rendu PDF:', err)
          setError(`Erreur de rendu : ${err.message}`)
        } finally {
          renderingRef.current = false
          setIsRendering(false) // 🆕 Cache le loader une fois fini
        }
      }

      render()
    }, [currentPage, loading, error, typeFichier, zoom]) // 🆕 'zoom' est dans les dépendances

    // ── Gestion de la molette pour zoomer (Ctrl + Molette) ──
    const handleWheel = (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoom(z => {
          const newZoom = Number((z + delta).toFixed(1))
          return Math.max(0.5, Math.min(4.0, newZoom)) // Limité entre 50% et 400%
        })
      }
    }

    // ── Affichage : Chargement initial ou Rendu en cours ──
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-900">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-neutral-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-neutral-300 font-medium">Chargement du document…</p>
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

    // ── Affichage : DOCX ──
    if (typeFichier === 'docx') {
      return (
        <div ref={containerRef} className="flex-1 overflow-auto bg-white">
          <div className="p-8 max-w-4xl mx-auto prose" dangerouslySetInnerHTML={{ __html: docxHtml }} />
        </div>
      )
    }

    // ── Affichage : Image ──
    if (typeFichier === 'image') {
      return (
        <div ref={containerRef} className="flex-1 flex items-center justify-center bg-neutral-900 overflow-auto">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Document"
              className="max-w-full max-h-full object-contain"
              draggable={false}
              onError={() => setError("Image introuvable")}
            />
          )}
        </div>
      )
    }

    // ── Affichage : PDF (avec contrôles fixes et loader overlay) ──
    return (
      <div
        ref={containerRef}
        className="flex-1 flex flex-col bg-neutral-900 relative"
        onWheel={handleWheel} // 🆕 Capture la molette
      >
        {/* 🆕 Barre de zoom FIXE (ne bouge pas, toujours visible) */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-neutral-800/90 backdrop-blur rounded-lg p-1.5 shadow-xl border border-neutral-700">
          <button 
            onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.1).toFixed(1))))}
            className="w-8 h-8 rounded-md bg-neutral-700 hover:bg-neutral-600 text-white flex items-center justify-center text-lg transition"
            title="Dézoomer (Ctrl + Molette)"
          >−</button>
          
          <span className="text-white text-sm font-mono w-14 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          
          <button 
            onClick={() => setZoom(z => Math.min(4.0, Number((z + 0.1).toFixed(1))))}
            className="w-8 h-8 rounded-md bg-neutral-700 hover:bg-neutral-600 text-white flex items-center justify-center text-lg transition"
            title="Zoomer (Ctrl + Molette)"
          >+</button>

          <div className="w-px h-5 bg-neutral-600 mx-1" />

          <button 
            onClick={() => setZoom(1.5)} // 🆕 Reset à 150% (taille confortable)
            className="px-3 h-8 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
            title="Taille par défaut"
          >Reset</button>
        </div>

        {/* Zone de scroll et de rendu */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
          
          {/* 🆕 Overlay de chargement (couvre tout le canvas pendant le rendu) */}
          {isRendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80 backdrop-blur-sm z-20 rounded-lg">
              <div className="text-center">
                <div className="w-10 h-10 border-3 border-neutral-600 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-neutral-300 text-sm font-medium">Rendu de la page {currentPage}…</p>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="shadow-2xl transition-all duration-200"
            style={{ imageRendering: 'auto' }}
          />
        </div>
      </div>
    )
  }
)

DocumentViewer.displayName = 'DocumentViewer'
export default DocumentViewer
