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

interface VideoRoomProps {
  classe: Class
  seance?: Seance
  role: 'eleve' | 'professeur' | 'admin' | 'direction'
  onLeave?: () => void
  roomName: string
  token: string
  serverUrl: string
  isModerator?: boolean
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

// ─────────────────────────────────────────────
// CHAT INTÉGRÉ MINIATURE (style Meet)
// ─────────────────────────────────────────────
function MiniChat({ onClose, identity }: { onClose: () => void; identity: string }) {
  const { chatMessages, send, isSending } = useChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || isSending) return
    await send(msg)
    setInput('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="absolute bottom-24 right-4 z-40 w-80 flex flex-col bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden"
         style={{ height: '420px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-800 border-b border-neutral-700">
        <span className="text-white font-semibold text-sm tracking-wide">💬 Chat du cours</span>
        <button onClick={onClose}
          className="text-neutral-400 hover:text-white transition-colors rounded-full p-1 hover:bg-neutral-700">
          <CloseIcon />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scrollbar-thin scrollbar-thumb-neutral-700">
        {chatMessages.length === 0 && (
          <p className="text-neutral-500 text-xs text-center mt-8">
            Aucun message pour l'instant...
          </p>
        )}
        {chatMessages.map((msg) => {
          const isMe = msg.from?.identity === identity
          return (
            <div key={msg.timestamp} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && (
                <span className="text-xs text-neutral-400 mb-0.5 px-1">
                  {msg.from?.name || msg.from?.identity || 'Anonyme'}
                </span>
              )}
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                isMe
                  ? 'bg-primary-600 text-white rounded-br-sm'
                  : 'bg-neutral-700 text-neutral-100 rounded-bl-sm'
              }`}>
                {msg.message}
              </div>
              <span className="text-xs text-neutral-600 mt-0.5 px-1">
                {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-neutral-700 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Écrire un message..."
          className="flex-1 bg-neutral-800 text-white text-sm rounded-xl px-3 py-2 outline-none border border-neutral-700 focus:border-primary-500 placeholder-neutral-500 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          className="p-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
        >
          <SendIcon />
        </button>
      </div>
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
            activeLabel="Stop enregistrement"
            inactiveLabel="Enregistrer"
            activeColor="bg-danger-600 hover:bg-danger-700 animate-pulse"
            inactiveColor="bg-neutral-700 hover:bg-neutral-600"
            activeIcon={<span className="text-sm font-bold">⏹</span>}
            inactiveIcon={<span className="w-3 h-3 rounded-full bg-danger-500 block" />}
            disabled={false}
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
  canRecord: boolean
  onToggleRecording: () => void
  localIdentity: string
}

function VideoRoomContent({
  role, classe, isModerator, onLeave,
  isRecording, canRecord, onToggleRecording, localIdentity
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
        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
          connectionState === ConnectionState.Connected
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
        }`}>
          {connectionState === ConnectionState.Connected ? '🔴 En direct' : '⏳ Connexion...'}
        </span>
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
          <MiniChat onClose={handleToggleChat} identity={localIdentity} />
        )}

        {/* ── BARRE DE CONTRÔLES ── */}
        <ControlBar
          role={role}
          onLeave={onLeave}
          isChatOpen={isChatOpen}
          onToggleChat={handleToggleChat}
          unreadCount={unreadCount}
          isRecording={isRecording}
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
}: VideoRoomProps) {
  const [isRecording, setIsRecording] = useState(false)
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

  const toggleRecording = async () => {
    if (!canRecord) return
    console.log('🔴 Egress API à implémenter')
    setIsRecording(v => !v)
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
          canRecord={canRecord}
          onToggleRecording={toggleRecording}
          localIdentity={localIdentity}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  )
}