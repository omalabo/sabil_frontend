import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useResetPasswordMutation } from '../../store/apiSlice'

/**
 * 🔓 Page "Réinitialiser le mot de passe"
 *
 * Accès :
 * - Arrive normalement depuis /auth/forgot-password avec l'email en state
 * - Si l'email n'est pas dans le state (ex: accès direct via URL), on demande
 *   à l'utilisateur de le ressaisir
 *
 * Champs : email (pré-rempli si dispo), code reçu par email, nouveau mot de passe
 */
export default function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()

  const emailFromState = (location.state as any)?.email || ''

  const [email, setEmail] = useState(emailFromState)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [resetPassword, { isLoading }] = useResetPasswordMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // ✅ Validations côté frontend
    if (code.trim().length !== 6) {
      setError('Le code doit contenir 6 chiffres')
      return
    }
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    try {
      await resetPassword({ email, code, new_password: newPassword }).unwrap()
      setSuccess(true)

      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1500)
    } catch (err: any) {
      setError(err?.data?.error || err?.detail || 'Code invalide ou expiré')
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-success-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center border border-success-200">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-success-700 mb-2">
            Mot de passe mis à jour !
          </h2>
          <p className="text-neutral-600">
            Redirection vers la page de connexion...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="w-full max-w-md">

        {/* 🏷️ En-tête */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Réinitialiser le mot de passe
          </h1>
          <p className="text-neutral-600 mt-2">
            Entrez le code reçu par email et votre nouveau mot de passe
          </p>
        </div>

        {/* 📦 Formulaire */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-neutral-200">

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email (pré-rempli si dispo, sinon saisie manuelle) */}
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

            {/* Code reçu par email */}
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-neutral-700 mb-1">
                Code de vérification
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="form-input tracking-widest text-center text-lg"
                placeholder="123456"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Code à 6 chiffres envoyé par email, valide 15 minutes
              </p>
            </div>

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

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 mt-2"
            >
              {isLoading ? 'Validation...' : 'Réinitialiser le mot de passe'}
            </button>
          </form>

          <p className="text-sm text-center mt-6">
            <Link to="/auth/forgot-password" className="text-primary-600 hover:text-primary-700 font-medium">
              Je n'ai pas reçu de code, recommencer
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}