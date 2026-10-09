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

    const handleLocalPageChange = (page: number) => {
    setLocalPage(page)
    viewerRef.current?.goToPage(page)
  }

  // 🆕 NOUVEAU : Sélectionne le livre ET démarre le partage automatiquement pour le prof
  const handleSelectLivre = (livreId: string) => {
    setSelectedLivreId(livreId)
    setLocalPage(1)
    
    if (isPresenter && userId) {
      // On lance le partage avec 1 page par défaut. 
      // Le vrai nombre de pages sera synchronisé automatiquement par handleViewerPageChange
      startPresentation(livreId, 1, userId, userName)
    }
  }

  const handleStopPresenting = () => {
    stopPresentation()
    setSelectedLivreId(null) // 🆕 On désélectionne pour revenir à la grille de choix
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
                  onClick={() => handleSelectLivre(l.id)}
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
    <div className="flex-1 min-h-0 h-full flex flex-col bg-neutral-950 relative overflow-hidden">
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
     <div className="flex-1 min-h-0 relative overflow-hidden bg-black" style={{ contain: 'layout paint' }}>
      {/* Document en fond : sorti du flux, il ne peut plus pousser les barres */}
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
        {/* Document en fond */}
        <DocumentViewer
          ref={viewerRef}
          fichierUrl={livre.fichier_url}
          typeFichier={livre.type_fichier}
          onPageChange={handleViewerPageChange}
        />
      </div>
        
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
      <div className="relative z-30 bg-neutral-900 border-t border-neutral-800 px-4 py-3 flex items-center justify-center gap-4 flex-shrink-0"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
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
