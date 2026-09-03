import { NavLink, useLocation } from 'react-router-dom'
import { UserRole } from '../../types'
import { useGetNotificationsQuery, useMarkNotificationReadMutation } from '../../store/apiSlice'

interface SidebarProps {
  userRole?: UserRole
  isActive?: boolean // 🔒 false = compte désactivé (utilisé pour restreindre le menu élève)
}

// 🗺️ Association route du menu -> type(s) de notification qui doivent
// déclencher le petit pastille orange clignotante sur ce lien.
// Pour ajouter un nouveau cas : ajoute une entrée "route: ['type_notif']".
const NOTIF_BADGE_MAP: Record<string, string[]> = {
    '/direction/planning-global': ['changement_creneau','nouveau_creneau','classe_a_supprimer','classe_mise_en_pause'],
    '/direction/classes':['new_message_chat_classe','new_facture_soumise','new_facture_soumise_recall','facture_payee',
      'facture_confirmee','facture_totalement_payee'],
    '/eleve/classes': ['nouveau_creneau', 'changement_creneau','new_facture_soumise','facture_confirmee','new_message_chat_classe'],
    '/eleve/factures':['new_facture_soumise','facture_confirmee'],
    
    '/professeur/planning': ['inscription_eleve'],
    '/professeur/cours':['new_message_chat_classe','facture_payee'],
    '/admin/classes':['new_facture_soumise','facture_payee','facture_confirmee','new_message_chat_classe','facture_totalement_payee'],
}

// Pour le marquage "lu" au clic — uniquement les routes SANS lecture plus fine en aval
const NOTIF_MARK_READ_ON_NAV: Record<string, string[]> = {
  '/direction/planning-global': ['changement_creneau', 'nouveau_creneau'],
  // ⚠️ volontairement PAS '/eleve/classes' ni '/professeur/cours' :
  // ces notifs sont marquées lues plus finement dans ClasseDetail
}
interface MenuItem {
  to: string
  label: string
  icon: string
  mobileLabel: string
  isLogout?: boolean
}

