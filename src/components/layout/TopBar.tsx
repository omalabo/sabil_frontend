import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectAuth, logout } from '../../store/authSlice'
import { useGetNotificationsQuery, useMarkNotificationReadMutation,useGetTachesDirectionQuery } from '../../store/apiSlice'
import { User,TacheDirection } from '../../types'

interface TopBarProps {
  user?: User
}

/**
 * 🔝 TopBar : barre de navigation supérieure
 * - Barre de recherche globale
 * - Notifications avec badge non-lues
 * - Menu profil utilisateur
 */
export default function TopBar({ user }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifs, setShowNotifs] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  // 📡 Fetch des notifications (polling toutes les 30s)
  const { data: notificationsData } = useGetNotificationsQuery({ 
    page: 1, 
    lu: false 
  }, {
    pollingInterval: 30000,
    skip: !user,
  })

  const [markRead] = useMarkNotificationReadMutation()

  const unreadCount = notificationsData?.results?.filter(n => !n.lu).length || 0

  // 🔍 Gestion de la recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Rediriger vers page de recherche selon rôle
      navigate(`/${user?.role}/classes?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  // 🔔 Marquer une notification comme lue
  const handleNotifClick = async (notifId: string) => {
    await markRead(notifId)
    setShowNotifs(false)
  }
  
const { data: tachesRaw } = useGetTachesDirectionQuery(undefined, {
  pollingInterval: 30000,
  skip: !user,
})

const taches: TacheDirection[] = Array.isArray(tachesRaw)
  ? tachesRaw
  : (tachesRaw as any)?.results ?? []

// Même logique que dans TachesDirectionPage
const nbMesTaches = taches.filter(
  (tache) =>
    !tache.faite &&
    tache.assignees.some(
      (a) => a.user === user?.id
    )
).length

  // 🚪 Déconnexion
  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  return (
    // <header className="bg-white border-b border-neutral-200 px-4 py-3 sticky top-0 z-40">
    <header className="bg-white">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* 🔍 Barre de recherche */}
        {/* <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="search"
              placeholder="Rechercher une classe, un élève..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-10"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              🔍
            </span>
          </div>
        </form> */}
        <div className="relative">
            
          </div>

        {/* 🔔 Notifications + Profil */}
        <div className="flex items-center gap-2">
          {/* 📋 Tâches à faire (admins uniquement) */}
          {user?.role === 'admin' && nbMesTaches > 0 && (
            <button
              onClick={() => navigate('/admin/taches')}
              className="
                relative
                px-3 py-2
                rounded-xl
                bg-orange-500
                hover:bg-orange-600
                text-white
                font-bold
                animate-pulse
                shadow-[0_0_20px_rgba(249,115,22,0.8)]
                transition-all
              "
              title={`${nbMesTaches} tâche(s) à effectuer`}
            >
              📋

              <span
                className="
                  absolute
                  -top-2
                  -right-2
                  w-6
                  h-6
                  rounded-full
                  bg-red-600
                  text-white
                  text-xs
                  flex
                  items-center
                  justify-center
                  font-bold
                "
              >
                {nbMesTaches > 99 ? '99+' : nbMesTaches}
              </span>
            </button>
          )}

          {/* 🔔 Bouton notifications */}
          {/* <div className="relative">
            <button
              onClick={() => {
                setShowNotifs(!showNotifs)
                setShowProfile(false)
              }}
              className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors"
              aria-label="Notifications"
            >
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>


            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-neutral-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-neutral-100">
                  <h3 className="font-semibold text-neutral-900">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notificationsData?.results?.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors ${
                        !notif.lu ? 'bg-primary-50 border-l-2 border-primary-500' : ''
                      }`}
                    >
                      <p className="font-medium text-sm text-neutral-900">{notif.titre}</p>
                      {notif.contenu && (
                        <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{notif.contenu}</p>
                      )}
                      <p className="text-xs text-neutral-400 mt-1">
                        {new Date(notif.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </button>
                  ))}
                  {(!notificationsData?.results || notificationsData.results.length === 0) && (
                    <p className="px-4 py-3 text-sm text-neutral-500 text-center">
                      Aucune nouvelle notification
                    </p>
                  )}
                </div>
              </div>
            )}
          </div> */}

          {/* 👤 Menu profil */}
          {/* <div className="relative">
            <button
              onClick={() => {
                setShowProfile(!showProfile)
                setShowNotifs(false)
              }}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                {user?.display_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="hidden sm:block text-sm font-medium text-neutral-700">
                {user?.display_name}
              </span>
              <span className="text-xs text-neutral-400 hidden sm:block">▼</span>
            </button>

            {showProfile && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
                <button
                  onClick={() => {
                    navigate(`/${user?.role}/parametres`)
                    setShowProfile(false)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  ⚙️ Paramètres
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                >
                  🚪 Déconnexion
                </button>
              </div>
            )}
          </div> */}
        </div>
      </div>
    </header>
  )
}