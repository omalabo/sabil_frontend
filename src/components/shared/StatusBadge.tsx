import { ClassColor, ClassStatus } from '../../types'

interface StatusBadgeProps {
  status: ClassStatus
  color: ClassColor
  label?: string
}

/**
 * 🎯 Badge de statut coloré pour les classes
 * 
 * Couleurs métier :
 * - 🔵 normal = bleu (standard)
 * - 🟠 pause = orange (classe en pause)
 * - 🔴 delete = rouge (à supprimer / signalée)
 * 
 * Usage :
 * <StatusBadge status="actif" color="normal" />
 * <StatusBadge status="en_pause" color="orange" label="En pause" />
 */
export default function StatusBadge({ status, color, label }: StatusBadgeProps) {
  // 🎨 Mapping couleur → classes Tailwind
  const getColorClasses = (c: ClassColor) => {
    switch (c) {
      case 'orange': return 'status-badge status-pause'
      case 'rouge': return 'status-badge status-delete'
      default: return 'status-badge status-normal'
    }
  }

  // 🏷️ Label par défaut selon statut si non fourni
  const displayLabel = label || {
    'actif': 'Active',
    'en_pause': 'En pause',
    'fin_session': 'Session terminée',
    'supprime': 'Supprimée',
  }[status] || status

  return (
    <span className={getColorClasses(color)}>
      {displayLabel}
    </span>
  )
}