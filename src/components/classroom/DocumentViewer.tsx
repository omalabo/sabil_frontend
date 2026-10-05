// components/classroom/DocumentViewer.tsx
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// ✅ Worker PDF.js stable
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
    const [isRendering, setIsRendering] = useState(false) // 🆕 État pour le rendu de la page
    const [error, setError] = useState<string | null>(null)
    const [docxHtml, setDocxHtml] = useState<string>('')
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    
    // 🆕 État pour le zoom (1.0 = 100%, 1.5 = 150%, etc.)
    const [zoom, setZoom] = useState(1.0)

    const pdfDocRef = useRef<any>(null)
    const renderingRef = useRef(false)

    useImperativeHandle(ref, () => ({
      goToPage: (page: number) => {
        const p = Math.max(1, Math.min(totalPages, page))
        setCurrentPage(p)
        setZoom(1.0) // 🆕 Reset du zoom quand on change de page
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
      setZoom(1.0)

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
        setIsRendering(true) // 🆕 Affiche le spinner de rendu

        try {
          const page = await pdfDocRef.current.getPage(currentPage)
          const viewport = page.getViewport({ scale: 1 })
          
          // 1. Calcul du scale de base pour s'adapter au conteneur
          const containerWidth = container.clientWidth || window.innerWidth * 0.9
          const containerHeight = container.clientHeight || window.innerHeight * 0.7
          const baseScale = Math.min(
            containerWidth / viewport.width,
            containerHeight / viewport.height
          )
          
          // 2. Application du zoom utilisateur
          const finalScale = baseScale * zoom
          const scaledViewport = page.getViewport({ scale: finalScale })

          // 3. 🆕 CORRECTION DU FLOU : Gestion du Device Pixel Ratio (Retina/High DPI)
          const pixelRatio = window.devicePixelRatio || 1
          canvas.width = scaledViewport.width * pixelRatio
          canvas.height = scaledViewport.height * pixelRatio
          
          // On force la taille CSS pour qu'elle corresponde à la taille logique
          canvas.style.width = `${scaledViewport.width}px`
          canvas.style.height = `${scaledViewport.height}px`

          const ctx = canvas.getContext('2d')!
          ctx.scale(pixelRatio, pixelRatio) // 🆕 Indispensable pour la netteté

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
          setIsRendering(false) // 🆕 Cache le spinner
        }
      }

      render()
    }, [currentPage, loading, error, typeFichier, zoom]) // 🆕 Ajout de 'zoom' aux dépendances

    // ── Affichage : Chargement initial ──
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-900">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-neutral-700 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-neutral-400 text-sm">Chargement du document…</p>
          </div>
        </div>
      )
    }

    // ── Affichage : Erreur ──
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

    // ── Affichage : PDF ──
    return (
      <div
        ref={containerRef}
        className="flex-1 flex flex-col bg-neutral-900 overflow-auto" // 🆕 overflow-auto pour permettre le scroll si on zoom beaucoup
      >
        {/* 🆕 Barre de contrôle du Zoom */}
        <div className="sticky top-0 z-20 flex items-center justify-center gap-3 py-2 bg-neutral-800/90 backdrop-blur border-b border-neutral-700">
          <button 
            onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
            className="w-8 h-8 rounded-full bg-neutral-700 hover:bg-neutral-600 text-white flex items-center justify-center text-lg transition"
            title="Dézoomer"
          >−</button>
          
          <span className="text-white text-sm font-mono w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          
          <button 
            onClick={() => setZoom(z => Math.min(3.0, Number((z + 0.25).toFixed(2))))}
            className="w-8 h-8 rounded-full bg-neutral-700 hover:bg-neutral-600 text-white flex items-center justify-center text-lg transition"
            title="Zoomer"
          >+</button>

          <button 
            onClick={() => setZoom(1.0)}
            className="px-3 h-8 rounded-full bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-medium transition"
            title="Taille réelle"
          >Reset</button>
        </div>

        {/* Zone du Canvas */}
        <div className="flex-1 flex items-center justify-center p-4 relative">
          {/* 🆕 Spinner de rendu de page */}
          {isRendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm z-10">
              <div className="w-8 h-8 border-3 border-neutral-600 border-t-indigo-500 rounded-full animate-spin" />
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
