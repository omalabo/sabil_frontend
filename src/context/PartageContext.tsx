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
}

const PartageContext = createContext<PartageContextValue | null>(null)

export function PartageProvider({
  classeId, seanceId, userId, userName, children,
}: {
  classeId: string | null; seanceId: string | null
  userId?: string; userName?: string; children: ReactNode
}) {
  const [state, setState] = useState<PartageState>({ channel: null, byUserId: null, byUserName: null })
  const vusRef = useRef<Set<TabPartageable>>(new Set())
  const publisherRef = useRef<Publisher | null>(null)
  const [hasPublisher, setHasPublisher] = useState(false)
  const [, forceRender] = useState(0)

  const { send } = useBroadcastSocket('partage', classeId, seanceId, (data) => {
    if (data.type === 'share_start') {
      setState({ channel: data.channel, byUserId: data.user_id, byUserName: data.user_name })
      vusRef.current.delete(data.channel)
      forceRender(n => n + 1)
    } else if (data.type === 'share_stop') {
      setState({ channel: null, byUserId: null, byUserName: null })
    }
  })

  const startShare = useCallback((tab: TabPartageable) => {
    setState({ channel: tab, byUserId: userId ?? null, byUserName: userName ?? null })
    send({ type: 'share_start', channel: tab, user_id: userId, user_name: userName })
  }, [send, userId, userName])

  const stopShare = useCallback(() => {
    setState({ channel: null, byUserId: null, byUserName: null })
    send({ type: 'share_stop' })
  }, [send])

  const markAsSeen = useCallback((tab: TabPartageable) => {
    vusRef.current.add(tab)
    forceRender(n => n + 1)
  }, [])

  const isSharedByMe = useCallback(
    (tab: TabPartageable) => state.channel === tab && state.byUserId === userId,
    [state, userId]
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
      state, userId, isSharedByMe, isLive, markAsSeen, startShare, stopShare,
      registerPublisher, publishStream, unpublishStream, hasPublisher,
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
