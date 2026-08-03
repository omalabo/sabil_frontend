import { useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import api from '../../config/axios'

export default function ProfMessageAdmin() {
  const { user } = useAppSelector(selectAuth)
  const [messages, setMessages] = useState<any[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useState(() => {
    api.get('/messages/', { params: { type_canal: 'admin' } }).then(res => setMessages(res.data.results || [])).finally(() => setLoading(false))
  }, [])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMsg.trim()) return
    const res = await api.post('/messages/', { contenu: newMsg, type_canal: 'admin', type_message: 'texte' })
    setMessages(prev => [...prev, res.data])
    setNewMsg('')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-lg border border-neutral-200">
      <div className="p-4 border-b"><h2 className="text-lg font-semibold">💬 Messagerie Administration</h2></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin"/></div> : messages.map(m => (
          <div key={m.id} className={`flex ${m.expediteur === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-lg px-4 py-2 rounded-lg text-sm ${m.expediteur === user?.id ? 'bg-primary-600 text-white' : 'bg-neutral-100'}`}>
              <p>{m.contenu}</p>
              <span className="text-xs opacity-70 mt-1 block">{new Date(m.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}</span>
            </div>
          </div>
        ))}
        {messages.length === 0 && !loading && <p className="text-center text-neutral-500 py-4">Aucun message. Contactez l'admin ici.</p>}
      </div>
      <form onSubmit={send} className="p-3 border-t flex gap-2">
        <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Écrire à l'administration..." className="form-input flex-1" />
        <button type="submit" className="btn-primary px-4">Envoyer</button>
      </form>
    </div>
  )
}