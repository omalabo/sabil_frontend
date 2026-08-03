import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { UserRole } from '../../types'

interface RoleGuardProps {
  allowedRoles: UserRole[]
}

/**
 * 🛡️ Guard de route par rôle
 * 
 * Usage dans App.tsx :
 * <Route element={<RoleGuard allowedRoles={['eleve', 'professeur']} />}>
 *   <Route path="/page-protegee" element={<MaPage />} />
 * </Route>
 * 
 * Fonctionnement :
 * 1. Vérifie si l'utilisateur est authentifié (token présent)
 * 2. Vérifie si son rôle est dans la liste allowedRoles
 * 3. Si OK → affiche le contenu enfant (<Outlet />)
 * 4. Si KO → redirige vers /login ou page non autorisée
 */
export default function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { user, token, mustChangePassword } = useAppSelector(selectAuth)
  const location = useLocation()

  // 🔐 1. Pas authentifié → redirection vers login
  /* if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  } */

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

   // ⏳ 2. Token présent mais user pas encore dans le store (refresh en cours)
  //       Avec le fix authSlice, ce cas ne devrait plus arriver
  //       Mais on garde un fallback au lieu de rediriger vers /login
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // 🔒 2. Doit changer son mot de passe → redirection forcée
  if (mustChangePassword) {
    return <Navigate to="/auth/force-change-password" replace />
  }

  // 🚫 3. Rôle non autorisé → page d'erreur
  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-danger-600 mb-2">⛔ Accès refusé</h1>
          <p className="text-neutral-600">
            Vous n'avez pas les permissions pour accéder à cette page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 btn-primary"
          >
            ← Retour
          </button>
        </div>
      </div>
    )
  }

  // ✅ 4. Accès autorisé → afficher le contenu enfant
  return <Outlet />
}