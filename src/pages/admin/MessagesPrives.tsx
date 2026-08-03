import { useState, useEffect, useRef, Fragment } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectAuth } from '../../store/authSlice'
import { useGetUsersQuery } from '../../store/apiSlice'
import api from '../../config/axios'
import { User, PrivateMessage } from '../../types'

// Le backend renvoie des champs supplémentaires (fichier, reply_to, etc.)
// qu'on ajoute ici sans casser le type PrivateMessage existant.
type PMessage = PrivateMessage & {
  fichier?: any
  fichier_url?: string | null
  nom_fichier?: string | null
  fichier_expires_at?: string | null
  is_voice_note?: boolean
  reply_to?: string | { id: string } | null
  reply_to_preview?: {
    id: string
    expediteur_nom: string
    type_message: string
    contenu: string
    nom_fichier: string | null
    fichier_url: string | null
  } | null
  deleted_at?: string | null
}

export default function AdminMessagesPrives() {
  const { user } = useAppSelector(selectAuth)
  const [selectedEleve, setSelectedEleve] = useState<User | null>(null)
  const [messages, setMessages] = useState<PMessage[]>([])
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMsgIdRef = useRef<string | null>(null)

  // 🆕 Pièces jointes / vocal
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)

  // 🆕 Réponse à un message
  const [replyToMessage, setReplyToMessage] = useState<PMessage | null>(null)

  // 🆕 Aperçu média plein écran
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video'; name?: string } | null>(null)

  // 🆕 Sélection multiple (appui long / clic-maintenu) pour suppression
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set())
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  // 📡 Fetch des élèves (uniquement ceux gérés par cet admin)
  const { data: elevesData } = useGetUsersQuery({ role: 'eleve', page: 1 }, { skip: user?.role !== 'admin' })
  const eleves = elevesData?.results || []
  const [directions, setDirections] = useState<User[]>([])
  useEffect(() => {
    if (user?.role !== 'admin') return
    api.get('/users/directions/').then(res => setDirections(res.data))
  }, [user])
  const contacts = [...directions, ...eleves]


  const [leftPanelOpen, setLeftPanelOpen] = useState(true)

  // 📡 Charger les messages quand un élève est sélectionné (polling 3s, comme ClasseDetail)
  useEffect(() => {
    if (!selectedEleve) return

    const loadMessages = async () => {
      try {
        const res = await api.get('/messages-prives/', {
          params: {
            destinataire: selectedEleve.id,
            ordering: 'created_at'
          }
        })
        setMessages(res.data.results || [])
      } catch (err) {
        console.error('Erreur chargement messages:', err)
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [selectedEleve, user?.id])

  // 📜 Scroll auto vers le dernier message — uniquement à l'ouverture ou quand un NOUVEAU message arrive
  // (pas à chaque poll, sinon ça interromprait la lecture d'anciens messages)
  useEffect(() => {
    if (messages.length === 0) return
    const lastId = messages[messages.length - 1].id
    if (lastId !== lastMsgIdRef.current) {
      lastMsgIdRef.current = lastId
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Réinitialiser quand on change d'élève
  useEffect(() => {
    lastMsgIdRef.current = null
    setSelectedMsgIds(new Set())
    setReplyToMessage(null)
    setMessageText('')
    setSelectedFiles([])
    setAudioBlob(null)
  }, [selectedEleve])

  const getFullUrl = (url: string | null | undefined) => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const baseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
  }

  const getExpirationWarning = (msg: PMessage) => {
    const expiresAt = msg.fichier_expires_at || msg.fichier?.expires_at
    const isVoiceNote = msg.is_voice_note || msg.fichier?.is_voice_note || false
    if (!expiresAt || isVoiceNote) return null
    const now = new Date().getTime()
    const expTime = new Date(expiresAt).getTime()
    const diffHours = (expTime - now) / (1000 * 60 * 60)
    if (diffHours > 0 && diffHours <= 24) return `⚠️ Suppression dans ${Math.ceil(diffHours)}h`
    return null
  }

  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    const sameDay = (a: Date, b: Date) =>
      a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    if (sameDay(d, today)) return "Aujourd'hui"
    if (sameDay(d, yesterday)) return 'Hier'
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    })
  }

  // 🎤 Enregistrement vocal
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data) }
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }
      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      alert('❌ Accès au microphone refusé.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // ✉️ Envoyer un message privé (texte, fichier, image, vidéo ou vocal)
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!messageText.trim() && selectedFiles.length === 0 && !audioBlob) || !selectedEleve) return

    try {
      const formData = new FormData()
      formData.append('destinataire', selectedEleve.id)
      formData.append('contenu', messageText)

      if (replyToMessage) {
        formData.append('reply_to', replyToMessage.id)
      }

      if (audioBlob) {
        const audioFile = new File([audioBlob], `vocal_${Date.now()}.webm`, { type: 'audio/webm' })
        formData.append('fichier', audioFile)
        formData.append('type_message', 'audio')
        formData.append('is_voice_note', 'true')
      } else if (selectedFiles.length > 0) {
        const file = selectedFiles[0]
        formData.append('fichier', file)
        let typeMsg = 'fichier'
        if (file.type.startsWith('image/')) typeMsg = 'image'
        else if (file.type.startsWith('video/')) typeMsg = 'video'
        else if (file.type.startsWith('audio/')) typeMsg = 'audio'
        formData.append('type_message', typeMsg)
        formData.append('is_voice_note', 'false')
      } else {
        formData.append('type_message', 'texte')
        formData.append('is_voice_note', 'false')
      }

      const res = await api.post('/messages-prives/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setMessages(prev => [...prev, res.data])
      setMessageText('')
      setSelectedFiles([])
      setAudioBlob(null)
      setReplyToMessage(null)
      if (photoInputRef.current) photoInputRef.current.value = ''
      if (docInputRef.current) docInputRef.current.value = ''
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de l'envoi")
    }
  }

  // 🗑️ Sélection multiple style WhatsApp : appui long (mobile) / clic-maintenu (PC)
  const toggleSelectMsg = (id: string) => {
    setSelectedMsgIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const handlePressStart = (msgId: string) => {
    longPressTriggered.current = false
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true
      toggleSelectMsg(msgId)
    }, 450)
  }

  const handlePressEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  const handleMessageClick = (msgId: string) => {
    if (longPressTriggered.current) { longPressTriggered.current = false; return }
    if (selectedMsgIds.size > 0) toggleSelectMsg(msgId)
  }

  const handleDeleteSelectedMessages = async () => {
    if (selectedMsgIds.size === 0) return
    if (!window.confirm(`Supprimer ${selectedMsgIds.size} message(s) ? Cette action est irréversible.`)) return
    try {
      await api.post('/messages-prives/bulk-delete/', { ids: Array.from(selectedMsgIds) })
      setMessages(prev => prev.filter(m => !selectedMsgIds.has(m.id)))
      setSelectedMsgIds(new Set())
    } catch {
      alert('Erreur lors de la suppression.')
    }
  }

  return (
    <div style={{ margin: -24, display: 'flex', height: '92vh', overflow: 'hidden', background: '#f0f2f5' }}>

      {/* 👥 Liste des élèves (sidebar gauche) — inchangée */}
      <div style={{
        width: leftPanelOpen ? (window.innerWidth < 768 ? '100%' : 256) : 0,
        minWidth: leftPanelOpen ? (window.innerWidth < 768 ? '100%' : 256) : 0,
        borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', flexShrink: 0, transition: 'width 0.3s ease, min-width 0.3s ease',
      }}>
        <div className="p-4 border-b border-neutral-200">
          <h2 className="font-semibold text-neutral-900">💬 Messagerie Privée</h2>
          <p className="text-xs text-neutral-500">Admin ↔ Élève uniquement</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          
          {contacts.map((contact: User) => (
            <button
              key={contact.id}
              onClick={() => setSelectedEleve(contact)}
              className={`w-full text-left p-3 border-b border-neutral-100 hover:bg-neutral-50 transition-colors ${
                selectedEleve?.id === contact.id ? 'bg-primary-50 border-l-2 border-primary-500' : ''
              }`}
            >
              <p className="font-medium text-sm text-neutral-900">{contact.display_name || contact.email}</p>
              <p className="text-xs text-neutral-500">{contact.role === 'direction' ? '🏛️ Direction' : '🎓 Élève'}</p>
            </button>
          ))}
          {contacts.length === 0 && (
            <p className="p-4 text-sm text-neutral-500 text-center">Aucun contact</p>
          )}
        </div>
      </div>

      {/* 💬 Zone de conversation — style WhatsApp, identique à ClasseDetail */}
      <div style={{ 
        flex: 1, display: (!selectedEleve && window.innerWidth < 768) ? 'none' : 'flex', 
        flexDirection: 'column', overflow: 'hidden' 
      }}>
        {selectedEleve ? (
          <>
            {/* En-tête conversation / Barre de sélection */}
            {selectedMsgIds.size > 0 ? (
              <div style={{ padding: '10px 16px', background: '#111b21', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#fff', fontSize: 13 }}>{selectedMsgIds.size} sélectionné(s)</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setSelectedMsgIds(new Set())} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                  <button onClick={handleDeleteSelectedMessages} style={{ background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, padding: '6px 12px', borderRadius: 6, fontWeight: 600 }}>🗑️ Supprimer</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px 16px', background: '#f0f2f5', borderBottom: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {window.innerWidth < 768 && (
                      <button onClick={() => setLeftPanelOpen(true)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#312e81', padding: '0 4px' }}>←</button>
                  )}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #312e81, #1e1b4b)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', fontWeight: 700 }}>
                  {selectedEleve.display_name?.[0]?.toUpperCase() || '👤'}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111' }}>{selectedEleve.display_name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#667781' }}>
                    {selectedEleve.role === 'direction' ? '🏛️ Direction' : '🎓 Élève'}
                  </p>
                </div>
              </div>
            )}

            {/* Liste des messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#f0f2f5',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%239C92AC' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E")`,
              scrollBehavior: 'smooth'
            }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin"></div>
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg, idx) => {
                  const isMe = msg.expediteur === user?.id
                  const warning = getExpirationWarning(msg)
                  const fileUrl = getFullUrl(msg.fichier_url)
                  const repliedMsg = msg.reply_to_preview || (typeof msg.reply_to === 'object' ? msg.reply_to : messages.find(m => m.id === msg.reply_to) || null)
                  const prevMsg = messages[idx - 1]
                  const showDateSeparator = !prevMsg || new Date(prevMsg.created_at).toDateString() !== new Date(msg.created_at).toDateString()

                  return (
                    <Fragment key={msg.id}>
                      {showDateSeparator && (
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
                          <span style={{
                            background: '#e1f3fb', color: '#54656f', fontSize: 12, fontWeight: 600,
                            padding: '5px 12px', borderRadius: 8, boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                            textTransform: 'capitalize',
                          }}>
                            {formatDateSeparator(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div
                        id={`msg-${msg.id}`}
                        onMouseDown={() => handlePressStart(msg.id)}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handlePressEnd}
                        onTouchStart={() => handlePressStart(msg.id)}
                        onTouchEnd={handlePressEnd}
                        onClick={() => handleMessageClick(msg.id)}
                        style={{
                          display: 'flex',
                          justifyContent: isMe ? 'flex-end' : 'flex-start',
                          animation: 'content-fade-up 0.3s ease-out',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{
                          maxWidth: '75%',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: selectedMsgIds.has(msg.id)
                            ? 'rgba(99,102,241,0.25)'
                            : (isMe ? 'linear-gradient(135deg, #dcf8c6 0%, #c8e6c9 100%)' : '#ffffff'),
                          boxShadow: selectedMsgIds.has(msg.id) ? '0 0 0 2px #6366f1 inset' : '0 2px 8px rgba(0,0,0,0.06)',
                          overflow: 'hidden',
                          border: isMe ? '1px solid #b2dfdb' : '1px solid #e0e0e0',
                          transition: 'background 0.15s, box-shadow 0.15s',
                        }}>
                          {/* En-tête (nom de l'expéditeur si ce n'est pas l'admin) */}
                          {!isMe && (
                            <div style={{ padding: '10px 14px 4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#5c3317' }}>
                                {msg.expediteur_nom || selectedEleve.display_name}
                              </span>
                            </div>
                          )}

                          {/* Citation du message d'origine (cliquable) */}
                          {repliedMsg && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                const el = document.getElementById(`msg-${repliedMsg.id}`)
                                if (!el) return
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                el.style.transition = 'background 0.3s'
                                el.style.background = 'rgba(139,92,246,0.25)'
                                setTimeout(() => { el.style.background = 'transparent' }, 1200)
                              }}
                              style={{
                                background: isMe ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.04)',
                                borderLeft: `3px solid ${isMe ? '#2e7d32' : '#25d366'}`,
                                borderRadius: 6,
                                padding: '6px 10px',
                                margin: '8px 10px 4px',
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                overflow: 'hidden',
                                cursor: 'pointer',
                              }}
                            >
                              {repliedMsg.type_message === 'image' && repliedMsg.fichier_url && (
                                <img
                                  src={getFullUrl(repliedMsg.fichier_url) ?? ''}
                                  alt=""
                                  style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: isMe ? '#2e7d32' : '#25d366', marginBottom: 2 }}>
                                  {repliedMsg.expediteur_nom === user?.display_name ? 'Vous' : (repliedMsg.expediteur_nom || 'Utilisateur')}
                                </div>
                                <div style={{ color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {repliedMsg.type_message === 'video' ? '🎬 Vidéo' :
                                    repliedMsg.type_message === 'audio' ? '🎤 Note vocale' :
                                    repliedMsg.type_message === 'fichier' ? '📄 Document' :
                                    repliedMsg.type_message === 'image' ? '📷 Photo' :
                                    repliedMsg.contenu}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Texte */}
                          {msg.contenu && (
                            <div style={{ padding: '0 14px 8px', fontSize: '14px', color: '#111', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                              {msg.contenu}
                            </div>
                          )}

                          {/* Image */}
                          {msg.type_message === 'image' && fileUrl && (
                            <div style={{ position: 'relative', background: '#f0f0f0' }}>
                              <img
                                src={fileUrl}
                                alt="Aperçu"
                                style={{ width: '100%', maxWidth: '320px', display: 'block', objectFit: 'cover', cursor: 'zoom-in' }}
                                onClick={(e) => { e.stopPropagation(); setPreviewMedia({ url: fileUrl, type: 'image', name: msg.nom_fichier || undefined }) }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                              {warning && (
                                <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(220, 38, 38, 0.9)', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', fontWeight: 600, backdropFilter: 'blur(4px)' }}>
                                  {warning}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Vidéo */}
                          {msg.type_message === 'video' && fileUrl && (
                            <div style={{ position: 'relative', background: '#000', overflow: 'hidden' }}>
                              <video
                                controls
                                src={fileUrl}
                                style={{ width: '100%', maxWidth: '320px', display: 'block', maxHeight: '300px', cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); setPreviewMedia({ url: fileUrl, type: 'video', name: msg.nom_fichier || undefined }) }}
                              />
                              {warning && (
                                <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(220, 38, 38, 0.9)', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '12px', fontWeight: 600, backdropFilter: 'blur(4px)' }}>
                                  {warning}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Audio / Vocal */}
                          {msg.type_message === 'audio' && fileUrl && (
                            <div style={{ padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: isMe ? 'rgba(255,255,255,0.6)' : '#f5f5f5', padding: '8px 12px', borderRadius: '24px' }}>
                                <span style={{ fontSize: '20px' }}>{msg.is_voice_note ? '🎤' : '🎵'}</span>
                                <audio controls src={fileUrl} style={{ height: '32px', maxWidth: '200px', outline: 'none' }} onClick={(e) => e.stopPropagation()} />
                              </div>
                              {msg.is_voice_note && <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>Note vocale</span>}
                              {warning && (
                                <span style={{ fontSize: '10px', color: '#dc2626', background: '#fef2f2', padding: '4px 8px', borderRadius: '8px', border: '1px solid #fecaca', alignSelf: 'flex-start' }}>
                                  ⚠️ {warning}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Document */}
                          {msg.type_message === 'fichier' && fileUrl && (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '12px', margin: '8px 14px 12px',
                                padding: '12px', background: isMe ? 'rgba(255,255,255,0.6)' : '#f8f9fa',
                                borderRadius: '12px', textDecoration: 'none', color: '#1e1b4b',
                                border: '1px solid rgba(0,0,0,0.05)', position: 'relative',
                              }}
                            >
                              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isMe ? 'rgba(255,255,255,0.8)' : '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📄</div>
                              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {msg.nom_fichier || 'Document'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Cliquez pour télécharger</div>
                              </div>
                              <div style={{ fontSize: '18px', color: '#4f46e5', flexShrink: 0 }}>⬇️</div>
                              {warning && (
                                <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#dc2626', color: 'white', fontSize: '9px', padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>
                                  {warning}
                                </span>
                              )}
                            </a>
                          )}

                          {/* Pied (heure + répondre + lu) */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, padding: '0 8px 6px', marginTop: 4 }}>
                            <span style={{ fontSize: 10, color: isMe ? '#2e7d32' : '#999', fontWeight: 500 }}>
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setReplyToMessage(msg) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: isMe ? '#2e7d32' : '#999', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', opacity: 0.7 }}
                              title="Répondre"
                            >
                              ↩️
                            </button>
                            {isMe && <span style={{ fontSize: 12, color: '#2e7d32' }}>{msg.lu ? '✓✓ Lu' : '✓✓'}</span>}
                          </div>
                        </div>
                      </div>
                    </Fragment>
                  )
                })
              ) : (
                <div style={{ textAlign: 'center', margin: 'auto', color: '#94a3b8' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
                  <p style={{ fontSize: 13 }}>Aucun message avec {selectedEleve.display_name}. Commencez la conversation !</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Formulaire d'envoi (style WhatsApp) */}
            <form onSubmit={handleSend} style={{ padding: '10px 16px', background: '#f0f2f5', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(0,0,0,.06)', position: 'relative' }}>

              <input type="file" ref={photoInputRef} accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)); setShowAttachMenu(false) }} />
              <input type="file" ref={docInputRef} multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)); setShowAttachMenu(false) }} />

              {/* Bannière de réponse */}
              {replyToMessage && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: '#e9ecef', borderRadius: '12px 12px 0 0',
                  borderLeft: '4px solid #25d366', margin: '0 4px'
                }}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#25d366', marginBottom: 2 }}>
                      Répondre à {replyToMessage.expediteur_nom === user?.display_name ? 'vous' : replyToMessage.expediteur_nom}
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {replyToMessage.type_message === 'image' ? '📷 Photo' :
                        replyToMessage.type_message === 'video' ? '🎬 Vidéo' :
                        replyToMessage.type_message === 'audio' ? '🎤 Vocal' :
                        replyToMessage.type_message === 'fichier' ? '📄 Document' : replyToMessage.contenu}
                    </div>
                  </div>
                  <button type="button" onClick={() => setReplyToMessage(null)} style={{ background: 'none', border: 'none', fontSize: 18, color: '#64748b', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                </div>
              )}

              {/* Prévisualisation fichiers / audio sélectionnés */}
              {(selectedFiles.length > 0 || audioBlob) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  {selectedFiles.map((file, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f1f5f9', borderRadius: 8, fontSize: 12 }}>
                      <span>{file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('video/') ? '🎬' : file.type.startsWith('audio/') ? '🎵' : '📄'}</span>
                      <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                    </div>
                  ))}
                  {audioBlob && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#dcfce7', borderRadius: 8, fontSize: 12 }}>
                      <span>🎤</span>
                      <span>Vocal prêt à l'envoi</span>
                      <button type="button" onClick={() => setAudioBlob(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                    </div>
                  )}
                </div>
              )}

              {/* Menu pièce jointe */}
              {showAttachMenu && (
                <>
                  <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} onClick={() => setShowAttachMenu(false)} />
                  <div style={{ position: 'absolute', bottom: '70px', left: '16px', background: '#fff', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 20, minWidth: '200px' }}>
                    <button type="button" onClick={() => photoInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#111', textAlign: 'left' }}>
                      <span style={{ background: '#e0f2fe', padding: '10px', borderRadius: '50%', fontSize: '18px' }}>📷</span>
                      <div><div style={{ fontWeight: 600 }}>Photo & Vidéo</div><div style={{ fontSize: 11, color: '#6b7280' }}>Depuis la galerie ou la caméra</div></div>
                    </button>
                    <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }} />
                    <button type="button" onClick={() => docInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#111', textAlign: 'left' }}>
                      <span style={{ background: '#f3e8ff', padding: '10px', borderRadius: '50%', fontSize: '18px' }}>📄</span>
                      <div><div style={{ fontWeight: 600 }}>Document</div><div style={{ fontSize: 11, color: '#6b7280' }}>PDF, Word, Excel, ZIP, etc.</div></div>
                    </button>
                  </div>
                </>
              )}

              {/* Barre de saisie */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)} style={{ width: 40, height: 40, borderRadius: '50%', background: showAttachMenu ? '#e2e8f0' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#546572' }}>
                  📎
                </button>
                <input type="text" value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Écrire un message privé…" style={{ flex: 1, padding: '10px 16px', borderRadius: 24, border: 'none', background: '#fff', fontSize: 15, outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }} maxLength={1000} />
                <button type="button" onClick={isRecording ? stopRecording : startRecording} style={{ width: 40, height: 40, borderRadius: '50%', background: isRecording ? '#ef4444' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isRecording ? '#fff' : '#546572' }}>
                  {isRecording ? '⏹️' : '🎤'}
                </button>
                <button type="submit" disabled={!messageText.trim() && selectedFiles.length === 0 && !audioBlob} style={{ width: 40, height: 40, borderRadius: '50%', background: (messageText.trim() || selectedFiles.length > 0 || audioBlob) ? '#25d366' : '#e2e8f0', border: 'none', cursor: (messageText.trim() || selectedFiles.length > 0 || audioBlob) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, color: (messageText.trim() || selectedFiles.length > 0 || audioBlob) ? '#fff' : '#9ca3af' }}>
                  ➤
                </button>
              </div>
            </form>
          </>
       ) : window.innerWidth >= 768 ? (
          <div className="flex-1 flex items-center justify-center text-neutral-400">
            <div className="text-center">
              <p>👈 Sélectionnez un élève à gauche pour commencer une conversation privée</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Lightbox média plein écran */}
      {previewMedia && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPreviewMedia(null)}
        >
          <button
            onClick={() => setPreviewMedia(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: '#fff', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}
          >
            ✕
          </button>
          {previewMedia.type === 'image' ? (
            <img src={previewMedia.url} alt="Aperçu" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()} />
          ) : (
            <video src={previewMedia.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} onClick={(e) => e.stopPropagation()} />
          )}
          {previewMedia.name && (
            <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 13, backdropFilter: 'blur(8px)', textAlign: 'center', maxWidth: '90%' }}>
              {previewMedia.name}
            </div>
          )}
        </div>
      )}
    </div>
  )
}