
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
  onAnnotationEvent?: (data: any) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<PresentationState>(INITIAL_STATE)
  const onAnnotationRef = useRef(onAnnotationEvent)
  onAnnotationRef.current = onAnnotationEvent

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    if (!classeId || !seanceId) return
    const token = localStorage.getItem('sabil_token')
    if (!token) return

    // On réutilise le channel 'partage' existant
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

          // ── Gestion page ──
          if (data.type === 'presentation_start' || data.type === 'presentation_page') {
            setState({
              livreId: data.livre_id,
              page: data.page,
              total: data.total,
              byUserId: data.user_id ?? null,
              byUserName: data.user_name ?? null,
            })
          } else if (data.type === 'presentation_stop' || data.type === 'share_stop') {
            setState(INITIAL_STATE)
          }
          // ── Gestion annotations (forwarded vers le composant) ──
          else if (
            data.type === 'anno_draw' ||
            data.type === 'anno_clear' ||
            data.type === 'anno_state' ||
            data.type === 'anno_page_change'
          ) {
            onAnnotationRef.current?.(data)
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
      // Reset des annotations au démarrage
      send({ type: 'anno_clear', page: 1 })
    },
    [send]
  )

  const goToPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, page }))
    send({ type: 'presentation_page', page })
    // Reset des annotations à chaque page
    send({ type: 'anno_page_change', page })
  }, [send])

  const stopPresentation = useCallback(() => {
    setState(INITIAL_STATE)
    send({ type: 'presentation_stop' })
    send({ type: 'anno_clear', page: 0 })
  }, [send])

  return { state, send, startPresentation, goToPage, stopPresentation }
}
