import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForgotPasswordMutation } from '../../store/apiSlice'
import logo from '../../assets/logo.png'
/**
 * 📧 Page "Mot de passe oublié"
 * - Utilisateur saisit son email
 * - Backend envoie un code à 6 chiffres par email (si le compte existe)
 * - Redirection vers /auth/reset-password avec l'email en state
 *
 * ⚠️ Le backend répond toujours le même message, que l'email existe ou non,
 * pour éviter de révéler quels emails sont enregistrés.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    try {
      const result = await forgotPassword({ email }).unwrap()
      setMessage(result.message || 'Si ce compte existe, un code a été envoyé par email.')

      // ⏳ Petite pause pour laisser lire le message, puis redirection vers l'étape suivante
      setTimeout(() => {
        navigate('/auth/reset-password', { state: { email } })
      }, 1200)
    } catch (err: any) {
      setError(err?.data?.error || err?.detail || "Une erreur est survenue. Veuillez réessayer.")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="w-full max-w-md">

        {/* 🏷️ En-tête */}
        <div className="text-center mb-6">
          <img src={logo} alt="Sabil Al Ilm" className="h-24 md:h-28 mx-auto mb-3 object-contain mix-blend-multiply" />
          <h1 className="text-2xl font-bold text-neutral-900">Mot de passe oublié</h1>
          <p className="text-neutral-600 mt-2">Saisissez votre email, nous vous envoyons un code de vérification</p>
        </div>

        {/* 📦 Formulaire */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-neutral-200">

          {error && (
            <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-success-50 border border-success-200 rounded-lg text-success-700 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Envoi en cours...
                </span>
              ) : (
                'Recevoir le code'
              )}
            </button>
          </form>

          <p className="text-sm text-center mt-6">
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              ← Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
