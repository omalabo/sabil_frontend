import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectAuth, passwordChanged, clearAuth } from '../../store/authSlice'
import { useForceChangePasswordMutation } from '../../store/apiSlice'

/**
 * 🔒 Page de changement de mot de passe forcé
 * 
 * Accès conditionnel :
 * - Utilisateur doit être authentifié
 * - mustChangePassword doit être true
 * 
 * Après succès :
 * - Mise à jour du store (mustChangePassword = false)
 * - Redirection vers le dashboard du rôle
 */
export default function ForcePasswordChange() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user, token, mustChangePassword } = useAppSelector(selectAuth)
  
  const [changePassword, { isLoading }] = useForceChangePasswordMutation()

  // 🔄 Sécurité : si pas obligé de changer, rediriger
  if (!token || !mustChangePassword) {
    return <Navigate to="/" replace />
  }

  /**
   * 🎯 Validation et soumission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // ✅ Validations côté frontend
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    try {
      // 📡 Appel API
      await changePassword({ new_password: newPassword }).unwrap()
      
      // ✅ Succès : mettre à jour le state et rediriger
      dispatch(passwordChanged())
      setSuccess(true)
      
      // Petite pause pour afficher le message de succès
      setTimeout(() => {
        // Redirection vers dashboard selon rôle
        const dashboardPath = `/${user?.role}/dashboard`
        navigate(dashboardPath, { replace: true })
      }, 1500)
      
    } catch (err: any) {
      setError(err?.data?.error || err?.detail || 'Erreur lors du changement de mot de passe')
    }
  }

  // ✅ Message de succès
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-success-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center border border-success-200">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-success-700 mb-2">
            Mot de passe mis à jour !
          </h2>
          <p className="text-neutral-600">
            Redirection vers votre espace...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warning-50 to-white p-4">
      <div className="w-full max-w-md">
        
        {/* 🏷️ En-tête */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Premier accès : sécurisez votre compte
          </h1>
          <p className="text-neutral-600 mt-2">
            Veuillez choisir un nouveau mot de passe pour continuer
          </p>
        </div>

        {/* 📦 Formulaire */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-neutral-200">
          
          {/* ⚠️ Message d'erreur */}
          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Nouveau mot de passe */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Minimum 6 caractères
              </p>
            </div>

            {/* Confirmation */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 mb-1">
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
              />
            </div>

            {/* 🔘 Bouton */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 mt-2"
            >
              {isLoading ? 'Mise à jour...' : 'Valider et continuer'}
            </button>
          </form>

          {/* 💡 Conseils sécurité */}
          <div className="mt-6 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
            <p className="text-xs text-neutral-600 font-medium mb-2">💡 Conseils pour un mot de passe sécurisé :</p>
            <ul className="text-xs text-neutral-500 space-y-1 list-disc list-inside">
              <li>Utilisez des majuscules, minuscules et chiffres</li>
              <li>Évitez les informations personnelles</li>
              <li>Ne réutilisez pas un mot de passe d'un autre service</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}