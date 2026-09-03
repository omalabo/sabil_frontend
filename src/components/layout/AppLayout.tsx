import { Outlet, Navigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

/**
 * Layout principal de l'application
 * Structure :
 * - TopBar : header avec search, notifications, profil
 * - Sidebar : navigation latérale dynamique selon rôle
 * - Outlet : zone de contenu où s'affichent les pages enfants
 * 
 * Ce composant est enveloppé par <RoleGuard /> dans App.tsx
 * pour garantir que seul un utilisateur authentifié y accède
 */
export default function AppLayout() {
  const { user, token } = useAppSelector(selectAuth)

  // 🔒 Sécurité supplémentaire : si pas de token, rediriger vers login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* 🧭 Sidebar de navigation - cachée sur mobile par défaut */}
      <Sidebar userRole={user?.role} userId={user?.id} isActive={user?.is_active !== false} />
      
      {/* 📱 Zone principale : TopBar + Contenu */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 🔝 TopBar avec recherche, notifs, menu profil */}
        <TopBar user={user} />
        
        {/* 🎯 Zone de contenu dynamique (pages enfants via Outlet) */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
