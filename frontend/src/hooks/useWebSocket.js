import { useEffect, useRef, useState, useCallback } from 'react'

export function useLiveResults(assessmentId) {
  const [data, setData]           = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef   = useRef(null)
  const retryRef = useRef(null)
  const retries  = useRef(0)

  const connect = useCallback(() => {
    if (!assessmentId) return
    const wsUrl = `ws://${window.location.hostname}:8000/api/v1/results/live/${assessmentId}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => { setIsConnected(true); retries.current = 0 }
    ws.onmessage = (e) => {
      try { setData(JSON.parse(e.data)) } catch {}
    }
    ws.onclose = () => {
      setIsConnected(false)
      const delay = Math.min(1000 * 2 ** retries.current, 30000)
      retries.current++
      retryRef.current = setTimeout(connect, delay)
    }
    ws.onerror = () => ws.close()
  }, [assessmentId])

  useEffect(() => {
    setData(null)
    setIsConnected(false)
    retries.current = 0
    connect()
    return () => {
      clearTimeout(retryRef.current)
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onmessage = null
        wsRef.current.onerror = null
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return { data, isConnected }
}
