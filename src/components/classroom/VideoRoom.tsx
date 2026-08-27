// videoroom.tsx - Version avec contrôles média + chat intégré style Meet
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useLocalParticipant,
  useConnectionState,
  ConnectionState,
  useRoomContext,
  useChat,
  useTracks,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track, RoomEvent, VideoPresets, LocalParticipant } from 'livekit-client'
import { Class, Seance } from '../../types'
import api from '../../config/axios'
import { Message } from '../../types'

interface VideoRoomProps {
  classe: Class
  seance?: Seance
  role: 'eleve' | 'professeur' | 'admin' | 'direction'
  onLeave?: () => void
  roomName: string
  token: string
  serverUrl: string
  isModerator?: boolean
  userId?: string
  userName?: string
}

// ─────────────────────────────────────────────
// ICÔNES SVG inline (pas de dépendance externe)
// ─────────────────────────────────────────────
const MicOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm-1 15.93A7.001 7.001 0 0 1 5 11H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2a7 7 0 0 1-6 6.93z"/>
  </svg>
)
const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V20h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
  </svg>
)
const CamOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
  </svg>
)
const CamOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
  </svg>
)
const ScreenOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v1h12v-1l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
    <path d="M10 17l5-3-5-3v6z"/>
  </svg>
)
const ScreenOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M1.77 1.77L.5 3.05l2.45 2.45A2 2 0 0 0 2 7v10a2 2 0 0 0 2 2h3l-1 1v1h12v-1l-1-1h.17l3.56 3.56 1.27-1.27L1.77 1.77zM4 17V7.23L16.77 20H7l1-1H4zm4-7.77V13l2.1-1.26-2.1-2.1V9.23zM22 5v11.77l-2-2V5H8.23L6.22 3H22a2 2 0 0 1 2 2h-2z"/>
  </svg>
)
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
  </svg>
)
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
)
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
)
const LeaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
  </svg>
)
const MINI_CHAT_STYLES = `
.mini-chat-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform .18s cubic-bezier(.34,1.56,.64,1), background .18s ease, color .18s ease;
}
.mini-chat-icon-btn:hover {
  transform: scale(1.08);
}
.mini-chat-icon-btn:active {
  transform: scale(.92);
}
.mini-chat-icon-btn svg {
  transition: transform .18s ease;
}
.mini-chat-attach-btn:hover svg {
  transform: rotate(-10deg) scale(1.08);
}
.mini-chat-attach-active svg {
  transform: rotate(-10deg) scale(1.05);
}
.mini-chat-mic-recording {
  position: relative;
  animation: mini-chat-mic-pulse 1.4s ease-in-out infinite;
}
.mini-chat-mic-recording:before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  background: rgba(239,68,68,.18);
  animation: mini-chat-mic-ring 1.4s ease-out infinite;
  pointer-events: none;
}
@keyframes mini-chat-mic-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
@keyframes mini-chat-mic-ring {
  0% { transform: scale(.85); opacity: .8; }
  70% { transform: scale(1.35); opacity: 0; }
  100% { transform: scale(1.35); opacity: 0; }
}
`

function MiniChatAttachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}
function MiniChatMicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}
function MiniChatStopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="3" />
    </svg>
  )
}
// ─────────────────────────────────────────────
// CHAT INTÉGRÉ MINIATURE (style Meet)
// ─────────────────────────────────────────────
function MiniChat({ onClose, identity, classeId, userId, userName }: { 
  onClose: () => void
  identity: string
  classeId: string
  userId?: string
  userName?: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const lastMsgIdRef = useRef<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  // Injecter les styles
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'mini-chat-styles'
    style.textContent = MINI_CHAT_STYLES
    document.head.appendChild(style)
    return () => { document.getElementById('mini-chat-styles')?.remove() }
  }, [])

  // Polling messages
  useEffect(() => {
    if (!classeId) return
    const load = async () => {
      try {
        const res = await api.get('/messages/', { params: { classe_id: classeId } })
        const msgs: Message[] = res.data.results || []
        setMessages(prev => {
          if (prev.length === msgs.length && prev[prev.length - 1]?.id === msgs[msgs.length - 1]?.id) {
            return prev
          }
          return msgs
        })
        // Marquer comme lu
        msgs
          .filter(m => {
            const expId = typeof m.expediteur === 'object' ? (m.expediteur as any)?.id : m.expediteur
            return expId !== userId
          })
          .forEach(m => api.post(`/messages/${m.id}/lu/`).catch(() => {}))
      } catch {}
    }
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [classeId, userId])

  // Scroll intelligent
  const handleChatScroll = () => {
    const el = chatScrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScroll.current = distanceFromBottom < 150
  }

  useEffect(() => {
    if (messages.length === 0) return
    const container = chatScrollRef.current
    if (!container) return
    const lastMessage = messages[messages.length - 1]
    const lastId = lastMessage.id
    const isFirstLoad = lastMsgIdRef.current === null
    const hasNewMessage = lastMsgIdRef.current !== null && lastMsgIdRef.current !== lastId
    const expId = typeof lastMessage.expediteur === 'object'
      ? (lastMessage.expediteur as any)?.id
      : lastMessage.expediteur
    const lastIsMine = expId === userId

    if (isFirstLoad || (hasNewMessage && lastIsMine) || (hasNewMessage && shouldAutoScroll.current)) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: isFirstLoad ? 'auto' : 'smooth'
      })
    }
    lastMsgIdRef.current = lastId
  }, [messages, userId])

  // Enregistrement vocal
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(track => track.stop())
      }
      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      alert("❌ Accès au microphone refusé.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // Envoyer message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && selectedFiles.length === 0 && !audioBlob) || !classeId) return
    
    shouldAutoScroll.current = true
    try {
      const formData = new FormData()
      formData.append('classe_id', classeId)
      formData.append('contenu', input)

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

      await api.post('/messages/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setInput('')
      setSelectedFiles([])
      setAudioBlob(null)
      if (photoInputRef.current) photoInputRef.current.value = ''
      if (docInputRef.current) docInputRef.current.value = ''
    } catch (err) {
      console.error("Erreur envoi message", err)
      alert("❌ Échec de l'envoi du message")
    }
  }

  const getFullUrl = (url: string | null | undefined) => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
  }

  return (
    <div 
      className="absolute bottom-24 right-4 z-40 w-80 flex flex-col bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden"
      style={{ height: '480px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-800 border-b border-neutral-700">
        <span className="text-white font-semibold text-sm tracking-wide">💬 Chat</span>
        <button 
          onClick={onClose}
          className="text-neutral-400 hover:text-white transition-colors rounded-full p-1 hover:bg-neutral-700"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={chatScrollRef}
        onScroll={handleChatScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin scrollbar-thumb-neutral-700"
        style={{ 
          background: '#efeae2',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%239C92AC' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E")`
        }}
      >
        {messages.length === 0 ? (
          <p className="text-neutral-500 text-xs text-center mt-8">
            Aucun message pour l'instant...
          </p>
        ) : (
          messages.map((msg) => {
            const expId = typeof msg.expediteur === 'object' ? (msg.expediteur as any)?.id : msg.expediteur
            const isMe = expId === userId
            const fileUrl = getFullUrl(msg.fichier_url)
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="text-xs text-neutral-600 mb-0.5 px-1 font-semibold">
                    {msg.expediteur_nom || 'Utilisateur'}
                  </span>
                )}
                <div 
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                    isMe
                      ? 'bg-green-100 text-gray-900 rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm'
                  }`}
                  style={{
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* Texte */}
                  {msg.contenu && (
                    <div className="whitespace-pre-wrap">{msg.contenu}</div>
                  )}
                  
                  {/* Image */}
                  {msg.type_message === 'image' && fileUrl && (
                    <img 
                      src={fileUrl} 
                      alt="Aperçu" 
                      className="max-w-full rounded-lg mt-1 cursor-pointer"
                      style={{ maxHeight: '200px' }}
                      onClick={() => window.open(fileUrl, '_blank')}
                    />
                  )}
                  
                  {/* Vidéo */}
                  {msg.type_message === 'video' && fileUrl && (
                    <video 
                      controls 
                      src={fileUrl} 
                      className="max-w-full rounded-lg mt-1"
                      style={{ maxHeight: '200px' }}
                    />
                  )}
                  
                  {/* Audio */}
                  {msg.type_message === 'audio' && fileUrl && (
                    <div className="flex items-center gap-2 mt-1">
                      <span>{msg.is_voice_note ? '🎤' : '🎵'}</span>
                      <audio controls src={fileUrl} className="h-8" style={{ maxWidth: '180px' }} />
                    </div>
                  )}
                  
                  {/* Fichier */}
                  {msg.type_message === 'fichier' && fileUrl && (
                    <a 
                      href={fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 mt-1 text-blue-600 hover:underline"
                    >
                      📄 {msg.nom_fichier || 'Document'}
                    </a>
                  )}
                  
                  {/* Heure */}
                  <div className={`text-xs mt-1 ${isMe ? 'text-green-700' : 'text-gray-500'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input cachés */}
      <input type="file" ref={photoInputRef} accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)); setShowAttachMenu(false) }} />
      <input type="file" ref={docInputRef} multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files) setSelectedFiles(Array.from(e.target.files)); setShowAttachMenu(false) }} />

      {/* Prévisualisation fichiers */}
      {(selectedFiles.length > 0 || audioBlob) && (
        <div className="px-3 py-2 bg-neutral-800 border-t border-neutral-700 flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2 px-2 py-1 bg-neutral-700 rounded-lg text-xs text-white">
              <span>{file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('video/') ? '🎬' : '📄'}</span>
              <span className="max-w-[80px] truncate">{file.name}</span>
              <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-300">✕</button>
            </div>
          ))}
          {audioBlob && (
            <div className="flex items-center gap-2 px-2 py-1 bg-green-900/30 rounded-lg text-xs text-green-300">
              <span>🎤</span>
              <span>Vocal prêt</span>
              <button type="button" onClick={() => setAudioBlob(null)} className="text-red-400 hover:text-red-300">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Menu attachement */}
      {showAttachMenu && (
        <>
          <div className="absolute inset-0 z-10" onClick={() => setShowAttachMenu(false)} />
          <div className="absolute bottom-16 left-3 z-20 bg-white rounded-xl shadow-2xl p-2 flex flex-col gap-1 min-w-[180px]">
            <button 
              type="button" 
              onClick={() => photoInputRef.current?.click()} 
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition text-left"
            >
              <span className="bg-blue-100 p-2 rounded-full text-lg">📷</span>
              <div>
                <div className="font-semibold text-sm text-gray-900">Photo & Vidéo</div>
                <div className="text-xs text-gray-500">Galerie ou caméra</div>
              </div>
            </button>
            <div className="h-px bg-gray-200" />
            <button 
              type="button" 
              onClick={() => docInputRef.current?.click()} 
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition text-left"
            >
              <span className="bg-purple-100 p-2 rounded-full text-lg">📄</span>
              <div>
                <div className="font-semibold text-sm text-gray-900">Document</div>
                <div className="text-xs text-gray-500">PDF, Word, etc.</div>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Barre de saisie */}
      <form onSubmit={handleSendMessage} className="px-3 py-3 border-t border-neutral-700 flex items-center gap-2">
        {/* Attachement */}
        <button
          type="button"
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          className={`mini-chat-icon-btn mini-chat-attach-btn${showAttachMenu ? ' mini-chat-attach-active' : ''} w-9 h-9 rounded-full text-neutral-400 hover:text-blue-400 hover:bg-neutral-800`}
          title="Joindre un fichier"
        >
          <MiniChatAttachIcon />
        </button>

        {/* Input texte */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écrire un message..."
          className="flex-1 bg-neutral-800 text-white text-sm rounded-xl px-3 py-2 outline-none border border-neutral-700 focus:border-blue-500 placeholder-neutral-500 transition-colors"
        />

        {/* Micro */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`mini-chat-icon-btn w-9 h-9 rounded-full ${isRecording ? 'bg-red-500 text-white mini-chat-mic-recording' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
          title={isRecording ? "Arrêter" : "Note vocale"}
        >
          {isRecording ? <MiniChatStopIcon /> : <MiniChatMicIcon />}
        </button>

        {/* Envoyer */}
        <button
          type="submit"
          disabled={!input.trim() && selectedFiles.length === 0 && !audioBlob}
          className="w-9 h-9 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────
// BARRE DE CONTRÔLES PRINCIPALE
// ─────────────────────────────────────────────
interface ControlBarProps {
  role: 'eleve' | 'professeur' | 'admin' | 'direction'
  onLeave?: () => void
  isChatOpen: boolean
  onToggleChat: () => void
  unreadCount: number
  isRecording: boolean
  isRecordingLoading: boolean
  canRecord: boolean
  onToggleRecording: () => void
}

function ControlBar({
  role,
  onLeave,
  isChatOpen,
  onToggleChat,
  unreadCount,
  isRecording,
  isRecordingLoading,
  canRecord,
  onToggleRecording,
}: ControlBarProps) {
  const { localParticipant } = useLocalParticipant()

  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(role === 'professeur')
  const [screenSharing, setScreenSharing] = useState(false)

  const canShareScreen = ['professeur', 'eleve'].includes(role)

  // Toggle micro
  const toggleMic = useCallback(async () => {
    if (!localParticipant) return
    const next = !micEnabled
    await localParticipant.setMicrophoneEnabled(next)
    setMicEnabled(next)
  }, [localParticipant, micEnabled])

  // Toggle caméra
  const toggleCam = useCallback(async () => {
    if (!localParticipant) return
    const next = !camEnabled
    await localParticipant.setCameraEnabled(next)
    setCamEnabled(next)
  }, [localParticipant, camEnabled])

  // Toggle partage d'écran
  const toggleScreen = useCallback(async () => {
    if (!localParticipant || !canShareScreen) return
    try {
      const next = !screenSharing
      await localParticipant.setScreenShareEnabled(next)
      setScreenSharing(next)
    } catch (err) {
      console.error('Partage écran annulé', err)
    }
  }, [localParticipant, screenSharing, canShareScreen])

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[9999] flex items-center justify-center pb-4 px-4">
      {/* Fond flou style Meet */}
      <div className="flex items-center gap-2 bg-neutral-900/90 backdrop-blur-md border border-neutral-700/50 rounded-2xl px-4 py-2.5 shadow-2xl">

        {/* ── MICRO ── */}
        <ControlButton
          active={micEnabled}
          onClick={toggleMic}
          activeLabel="Micro activé"
          inactiveLabel="Micro coupé"
          activeColor="bg-neutral-700 hover:bg-neutral-600"
          inactiveColor="bg-danger-600 hover:bg-danger-700"
          activeIcon={<MicOnIcon />}
          inactiveIcon={<MicOffIcon />}
        />

        {/* ── CAMÉRA ── */}
        <ControlButton
          active={camEnabled}
          onClick={toggleCam}
          activeLabel="Caméra activée"
          inactiveLabel="Caméra désactivée"
          activeColor="bg-neutral-700 hover:bg-neutral-600"
          inactiveColor="bg-danger-600 hover:bg-danger-700"
          activeIcon={<CamOnIcon />}
          inactiveIcon={<CamOffIcon />}
        />

        {/* ── PARTAGE ÉCRAN ── */}
        {canShareScreen && (
          <ControlButton
            active={screenSharing}
            onClick={toggleScreen}
            activeLabel="Arrêter le partage"
            inactiveLabel="Partager l'écran"
            activeColor="bg-primary-600 hover:bg-primary-700"
            inactiveColor="bg-neutral-700 hover:bg-neutral-600"
            activeIcon={<ScreenOffIcon />}
            inactiveIcon={<ScreenOnIcon />}
          />
        )}

        {/* ── SÉPARATEUR ── */}
        <div className="w-px h-8 bg-neutral-700 mx-1" />

        {/* ── ENREGISTREMENT ── */}
        {canRecord && (
          <ControlButton
            active={isRecording}
            onClick={onToggleRecording}
            disabled={isRecordingLoading}
            activeLabel="Stop enregistrement"
            inactiveLabel="Enregistrer"
            activeColor="bg-danger-600 hover:bg-danger-700 animate-pulse"
            inactiveColor="bg-neutral-700 hover:bg-neutral-600"
            activeIcon={isRecordingLoading ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="text-sm font-bold">⏹</span>}
            inactiveIcon={isRecordingLoading ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="w-3 h-3 rounded-full bg-red-500 block" />}
          />
        )}

        {/* ── CHAT ── */}
        <div className="relative">
          <ControlButton
            active={isChatOpen}
            onClick={onToggleChat}
            activeLabel="Fermer le chat"
            inactiveLabel="Ouvrir le chat"
            activeColor="bg-primary-600 hover:bg-primary-700"
            inactiveColor="bg-neutral-700 hover:bg-neutral-600"
            activeIcon={<ChatIcon />}
            inactiveIcon={<ChatIcon />}
          />
          {/* Badge messages non lus */}
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>

        {/* ── SÉPARATEUR ── */}
        <div className="w-px h-8 bg-neutral-700 mx-1" />

        {/* ── QUITTER ── */}
        <button
          onClick={() => onLeave?.()}
          title="Quitter le cours"
          className="flex items-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-danger-600/30"
        >
          <LeaveIcon />
          <span className="hidden sm:inline">Quitter</span>
        </button>
      </div>
    </div>
  )
}

// Bouton de contrôle générique
interface ControlButtonProps {
  active: boolean
  onClick: () => void
  activeLabel: string
  inactiveLabel: string
  activeColor: string
  inactiveColor: string
  activeIcon: React.ReactNode
  inactiveIcon: React.ReactNode
  disabled?: boolean
}

function ControlButton({
  active, onClick, activeLabel, inactiveLabel,
  activeColor, inactiveColor, activeIcon, inactiveIcon,
  disabled = false
}: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={active ? activeLabel : inactiveLabel}
      className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 text-white
        ${active ? activeColor : inactiveColor}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}
      `}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  )
}

// ─────────────────────────────────────────────
// COMPOSANT INTERNE (dans contexte LiveKitRoom)
// ─────────────────────────────────────────────
interface VideoRoomContentProps {
  role: 'eleve' | 'professeur' | 'admin' | 'direction'
  classe: Class
  isModerator: boolean
  onLeave?: () => void
  isRecording: boolean
  isRecordingLoading: boolean
  canRecord: boolean
  onToggleRecording: () => void
  localIdentity: string
  userId?: string
  userName?: string
}

function VideoRoomContent({
  role, classe, isModerator, onLeave,
  isRecording, isRecordingLoading, canRecord, onToggleRecording, localIdentity,
  userId, userName
}: VideoRoomContentProps) {
  const connectionState = useConnectionState()
  const room = useRoomContext()
  const { chatMessages } = useChat()

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const prevMsgCount = useRef(0)

  // Compteur messages non lus quand chat fermé
  useEffect(() => {
    if (!isChatOpen && chatMessages.length > prevMsgCount.current) {
      setUnreadCount(c => c + (chatMessages.length - prevMsgCount.current))
    }
    prevMsgCount.current = chatMessages.length
  }, [chatMessages, isChatOpen])

  const handleToggleChat = () => {
    setIsChatOpen(v => !v)
    if (!isChatOpen) setUnreadCount(0)
  }

  useEffect(() => {
    if (!room) return
    room.on(RoomEvent.Disconnected, () => console.log('ROOM DISCONNECTED'))
    return () => { room.removeAllListeners() }
  }, [room])

  if (connectionState === ConnectionState.Disconnected) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-900">
        <p className="text-neutral-400">Déconnecté</p>
      </div>
    )
  }

  return (
    <>
      {/* ── HEADER ── */}
      <div className="bg-neutral-900/80 backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 border-b border-neutral-800 z-20 relative">
        <h3 className="text-white font-semibold text-sm">{classe.nom}</h3>
        {/* <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
          connectionState === ConnectionState.Connected
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
        }`}>
          {connectionState === ConnectionState.Connected ? '🔴 En direct' : '⏳ Connexion...'}
        </span> */}
        {isRecording && (
          <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-danger-500/20 text-danger-400 border border-danger-500/30 animate-pulse">
            ⏺ Enregistrement
          </span>
        )}
      </div>

      {/* ── VIDÉO ── */}
      <div className="flex-1 min-h-0 relative">
        {/* VideoConference occupe tout l'espace, avec padding bas pour la barre */}
        <div className="absolute inset-0 pb-20">
          <VideoConference />
        </div>

        {/* ── CHAT MINIATURE ── */}
        {isChatOpen && (
          <MiniChat 
            onClose={handleToggleChat} 
            identity={localIdentity}
            classeId={classe.id}
            userId={userId}
            userName={userName}
          />
        )}

        {/* ── BARRE DE CONTRÔLES ── */}
        <ControlBar
          role={role}
          onLeave={onLeave}
          isChatOpen={isChatOpen}
          onToggleChat={handleToggleChat}
          unreadCount={unreadCount}
          isRecording={isRecording}
          isRecordingLoading={isRecordingLoading}
          canRecord={canRecord}
          onToggleRecording={onToggleRecording}
        />
      </div>
    </>
  )
}

