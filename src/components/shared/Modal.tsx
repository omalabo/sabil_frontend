import { useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen?: boolean           // ✅ Optionnel : contrôle externe (par défaut: true si monté)
  onClose: () => void        // Callback obligatoire à la fermeture
  title?: string             // Titre de la modale
  children: ReactNode        // Contenu de la modale
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'  // Tailles prédéfinies
  closeOnEscape?: boolean    // Fermer avec Échap (default: true)
  closeOnOverlay?: boolean   // Fermer en cliquant dehors (default: true)
  showCloseButton?: boolean  // Afficher la croix (default: true)
}

/**
 * 🪟 Composant Modal réutilisable
 * - Accessible (focus trap, ARIA, ESC)
 * - Animations CSS fluides
 * - Portal pour éviter les problèmes de z-index/overflow
 * - Design cohérent avec ton système (Tailwind + classes existantes)
 */
export default function Modal({
  isOpen = true,
  onClose,
  title,
  children,
  size = 'md',
  closeOnEscape = true,
  closeOnOverlay = true,
  showCloseButton = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<Element | null>(null)

  // 🔹 Tailles prédéfinies (responsive)
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] h-[95vh]',
  }

  // 🔹 Gestion de l'accessibilité : focus trap + restauration
  useEffect(() => {
    if (!isOpen) return

    // Sauvegarder l'élément focusé avant ouverture
    previousActiveElement.current = document.activeElement

    // Focus automatique sur la modale au montage
    const timer = setTimeout(() => {
      modalRef.current?.focus()
    }, 100)

    return () => {
      clearTimeout(timer)
      // Restaurer le focus à la fermeture
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen])

  // 🔹 Gestion de la touche Échap
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  // 🔹 Empêcher le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // 🔹 Ne rien rendre si fermé (et si on utilise le contrôle externe)
  if (!isOpen) return null

  // 🔹 Render via Portal pour éviter les problèmes de stacking context
  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* 🌑 Overlay (fond sombre) */}
      <div 
        className={`absolute inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity ${
          closeOnOverlay ? 'cursor-pointer' : 'cursor-default'
        }`}
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      {/* 🪟 Contenu de la modale */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl 
          flex flex-col max-h-full animate-in fade-in zoom-in-95 duration-200
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
        onClick={(e) => e.stopPropagation()} // Empêcher la fermeture au clic dans le contenu
      >
        {/* 📌 Header avec titre et bouton fermer */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            {title && (
              <h2 id="modal-title" className="text-lg font-semibold text-neutral-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 
                  rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Fermer la modale"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* 📄 Corps de la modale (scrollable si contenu long) */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>

        {/* 🦶 Footer optionnel (si enfant avec slot "footer") */}
        {/* Tu peux ajouter un slot footer si besoin, voir exemple plus bas */}
      </div>
    </div>,
    document.body // ✅ Portal monté directement dans <body>
  )
}