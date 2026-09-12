import { Outlet, Navigate, useNavigate } from 'react-router-dom' // ✅ Ajout de useNavigate
import { useEffect } from 'react' // ✅ Ajout de useEffect
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

/**
 * Layout principal de l'application
 */
export default function AppLayout() {
  const { user, token } = useAppSelector(selectAuth)
  const navigate = useNavigate() // ✅ Hook pour déclencher la navigation

  // 🔒 Sécurité : si pas de token, rediriger vers login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // ✅ ÉTAPE 5 : Écouter les clics sur les notifications Push venant de React Native
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        // React Native peut envoyer une string ou un objet directement
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        // On vérifie que c'est bien notre message de navigation
        if (data && data.type === 'NAVIGATE' && data.url) {
          console.log('🔔 Navigation depuis notification push vers :', data.url);
          navigate(data.url); // ✅ C'est ici que la magie opère
        }
      } catch (error) {
        // On ignore silencieusement les autres messages (ex: scripts tiers, WebView interne)
        // pour éviter de faire planter l'app si le JSON est invalide
      }
    };

    // On attache l'écouteur
    window.addEventListener('message', handleMessage);

    // Nettoyage quand le composant est démonté (bonne pratique React)
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [navigate]); // Dépendance à navigate pour éviter les warnings React

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
