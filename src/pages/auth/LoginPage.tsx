import { useState } from 'react'
import { useNavigate, useLocation, Navigate, Link} from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectAuth, loginSuccess, loginFailure, setLoading } from '../../store/authSlice'
import { useLoginMutation } from '../../store/apiSlice'
import { ApiError } from '../../types'

/**
 * 🔐 Page de connexion
 * - Formulaire email/mot de passe
 * - Gestion des erreurs API
 * - Redirection automatique selon rôle + mustChangePassword
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [disabledModalMessage, setDisabledModalMessage] = useState<string | null>(null)
  
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { token, mustChangePassword, user } = useAppSelector(selectAuth)
  
  // 📡 Mutation RTK Query pour le login
  const [login, { isLoading }] = useLoginMutation()

  // 🔄 Si déjà connecté, rediriger automatiquement
  if (token) {
    if (mustChangePassword) {
      return <Navigate to="/auth/force-change-password" replace />
    }
    if (user?.role === 'eleve' && user?.is_active === false) {
      // 🔒 Élève désactivé : toujours renvoyé vers Factures, même sur un re-render
      return <Navigate to="/eleve/factures" replace />
    }
    // Redirection vers dashboard selon rôle (géré par App.tsx normalement)
    return <Navigate to="/" replace />
  }

  /**
   * 🎯 Gestion de la soumission du formulaire
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    dispatch(setLoading(true))

    try {
      // 📡 Appel API via RTK Query
      const result = await login({ email, password }).unwrap()
      
      // ✅ Succès : mettre à jour le store Redux
      /* dispatch(loginSuccess({
        user: { 
          id: '', // Backend ne renvoie pas l'ID dans la réponse login, à ajuster si besoin
          email: result.role, 
          display_name: email.split('@')[0], 
          role: result.role,
          must_change_password: result.must_change_password,
          first_login_done: true,
          is_active: true,
          created_at: new Date().toISOString()
        },
        token: result.token,
        mustChangePassword: result.must_change_password,
      })) */

              // ✅ Succès : mettre à jour le store Redux
        dispatch(loginSuccess({
          user: result.user,  
          token: result.token,
          refreshToken: result.refresh, // 👈 ICI : on prend result.refresh du backend
          mustChangePassword: result.must_change_password,
        }))

      // 🔄 Redirection selon état
      if (result.must_change_password) {
        navigate('/auth/force-change-password', { replace: true })
      } else if (result.user?.role === 'eleve' && result.user?.is_active === false) {
        // 🔒 Élève désactivé : accès restreint uniquement à la page Factures
        navigate('/eleve/factures', { replace: true })
      } else {
        // Redirection vers la page demandée avant login, ou dashboard par défaut
        const from = (location.state as any)?.from?.pathname || '/'
        navigate(from, { replace: true })
      }
      
    } catch (err) {
      // ❌ Erreur : afficher message utilisateur
      const apiError = err as ApiError

      if ((apiError as any).account_disabled) {
        // 🚫 Compte désactivé (tous les rôles sauf élève) : modal au lieu d'un message inline
        setDisabledModalMessage(
          apiError.error || 'Votre compte a été désactivé. Veuillez contacter la direction.'
        )
      } else {
        setError(apiError.error || apiError.detail || 'Identifiants invalides')
      }
      dispatch(loginFailure('Échec de connexion'))
      
    } finally {
      dispatch(setLoading(false))
    }
  }

  return (
    
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="w-full max-w-md">
        
    

      {/* 🏷️ Logo / En-tête */}
        <div className="p-4 flex items-center justify-center">
        <img 
          src="/logo_login.png" 
          alt="Sabil Al Ilm - Le chemin de la Science" 
          className="h-[190px] w-auto object-contain"
        />
      </div>



        {/* 📦 Carte de connexion */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-900 mb-6 text-center">
            Connexion à votre espace
          </h2>

          {/* ⚠️ Message d'erreur global */}
          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
              {error}
            </div>
          )}

          {/* 📝 Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="votre@email.com"
                autoComplete="email"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Mot de passe par défaut : <code className="bg-neutral-100 px-1 rounded">sabil</code>
              </p>
            </div>

            {/* 🔘 Bouton de soumission */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Connexion...
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
            <p className="text-sm text-center mt-4">
              <Link to="/auth/forgot-password" className="text-primary-600 hover:text-primary-700 font-medium">
                Mot de passe oublié ?
              </Link>
            </p>
          </form>

          {/* ℹ️ Note de sécurité */}
          <p className="text-xs text-neutral-500 text-center mt-6">
            🔒 Connexion sécurisée • Aucune inscription libre • Comptes créés par la Direction uniquement
          </p>
        </div>

        {/* 🏢 Footer */}
        <p className="text-center text-sm text-neutral-500 mt-6">
          © {new Date().getFullYear()} Sabil Al Ilm • Tous droits réservés
        </p>
      </div>

      {/* 🚫 Modal : compte désactivé */}
      {disabledModalMessage && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setDisabledModalMessage(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-danger-50 flex items-center justify-center text-2xl">
              🔒
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">
              Compte désactivé
            </h3>
            <p className="text-sm text-neutral-600 mb-6">
              {disabledModalMessage}
            </p>
            <button
              onClick={() => setDisabledModalMessage(null)}
              className="btn-primary w-full py-2.5"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
