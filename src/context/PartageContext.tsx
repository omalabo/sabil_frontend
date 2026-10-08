import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'
import { useBroadcastSocket } from '../hooks/useBroadcastSocket'

export type TabPartageable = 'tableau' | 'editeur'

interface PartageState {
  channel: TabPartageable | null
  byUserId: string | null
  byUserName: string | null
}

interface Publisher {
  publish: (stream: MediaStream, name: string) => Promise<void>
  unpublish: (name: string) => void
}

interface PartageContextValue {
  state: PartageState
  userId?: string
  isSharedByMe: (tab: TabPartageable) => boolean
  isLive: (tab: TabPartageable) => boolean
  markAsSeen: (tab: TabPartageable) => void
  startShare: (tab: TabPartageable) => void
  stopShare: () => void
  registerPublisher: (p: Publisher | null) => void
  publishStream: (stream: MediaStream, name: string) => Promise<boolean>
  unpublishStream: (name: string) => void
  hasPublisher: boolean
  setActiveSession: (classeId: string | null, seanceId: string | null, userId?: string, userName?: string) => void
}

const PartageContext = createContext<PartageContextValue | null>(null)

export function PartageProvider({ children }: { children: ReactNode }) {
  // ── Session active (classe/séance/utilisateur courant) ──────────────
  // Mise à jour dynamiquement par ClasseDetail via setActiveSession,
  // car ce Provider vit au-dessus du routeur et ne connaît rien au départ.
  const [session, setSession] = useState<{
    classeId: string | null
    seanceId: string | null
    userId?: string
    userName?: string
  }>({ classeId: null, seanceId: null })

  const [state, setState] = useState<PartageState>({ channel: null, byUserId: null, byUserName: null })
  const vusRef = useRef<Set<TabPartageable>>(new Set())
  const publisherRef = useRef<Publisher | null>(null)
  const [hasPublisher, setHasPublisher] = useState(false)
  const [, forceRender] = useState(0)

  // ── Websocket 'partage' — reconnecte automatiquement dès que
  // session.classeId / session.seanceId changent ──────────────────────
  const { send } = useBroadcastSocket('partage', session.classeId, session.seanceId, (data) => {
    if (data.type === 'share_start') {
      setState({ channel: data.channel, byUserId: data.user_id, byUserName: data.user_name })
      vusRef.current.delete(data.channel) // nouveau partage → redevient "non vu" pour tout le monde
      forceRender(n => n + 1)
    } else if (data.type === 'share_stop') {
      setState({ channel: null, byUserId: null, byUserName: null })
    }
  })

  const setActiveSession = useCallback((
    classeId: string | null,
    seanceId: string | null,
    userId?: string,
    userName?: string
  ) => {
    setSession(prev => {
      // Évite un re-render inutile si rien n'a changé
      if (prev.classeId === classeId && prev.seanceId === seanceId && prev.userId === userId) return prev
      return { classeId, seanceId, userId, userName }
    })
    // On change de classe → on réinitialise l'état de partage local, car il
    // appartient à l'ancienne salle (le nouveau sera reçu via request_state)
    setState({ channel: null, byUserId: null, byUserName: null })
    vusRef.current = new Set()
  }, [])

  const startShare = useCallback((tab: TabPartageable) => {
    setState({ channel: tab, byUserId: session.userId ?? null, byUserName: session.userName ?? null })
    send({ type: 'share_start', channel: tab, user_id: session.userId, user_name: session.userName })
  }, [send, session.userId, session.userName])

  const stopShare = useCallback(() => {
    setState({ channel: null, byUserId: null, byUserName: null })
    send({ type: 'share_stop' })
  }, [send])

  const markAsSeen = useCallback((tab: TabPartageable) => {
    vusRef.current.add(tab)
    forceRender(n => n + 1)
  }, [])

  const isSharedByMe = useCallback(
    (tab: TabPartageable) => state.channel === tab && state.byUserId === session.userId,
    [state, session.userId]
  )

  const isLive = useCallback(
    (tab: TabPartageable) => state.channel === tab && !vusRef.current.has(tab),
    [state]
  )

  const registerPublisher = useCallback((p: Publisher | null) => {
    publisherRef.current = p
    setHasPublisher(!!p)
  }, [])

  const publishStream = useCallback(async (stream: MediaStream, name: string) => {
    if (!publisherRef.current) {
      console.warn('Aucune salle vidéo connectée — impossible de partager.')
      return false
    }
    await publisherRef.current.publish(stream, name)
    return true
  }, [])

  const unpublishStream = useCallback((name: string) => {
    publisherRef.current?.unpublish(name)
  }, [])

  return (
    <PartageContext.Provider value={{
      state,
      userId: session.userId,
      isSharedByMe,
      isLive,
      markAsSeen,
      startShare,
      stopShare,
      registerPublisher,
      publishStream,
      unpublishStream,
      hasPublisher,
      setActiveSession,
    }}>
      {children}
    </PartageContext.Provider>
  )
}

export function usePartage() {
  const ctx = useContext(PartageContext)
  if (!ctx) throw new Error('usePartage doit être utilisé dans PartageProvider')
  return ctx
}