export default function Sidebar({ userRole, isActive = true }: SidebarProps) {
  const location = useLocation()

  // 📡 Notifications non lues, utilisées uniquement pour calculer les pastilles
  // du menu (pas d'affichage de liste ici, ça reste dans le TopBar)
  const { data: notificationsData } = useGetNotificationsQuery(
    { page: 1, lu: false },
    {
      pollingInterval: 30000,
      skip: !userRole,
    }
  )

  const unreadNotifs = notificationsData?.results?.filter((n) => !n.lu) || []

  const [markRead] = useMarkNotificationReadMutation()

  const hasNotifBadge = (route: string) => {
    const types = NOTIF_BADGE_MAP[route]
    if (!types) return false
    console.log('DEBUG result', route, unreadNotifs.some((n) => types.includes((n as any).type)))
    return unreadNotifs.some((n) => types.includes((n as any).type))
  }

  // ✅ Au clic sur un lien du menu, on marque comme lues les notifs
  // correspondantes (celles qui ont déclenché la pastille sur ce lien)
  const handleMenuClick = (route: string) => {
    const types = NOTIF_MARK_READ_ON_NAV[route]
    if (!types) return

    const toMark = unreadNotifs.filter((n) => types.includes((n as any).type))
    toMark.forEach((n) => {
      markRead(n.id)
    })
  }

  const getLinkClasses = (isActiveLink: boolean) => `
    flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
    ${isActiveLink 
      ? 'bg-primary-100 text-primary-700' 
      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
    }
  `

  const getMobileLinkClasses = (isActiveLink: boolean) => `
    flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-lg transition-all
    ${isActiveLink 
      ? 'text-primary-600' 
      : 'text-neutral-500 hover:text-neutral-700'
    }
  `

  const getMenuItems = () => {
    const logoutItem: MenuItem = {
      to: '#logout',
      label: 'Déconnexion',
      icon: '🚪',
      mobileLabel: 'Sortir',
      isLogout: true,
    }
    switch (userRole) {
      case 'eleve': {
        const fullMenu = [
          { to: '/eleve/dashboard', label: 'Accueil', icon: '🏠', mobileLabel: 'Accueil' },
          { to: '/eleve/classes', label: ' Mes cours', icon: '📚', mobileLabel: 'Classes' },
          { to: '/eleve/diplomes', label: ' Mes diplômes', icon: '🎓', mobileLabel: 'Diplômes' },
          { to: '/eleve/chat-admin', label: ' Admin', icon: '💬', mobileLabel: 'Admin' },
          { to: '/eleve/factures', label: ' Mes Factures', icon: '💰', mobileLabel: 'Factures' },
          logoutItem,
        ]

        // 🔒 Élève désactivé : accès restreint uniquement à la page Factures
        if (!isActive) {
          return fullMenu.filter((item) => item.to === '/eleve/factures')
        }
        return fullMenu
      }
      case 'professeur':
        return [
          { to: '/professeur/dashboard', label: ' Tableau de bord', icon: '📊', mobileLabel: 'Accueil' },
          { to: '/professeur/planning', label: ' Planning', icon: '📅', mobileLabel: 'Planning' },
          { to: '/professeur/cours', label: 'Mes cours', icon: '🎓', mobileLabel: 'Mes cours' },
          { to: '/professeur/diplome', label: 'Diplomes', icon: '📚', mobileLabel: 'Diplomes' },
          logoutItem,
        ]
      case 'admin':
        return [
          { to: '/admin/planning-global', label: 'Accueil', icon: '📅', mobileLabel: 'Accueil' },
          { to: '/admin/classes', label: 'Classes', icon: '🎓', mobileLabel: 'Classes' },
          { to: '/admin/messages-prives', label: 'Messagerie etudiants', icon: '🎓', mobileLabel: 'Messagerie etudiants' },
          { to: '/admin/taches', label: ' Taches', icon: '📊', mobileLabel: 'Taches' },
          { to: '/admin/eleve-factures', label: 'Rappel Facture', icon: '📊', mobileLabel: 'Rappel Facture' },
          logoutItem,
        ]
      case 'direction':
        return [
          { to: '/direction/dashboard', label: ' Supervision', icon: '🎯', mobileLabel: 'Accueil' },
          { to: '/direction/comptes', label: ' Comptes', icon: '💰💰', mobileLabel: 'Comptes' },
          { to: '/direction/planning-global', label: ' Planning', icon: '📅', mobileLabel: 'Planning' },
          { to: '/direction/professeurs', label: ' Professeurs', icon: '🎓', mobileLabel: 'Profs' },
          { to: '/direction/classes', label: 'Cours', icon: '🎓', mobileLabel: 'Cours' },
          { to: '/admin/messages-admins', label: 'admins', icon: '💬', mobileLabel: 'admins' },
          { to: '/direction/taches', label: ' Taches', icon: '📊', mobileLabel: 'Taches' },
          { to: '/direction/annonces', label: ' Annonces', icon: '🚩', mobileLabel: 'Annonces' },
          logoutItem,
        ]
      default:
        return []
    }
  }

  const menuItems = getMenuItems()

  return (
    <>
      {/* 📱 Bottom Navigation - Mobile/Tablette uniquement */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-2 py-1 z-50 safe-area-pb">
        <div className="flex items-center justify-around">
          {/* 🚫 On masque le Planning en mobile (il reste accessible uniquement via la sidebar PC) */}
          {menuItems
            .filter((item) => !item.to.includes('planning'))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={(e) => {
                  if (item.isLogout) {
                    e.preventDefault()
                    localStorage.removeItem('sabil_token')
                    window.location.href = '/login'
                  } else {
                    handleMenuClick(item.to)
                  }
                }}
                className={({ isActive: linkActive }) => getMobileLinkClasses(linkActive)}
              >
                <span className="relative text-xl">
                  {item.icon}
                  {hasNotifBadge(item.to) && (
                    <span className="absolute -top-0.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse ring-2 ring-white" />
                  )}
                </span>
                <span className="text-[10px] font-medium">{item.mobileLabel}</span>
              </NavLink>
            ))}
        </div>
      </nav>
      {/* 💻 Sidebar Desktop - Cachée sur mobile */}
      <aside className="hidden md:flex md:flex-col w-64 bg-white border-r border-neutral-200 h-screen sticky top-0">
        {/* Logo */}
        <div className="p-4 border-b border-neutral-200 flex items-center justify-center">
          <img 
            src="/logo.jpeg"  // ✅ Pas besoin d'import
            alt="Sabil Al Ilm - Le chemin de la Science" 
            className="h-32 w-auto object-contain"
          />
        </div>

        {/* ⚠️ Bandeau si compte désactivé */}
        {!isActive && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-danger-50 border border-danger-200 text-danger-700 text-xs">
            🔒 Compte désactivé — accès limité aux factures
          </div>
        )}

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={(e) => {
                if (item.isLogout) {
                  e.preventDefault()
                  localStorage.removeItem('sabil_token')
                  window.location.href = '/login'
                } else {
                  handleMenuClick(item.to)
                }
              }}
              className={({ isActive: linkActive }) => getLinkClasses(linkActive)}
            >
              <span className="relative text-lg">
                {item.icon}
                {hasNotifBadge(item.to) && (
                  <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse ring-2 ring-white" />
                )}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Déconnexion */}
        <div className="p-4 border-t border-neutral-200">
          <button
            onClick={() => {
              localStorage.removeItem('sabil_token')
              window.location.href = '/login'
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
          >
            <span>🚪</span>
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  )
}
