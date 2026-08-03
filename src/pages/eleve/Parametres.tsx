import { useState } from 'react'
import { useChangePasswordMutation } from '../../store/apiSlice'

export default function EleveParametres() {
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{type: 'success'|'error', text: string} | null>(null)
  const [changePw, { isLoading }] = useChangePasswordMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (newPw !== confirm) return setMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
    try {
      await changePw({ old_password: current, new_password: newPw }).unwrap()
      setMsg({ type: 'success', text: 'Mot de passe mis à jour avec succès' })
      setCurrent(''); setNewPw(''); setConfirm('')
    } catch (err: any) {
      setMsg({ type: 'error', text: err.data?.error || 'Erreur lors du changement' })
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">⚙️ Paramètres</h1>
      {msg && <div className={`p-3 rounded-lg ${msg.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-success-50 text-success-700'}`}>{msg.text}</div>}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border border-neutral-200 space-y-4">
        <h2 className="text-lg font-semibold">Changer le mot de passe</h2>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Mot de passe actuel" className="form-input" required />
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Nouveau mot de passe (min. 6)" className="form-input" required minLength={6} />
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirmer le nouveau" className="form-input" required />
        <button type="submit" disabled={isLoading} className="btn-primary w-full">{isLoading ? 'Mise à jour...' : 'Valider'}</button>
      </form>
    </div>
  )
}