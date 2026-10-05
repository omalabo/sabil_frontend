// components/classroom/DocumentViewer.tsx
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// ✅ CORRECTION : Utiliser le worker depuis CDN (pas le fichier bundlé Vite)


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
    const [error, setError] = useState<string | null>(null)
    const [docxHtml, setDocxHtml] = useState<string>('')
    const [imageUrl, setImageUrl] = useState<string | null>(null)

    const pdfDocRef = useRef<any>(null)
    const renderingRef = useRef(false)

    console.log('📥 DocumentViewer props:', { fichierUrl, typeFichier })

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
      setImageUrl(null)

      const load = async () => {
        try {
          console.log('📄 Chargement document:', { fichierUrl, typeFichier })

          // ✅ Vérification que fichierUrl existe
          if (!fichierUrl) {
            throw new Error('URL du fichier manquante')
          }

          if (typeFichier === 'pdf') {
            console.log(' Chargement PDF...')
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
            console.log('✅ PDF chargé:', pdf.numPages, 'pages')
          }
          else if (typeFichier === 'docx') {
            console.log('📄 Chargement DOCX...')
            const resp = await fetch(fichierUrl)
            if (!resp.ok) throw new Error(`Erreur HTTP: ${resp.status}`)
            const buf = await resp.arrayBuffer()
            console.log('📦 Buffer DOCX:', buf.byteLength, 'bytes')
            const result = await mammoth.convertToHtml({ arrayBuffer: buf })
            if (cancelled) return
            console.log('✅ DOCX converti:', result.value.length, 'caractères')
            setDocxHtml(result.value)
            setTotalPages(1)
            setCurrentPage(1)
            onPageChange?.(1, 1)
          }
          else if (typeFichier === 'image') {
            console.log('🖼️ Chargement image...')
            // Pour les images, on utilise directement l'URL
            setImageUrl(fichierUrl)
            setTotalPages(1)
            setCurrentPage(1)
            onPageChange?.(1, 1)
            console.log('✅ Image prête:', fichierUrl)
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

        try {
          const ctx = canvas.getContext('2d')!
          // 🆕 Utilise la taille du conteneur ou de la fenêtre avec une marge
          const containerWidth = container.clientWidth || window.innerWidth * 0.9
          const containerHeight = container.clientHeight || window.innerHeight * 0.7

          if (pdfDocRef.current) {
            const page = await pdfDocRef.current.getPage(currentPage)
            const viewport = page.getViewport({ scale: 1 })
            
            // 🆕 Calcul du scale pour remplir l'écran (agrandi)
            const scale = Math.min(
              containerWidth / viewport.width,
              containerHeight / viewport.height
            ) * 1.8  // ← Facteur d'agrandissement (1.5 à 2.0 selon ton écran)
            
            const scaledViewport = page.getViewport({ scale })

            canvas.width = scaledViewport.width
            canvas.height = scaledViewport.height
            canvas.style.width = '100%'
            canvas.style.height = 'auto'
            
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            await page.render({
              canvasContext: ctx,
              viewport: scaledViewport,
            }).promise
            
            console.log('✅ PDF rendu:', { 
              pageWidth: viewport.width, 
              scale, 
              canvasWidth: canvas.width,
              canvasHeight: canvas.height 
            })
          }
        } catch (err: any) {
          console.error('❌ Erreur rendu PDF:', err)
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
      console.log('📄 Rendu DOCX HTML')
      return (
        <div ref={containerRef} className="flex-1 overflow-auto bg-white">
          <div
            className="p-8 max-w-4xl mx-auto prose"
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        </div>
      )
    }

    // ── Image ──
    if (typeFichier === 'image') {
      console.log('🖼️ Rendu image:', imageUrl)
      return (
        <div ref={containerRef} className="flex-1 flex items-center justify-center bg-neutral-900 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Document"
              className="max-w-full max-h-full object-contain"
              draggable={false}
              onError={(e) => {
                console.error(' Erreur affichage image:', e)
                setError("Image introuvable")
              }}
              onLoad={() => {
                console.log('✅ Image chargée avec succès')
              }}
            />
          ) : (
            <p className="text-neutral-400">Chargement de l'image...</p>
          )}
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
