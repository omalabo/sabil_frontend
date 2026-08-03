/**
 * 🔧 Helpers utilitaires réutilisables
 * Formats de date, mapping jours, gestion couleurs, validation
 */

// 📅 Jours de la semaine (1 = Lundi, 7 = Dimanche)
export const JOURS_SEMAINE = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/**
 * Formate une heure "HH:MM:SS" en "HH:MM"
 */
export const formatHeure = (time?: string) => time?.substring(0, 5) || '-'

/**
 * Retourne le jour en français depuis un index 1-7
 */
export const getJourFr = (idx?: number) => JOURS_SEMAINE[idx || 0] || '-'

/**
 * Génère les créneaux de 30min entre heureDeb et heureFin
 * Ex: "06:00", "06:30", "07:00" ...
 */
export const generateSlots = (startHour: number = 6, endHour: number = 22): string[] => {
  const slots: string[] = []
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  slots.push(`${String(endHour).padStart(2, '0')}:00`)
  return slots
}

/**
 * Calcule la durée entre deux heures au format "HH:MM"
 * Retourne en minutes
 */
export const dureeMinutes = (debut: string, fin: string): number => {
  const [h1, m1] = debut.split(':').map(Number)
  const [h2, m2] = fin.split(':').map(Number)
  return (h2 * 60 + m2) - (h1 * 60 + m1)
}

/**
 * Formate un nombre en devise Euro
 */
export const formatPrice = (amount?: number | string) => {
  if (!amount) return '0 €'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(num)
}

/**
 * Génère un ID Jitsi unique par classe/séance
 */
export const generateJitsiRoomId = (classeId: string, seanceId?: string) => 
  `sabil-${classeId}-${seanceId || Date.now()}`.replace(/[^a-zA-Z0-9-_]/g, '')