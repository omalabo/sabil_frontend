import { useEffect, useRef, useCallback } from 'react'

export function useBroadcastSocket(
  channel: 'partage' | 'editeur',
  classeId: string | null,
  seanceId: string | null,
  onMessage: (data: any) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    if (!classeId || !seanceId) return
    const token = localStorage.getItem('sabil_token')
    const wsUrl = `wss://api.sabil-al-ilm.org/ws/session/${channel}/${classeId}/${seanceId}/?token=${token}`
    let ws: WebSocket
    let stopped = false

    const connect = () => {
      ws = new WebSocket(wsUrl)
      wsRef.current = ws
      ws.onopen = () => { ws.send(JSON.stringify({ type: 'request_state' })) } // 🆕
      ws.onmessage = e => {
        try { onMessageRef.current(JSON.parse(e.data)) } catch {}
      }
      ws.onclose = () => { if (!stopped) setTimeout(connect, 3000) }
    }
    connect()
    return () => { stopped = true; ws?.close() }
  }, [channel, classeId, seanceId])

  return { send }
}
