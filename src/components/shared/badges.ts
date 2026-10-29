// src/components/shared/badges.ts
// Catalogue des 15 badges (images : src/assets/badges/{code}.png)
// ⚠️ Les `code` doivent rester identiques à la liste BADGE_CODES du backend.

export interface BadgeDef {
  code: string
  label: string
}

export const BADGES: BadgeDef[] = [
  { code: 'ponctualite', label: 'Badge de Ponctualité' },
  { code: 'assiduite', label: "Badge d'Assiduité" },
  { code: 'effort', label: "Badge de l'Effort" },
  { code: 'progression', label: 'Badge de Progression' },
  { code: 'recitation', label: 'Badge de Récitation' },
  { code: 'motivation', label: 'Badge de Motivation' },
  { code: 'objectif-atteint', label: "Badge d'Objectif atteint" },
  { code: 'bon-comportement', label: 'Badge de Bon comportement' },
  { code: 'perseverance', label: 'Badge de Persévérance' },
  { code: 'entraide', label: "Badge d'Entraide" },
  { code: 'bonne-participation', label: 'Badge de Bonne participation' },
  { code: 'travail-soigne', label: 'Badge de Travail soigné' },
  { code: 'maitrise', label: 'Badge de Maîtrise' },
  { code: 'regularite', label: 'Badge de Régularité' },
  { code: 'respect', label: 'Badge de Respect' },
]

const IMAGES = import.meta.glob('../../assets/badges/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

/** Retourne { code, label, src } ou null si le code est vide / inconnu */
export function badgeInfo(code?: string | null) {
  if (!code) return null
  const def = BADGES.find((b) => b.code === code)
  if (!def) return null
  return { ...def, src: IMAGES[`../../assets/badges/${code}.png`] as string | undefined }
}
