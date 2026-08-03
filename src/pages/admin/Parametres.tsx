import { useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import api from '../../config/axios'

export default function AdminParametres() {
  const { user } = useAppSelector(selectAuth)
  
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  
  const [prefs, setPrefs] = useState({
    alertes_inactivite: true,
    signalements_profs: true,
    messages_prives_eleves: true,
    rappels_paiement_auto: false
  })

  const [msg, setMsg] = useState<{type: 'success'|'error', text: string} | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (newPw !== confirm) return setMsg({type: 'error', text: 'Les mots de passe ne correspondent pas.'})
    if (newPw.length < 6) return setMsg({type: 'error', text: 'Minimum 6 caractères requis.'})
    
    setLoading(true)
    try {
      await api.post('/auth/change-password/', { old_password: oldPw, new_password: newPw })
      setMsg({type: 'success', text: 'Mot de passe mis à jour avec succès.'})
      setOldPw(''); setNewPw(''); setConfirm('')
    } catch (err: any) {
      setMsg({type: 'error', text: err.response?.data?.error || 'Erreur lors du changement.'})
    } finally {
      setLoading(false)
    }
  }

  const togglePref = (key: keyof typeof prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-neutral-900">⚙️ Paramètres Administrateur</h1>

      {msg && (
        <div className={`p-4 rounded-lg text-sm border ${msg.type === 'error' ? 'bg-danger-50 border-danger-200 text-danger-700' : 'bg-success-50 border-success-200 text-success-700'}`}>
          {msg.text}
        </div>
      )}

      {/* 👤 Section Profil */}
      <section className="bg-white p-6 rounded-lg border border-neutral-200 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">👤 Informations du compte</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-neutral-500">Nom affiché</span><p className="font-medium">{user?.display_name || '-'}</p></div>
          <div><span className="text-neutral-500">Email</span><p className="font-medium">{user?.email}</p></div>
          <div><span className="text-neutral-500">Rôle</span><p className="font-medium capitalize">{user?.role}</p></div>
          <div><span className="text-neutral-500">Dernière connexion</span><p className="font-medium">{user?.last_login ? new Date(user.last_login).toLocaleString('fr-FR') : 'Jamais'}</p></div>
        </div>
      </section>

      {/* 🔐 Section Sécurité */}
      <section className="bg-white p-6 rounded-lg border border-neutral-200 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">🔒 Changer le mot de passe</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="Mot de passe actuel" className="form-input" required />
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Nouveau mot de passe" className="form-input" required minLength={6} />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirmer le nouveau" className="form-input" required />
          <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto px-6">
            {loading ? 'Mise à jour...' : 'Valider le changement'}
          </button>
        </form>
      </section>

      {/* 🔔 Section Alertes & Messagerie */}
      <section className="bg-white p-6 rounded-lg border border-neutral-200 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">🔔 Préférences d'administration</h2>
        <div className="space-y-4">
          {[
            { key: 'alertes_inactivite', label: 'Alerte classes inactives (> 8 jours)', desc: 'Notification automatique si aucune activité détectée' },
            { key: 'signalements_profs', label: 'Suivi des absences & retards professeurs', desc: 'Tableau mensuel + remontée direction' },
            { key: 'messages_prives_eleves', label: 'Autoriser la messagerie privée avec les élèves', desc: 'Activation/désactivation des conversations directes' },
            { key: 'rappels_paiement_auto', label: 'Relances automatiques factures impayées', desc: 'J+5 puis tous les 3 jours jusqu\'à paiement' }
          ].map(pref => (
            <div key={pref.key} className="flex items-start justify-between p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50 transition-colors">
              <div>
                <p className="font-medium text-neutral-800 text-sm">{pref.label}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{pref.desc}</p>
              </div>
              <button
                onClick={() => togglePref(pref.key as keyof typeof prefs)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  prefs[pref.key as keyof typeof prefs] ? 'bg-primary-600' : 'bg-neutral-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${prefs[pref.key as keyof typeof prefs] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-4 italic">💡 Ces toggles contrôlent l'affichage et les notifications locales. Pour persister en base, mappez-les à un endpoint `PATCH /api/users/{id}/preferences/`.</p>
      </section>
    </div>
  )
}