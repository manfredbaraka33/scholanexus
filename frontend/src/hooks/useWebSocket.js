// import { useEffect, useRef, useState, useCallback } from 'react'

// // Vite automatically flags import.meta.env.PROD as true when building for Vercel
// const isProduction = import.meta.env.PROD

// export function useLiveResults(assessmentId) {
//   const [data, setData]           = useState(null)
//   const [isConnected, setIsConnected] = useState(false)
//   const wsRef   = useRef(null)
//   const retryRef = useRef(null)
//   const retries  = useRef(0)

//   const connect = useCallback(() => {
//     if (!assessmentId) return

//     // Dynamically choose secure WSS for Vercel, or local WS for dev
//     const wsUrl = isProduction
//       ? `wss://scholanexusapi.vercel.app/api/v1/results/live/${assessmentId}`
//       : `ws://localhost:8000/api/v1/results/live/${assessmentId}`

//     const ws = new WebSocket(wsUrl)
//     wsRef.current = ws

//     ws.onopen = () => { setIsConnected(true); retries.current = 0 }
//     ws.onmessage = (e) => {
//       try { setData(JSON.parse(e.data)) } catch {}
//     }
//     ws.onclose = () => {
//       setIsConnected(false)
//       const delay = Math.min(1000 * 2 ** retries.current, 30000)
//       retries.current++
//       retryRef.current = setTimeout(connect, delay)
//     }
//     ws.onerror = () => ws.close()
//   }, [assessmentId])

//   useEffect(() => {
//     setData(null)
//     setIsConnected(false)
//     retries.current = 0
//     connect()
//     return () => {
//       clearTimeout(retryRef.current)
//       if (wsRef.current) {
//         wsRef.current.onopen = null
//         wsRef.current.onmessage = null
//         wsRef.current.onerror = null
//         wsRef.current.onclose = null
//         wsRef.current.close()
//         wsRef.current = null
//       }
//     }
//   }, [connect])

//   return { data, isConnected }
// }





import { useEffect, useRef, useState, useCallback } from 'react'
import api from './api' // Adjust this path to match your file structure

export function useLiveResults(assessmentId) {
  const [data, setData] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const timeoutRef = useRef(null)
  const isMounted = useRef(true)

  const fetchResults = useCallback(async () => {
    if (!assessmentId) return

    try {
      // Using your custom axios instance handles the base URL, token, and 401 logouts automatically
      const response = await api.get(`/results/standings?assessment_id=${assessmentId}`)
      
      if (isMounted.current) {
        setData(response.data) // Axios stores the JSON payload inside .data
        setIsConnected(true)
      }
    } catch (error) {
      if (isMounted.current) {
        setIsConnected(false)
      }
    } finally {
      if (isMounted.current) {
        timeoutRef.current = setTimeout(fetchResults, 5000)
      }
    }
  }, [assessmentId])

  useEffect(() => {
    isMounted.current = true
    setData(null)
    setIsConnected(false)
    clearTimeout(timeoutRef.current)

    fetchResults()

    return () => {
      isMounted.current = false
      clearTimeout(timeoutRef.current)
    }
  }, [fetchResults])

  return { data, isConnected }
}
