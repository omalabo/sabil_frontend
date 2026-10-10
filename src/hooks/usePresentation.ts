// hooks/usePresentation.ts
import { useEffect, useRef, useCallback, useState } from 'react'

export interface PresentationState {
  livreId: string | null
  page: number
  total: number
  byUserId: string | null
  byUserName: string | null
}

const INITIAL_STATE: PresentationState = {
  livreId: null, page: 1, total: 0, byUserId: null, byUserName: null
}

export function usePresentation(
  classeId: string | null,
  seanceId: string | null,
  onAnnotationEvent?: (data: any) => void,
  onScrollSync?: (x: number, y: number) => void  // 🆕 NOUVEAU
) {
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<PresentationState>(INITIAL_STATE)
  const stateRef = useRef(state)
  stateRef.current = state

  const onAnnotationRef = useRef(onAnnotationEvent)
  onAnnotationRef.current = onAnnotationEvent

  // 🆕 NOUVEAU : Ref pour le callback de scroll
  const onScrollSyncRef = useRef(onScrollSync)
  onScrollSyncRef.current = onScrollSync

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    if (!classeId || !seanceId) return
    const token = localStorage.getItem('sabil_token')
    if (!token) return

    const wsUrl = `wss://api.sabil-al-ilm.org/ws/session/partage/${classeId}/${seanceId}/?token=${token}`
    let ws: WebSocket
    let stopped = false

    const connect = () => {
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'request_state' }))
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)

          // Gestion page
          if (data.type === 'presentation_start' || data.type === 'presentation_page') {
            setState(prev => ({
              livreId: data.livre_id ?? prev.livreId,
              page: data.page ?? prev.page,
              total: data.total ?? prev.total,
              byUserId: data.user_id ?? prev.byUserId,
              byUserName: data.user_name ?? prev.byUserName,
            }))
          } else if (data.type === 'presentation_stop' || data.type === 'share_stop') {
            setState(INITIAL_STATE)
          }
          // Gestion annotations
          else if (
            data.type === 'anno_draw' ||
            data.type === 'anno_clear' ||
            data.type === 'anno_state' ||
            data.type === 'anno_page_change'
          ) {
            onAnnotationRef.current?.(data)
          }
          // 🆕 NOUVEAU : Gestion scroll sync
          else if (data.type === 'scroll_sync') {
            onScrollSyncRef.current?.(data.x, data.y)
          }
        } catch {}
      }

      ws.onclose = () => { if (!stopped) setTimeout(connect, 3000) }
    }

    connect()
    return () => { stopped = true; ws?.close() }
  }, [classeId, seanceId])

  const startPresentation = useCallback(
    (livreId: string, total: number, userId?: string, userName?: string) => {
      setState({
        livreId, page: 1, total,
        byUserId: userId ?? null,
        byUserName: userName ?? null,
      })
      send({
        type: 'presentation_start',
        livre_id: livreId, page: 1, total,
        user_id: userId, user_name: userName,
      })
      send({ type: 'anno_clear', page: 1 })
    },
    [send]
  )

  const goToPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, page }))
    send({ type: 'presentation_page', page })
    send({ type: 'anno_page_change', page })
  }, [send])

  const stopPresentation = useCallback(() => {
    setState(INITIAL_STATE)
    send({ type: 'presentation_stop' })
    send({ type: 'anno_clear', page: 0 })
  }, [send])

  // 🆕 NOUVEAU : Fonction pour envoyer la position de scroll
  const sendScrollPosition = useCallback((x: number, y: number) => {
    send({ type: 'scroll_sync', x, y })
  }, [send])

  return { state, send, startPresentation, goToPage, stopPresentation, sendScrollPosition }
}
