import { useState } from 'react'
import api from '../../config/axios'

export default function ProfParametres() {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{type:'success'|'error', text:string} | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (newPw !== confirm) return setMsg({type:'error', text:'Les mots de passe ne correspondent pas.'})
    if (newPw.length < 6) return setMsg({type:'error', text:'Minimum 6 caractères.'})
    setLoading(true)
    try {
      await api.post('/auth/change-password/', { old_password: oldPw, new_password: newPw })
      setMsg({type:'success', text:'Mot de passe mis à jour avec succès.'})
      setOldPw(''); setNewPw(''); setConfirm('')
    } catch(err: any) {
      setMsg({type:'error', text: err.response?.data?.error || 'Erreur lors du changement.'})
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">⚙️ Paramètres Professeur</h1>
      {msg && <div className={`p-3 rounded-lg text-sm ${msg.type==='error'?'bg-danger-50 text-danger-700':'bg-success-50 text-success-700'}`}>{msg.text}</div>}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-neutral-200 space-y-4">
        <h2 className="text-lg font-semibold">Changer le mot de passe</h2>
        <input type="password" value={oldPw} onChange={e=>setOldPw(e.target.value)} placeholder="Mot de passe actuel" className="form-input" required />
        <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} placeholder="Nouveau mot de passe" className="form-input" required minLength={6} />
        <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirmer" className="form-input" required />
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Mise à jour...' : 'Valider le changement'}</button>
      </form>
      <div className="bg-primary-50 border border-primary-200 p-4 rounded-lg text-sm text-primary-800">
        💡 <strong>Note :</strong> Si vous avez oublié votre mot de passe, contactez la direction pour une réinitialisation.
      </div>
    </div>
  )
}