// ─────────────────────────────────────────────
// COMPOSANT PRINCIPAL (fournit contexte LiveKit)
// ─────────────────────────────────────────────
export default function VideoRoom({
  classe, seance, role, onLeave,
  roomName, token, serverUrl,
  isModerator = false,
  userId,
  userName,
}: VideoRoomProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [startedEgressIds, setStartedEgressIds] = useState<string[]>([])
  const permissionStreamRef = useRef<MediaStream | null>(null)

  // Identité locale extraite du token (décodage basique JWT)
  const localIdentity = (() => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub || payload.identity || 'moi'
    } catch { return 'moi' }
  })()

  useEffect(() => {
    const initPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: role === 'professeur',
        })
        permissionStreamRef.current = stream
      } catch (err) {
        console.warn('⚠️ Permissions refusées', err)
      }
    }
    initPermissions()
    return () => {
      permissionStreamRef.current?.getTracks().forEach(t => t.stop())
      permissionStreamRef.current = null
    }
  }, [role])

  const canRecord = ['professeur', 'admin', 'direction'].includes(role)
  const [isRecordingLoading, setIsRecordingLoading] = useState(false)
  
  const toggleRecording = async () => {
    if (!canRecord) return
    setIsRecordingLoading(true)
    
    try {
      if (isRecording && startedEgressIds.length > 0) {
        // MODE ARRÊT : on envoie les egress_ids qu'on a démarrés
        const res = await api.post(`/classes/${classe.id}/toggle-recording/`, {
          room_name: roomName,
          egress_ids_to_stop: startedEgressIds
        })
        
        if (res.data.status === 'stopped') {
          setIsRecording(false)
          setStartedEgressIds([]) // On vide la liste
          alert(`⏹️ ${res.data.message}`)
        }
      } else {
        // MODE DÉMARRAGE : on lance un nouvel enregistrement
        const res = await api.post(`/classes/${classe.id}/toggle-recording/`, {
          room_name: roomName
        })
        
        if (res.data.status === 'started') {
          setIsRecording(true)
          // On stocke les nouveaux egress_ids
          const newIds = res.data.jobs.map((j: any) => j.egress_id)
          setStartedEgressIds(prev => [...prev, ...newIds])
          alert(`🔴 ${res.data.message}`)
        }
      }
    } catch (err: any) {
      console.error("Erreur enregistrement:", err)
      alert("❌ " + (err.response?.data?.error || err.message))
    } finally {
      setIsRecordingLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-neutral-900 rounded-lg overflow-hidden relative">
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={true}
        audio={true}
        video={role === 'professeur'}
        screen={['professeur', 'eleve'].includes(role)}
        options={{
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h720],
            videoCodec: 'vp8',
            dtx: true,
          },
        }}
        className="flex-1 min-h-0 lk-theme-dark flex flex-col"
      >
        <VideoRoomContent
          role={role}
          classe={classe}
          isModerator={isModerator}
          onLeave={onLeave}
          isRecording={isRecording}
          isRecordingLoading={isRecordingLoading}
          canRecord={canRecord}
          onToggleRecording={toggleRecording}
          localIdentity={localIdentity}
          userId={userId}
          userName={userName}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  )
}
