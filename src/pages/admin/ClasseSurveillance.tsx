import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { useGetClassQuery, useGetClassMessagesQuery, useSendMessageMutation } from '../../store/apiSlice'
import api from '../../config/axios'
import { Class, Message, User } from '../../types'

export default function AdminClasseSurveillance() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAppSelector(selectAuth)
  
  const [messageText, setMessageText] = useState('')
  const [filterEleve, setFilterEleve] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 📡 Fetch de la classe
  const {  classe, isLoading: loadingClass } = useGetClassQuery(id!, { skip: !id })
  
  // 📡 Fetch des messages du chat (lecture seule pour l'admin)
  const {  messagesData, refetch: refetchMessages } = useGetClassMessagesQuery(
    { classeId: id!, page: 1 },
    { skip: !id }
  )

  // 📡 Fetch des élèves inscrits dans cette classe
  const [inscriptions, setInscriptions] = useState<Array<{ eleve: User; nom_diplome: string; contrat_signe: boolean }>>([])
  
  useEffect(() => {
    if (id) {
      api.get(`/inscriptions/?classe=${id}`).then(res => setInscriptions(res.data.results || []))
    }
  }, [id])

  // 📜 Scroll auto en bas du chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesData?.results])

  // 🚫 Sécurité : si classe non trouvée ou non accessible
  if (!id || (!classe && !loadingClass)) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600">Classe non trouvée ou accès refusé</p>
        <button onClick={() => navigate(-1)} className="btn-primary mt-4">← Retour</button>
      </div>
    )
  }

  // ⏳ Chargement
  if (loadingClass) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  // 🎯 Messages filtrés par élève si sélectionné
  const filteredMessages = filterEleve 
    ? messagesData?.results?.filter((m: Message) => m.expediteur.id === filterEleve)
    : messagesData?.results

  return (
    <div className="space-y-6">
      {/* 🏷️ En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">👁️ Surveillance de classe</h1>
          <p className="text-neutral-600">{classe?.nom} • {classe?.programme}</p>
        </div>
        <button onClick={() => navigate(-1)} className="text-neutral-600 hover:text-neutral-900">← Retour</button>
      </div>

      {/* 📊 Infos rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Professeur</p>
          <p className="font-medium">{classe?.professeur?.display_name || '-'}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Élèves inscrits</p>
          <p className="font-medium">{inscriptions.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Dernière activité</p>
          <p className="font-medium">{classe?.derniere_activite_at ? new Date(classe.derniere_activite_at).toLocaleString('fr-FR') : '-'}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-500">Statut</p>
          <span className={`px-2 py-0.5 rounded text-xs ${
            classe?.couleur === 'orange' ? 'bg-warning-100 text-warning-700' :
            classe?.couleur === 'rouge' ? 'bg-danger-100 text-danger-700' :
            'bg-success-100 text-success-700'
          }`}>
            {classe?.statut}
          </span>
        </div>
      </div>

      {/* 👥 Filtre par élève */}
      <div className="bg-white p-4 rounded-lg border border-neutral-200">
        <p className="text-sm font-medium text-neutral-700 mb-2">🔍 Filtrer les messages par élève :</p>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setFilterEleve(null)}
            className={`px-3 py-1.5 rounded text-sm ${!filterEleve ? 'bg-primary-600 text-white' : 'bg-neutral-100 hover:bg-neutral-200'}`}
          >
            Tous
          </button>
          {inscriptions.map(({ eleve }) => (
            <button 
              key={eleve.id}
              onClick={() => setFilterEleve(eleve.id)}
              className={`px-3 py-1.5 rounded text-sm ${filterEleve === eleve.id ? 'bg-primary-600 text-white' : 'bg-neutral-100 hover:bg-neutral-200'}`}
            >
              {eleve.display_name}
            </button>
          ))}
        </div>
      </div>

      {/* 💬 Chat en lecture seule + intervention possible */}
      <div className="bg-white rounded-lg border border-neutral-200 flex flex-col h-96">
        <div className="p-3 border-b border-neutral-200 flex justify-between items-center">
          <h3 className="font-semibold text-neutral-900">💬 Chat de la classe</h3>
          <span className="text-xs text-neutral-500">Lecture seule • Vous pouvez intervenir si nécessaire</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredMessages?.map((msg: Message) => (
            <div key={msg.id} className={`flex gap-3 ${msg.is_systeme ? 'justify-center' : ''}`}>
              {!msg.is_systeme && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  msg.expediteur.role === 'professeur' ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-700'
                }`}>
                  {msg.expediteur.display_name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className={`max-w-2xl px-4 py-2 rounded-lg ${
                msg.is_systeme ? 'bg-neutral-100 text-neutral-600 text-center italic' :
                msg.expediteur.role === 'professeur' ? 'bg-primary-50 border border-primary-200' : 'bg-neutral-50'
              }`}>
                {!msg.is_systeme && (
                  <p className="text-xs font-medium text-neutral-500 mb-1">
                    {msg.expediteur.display_name} • {new Date(msg.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}
                  </p>
                )}
                <p className="text-sm">{msg.contenu}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
          {(!filteredMessages || filteredMessages.length === 0) && (
            <p className="text-center text-neutral-500 py-8">Aucun message dans cette classe</p>
          )}
        </div>

        {/* ✉️ Zone d'intervention admin (optionnelle) */}
        <form 
          onSubmit={async (e) => {
            e.preventDefault()
            if (!messageText.trim() || !id) return
            await api.post('/messages/', {
              classe_id: id,
              contenu: `[ADMIN] ${messageText}`,
              type_canal: 'classe',
              type_message: 'systeme',
              is_systeme: true
            })
            setMessageText('')
            refetchMessages()
          }}
          className="p-3 border-t border-neutral-200 flex gap-2 bg-neutral-50"
        >
          <input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Intervenir en tant qu'admin (message système)..."
            className="form-input flex-1"
          />
          <button type="submit" disabled={!messageText.trim()} className="btn-primary px-4">
            Envoyer
          </button>
        </form>
      </div>

      {/* 📋 Liste des inscrits */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <h3 className="font-semibold text-neutral-900 mb-3">👥 Élèves inscrits</h3>
        <div className="space-y-2">
          {inscriptions.map(({ eleve, nom_diplome, contrat_signe }) => (
            <div key={eleve.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
              <div>
                <p className="font-medium">{eleve.display_name}</p>
                <p className="text-xs text-neutral-500">{nom_diplome || eleve.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  contrat_signe ? 'bg-success-100 text-success-700' : 'bg-warning-100 text-warning-700'
                }`}>
                  {contrat_signe ? '✅ Contrat signé' : '⏳ Contrat en attente'}
                </span>
                <button 
                  onClick={() => navigate(`/admin/eleve/${eleve.id}`)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Voir profil
                </button>
              </div>
            </div>
          ))}
          {inscriptions.length === 0 && (
            <p className="text-sm text-neutral-500 text-center py-4">Aucun élève inscrit dans cette classe</p>
          )}
        </div>
      </div>
    </div>
  )
}