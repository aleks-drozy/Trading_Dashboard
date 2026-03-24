import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"

interface Signal {
  symbol: string
  ifvg_state: string
  cisd_state: string
  ema_condition: string
  ema_value: number
  updated_at: string
}

interface SignalMessage {
  type: "signal_update"
  ny_session_active: boolean
  signals: Signal[]
}

type WSStatus = "connecting" | "connected" | "disconnected"

export function useSignalWebSocket() {
  const { token } = useAuth()
  const [signals, setSignals] = useState<Signal[]>([])
  const [nySessionActive, setNySessionActive] = useState(false)
  const [wsStatus, setWsStatus] = useState<WSStatus>("disconnected")
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const connectRef = useRef<(() => void) | null>(null)
  const maxRetries = 10

  const connect = useCallback(() => {
    if (!token) return

    setWsStatus("connecting")
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/signals?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus("connected")
      retriesRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const data: SignalMessage = JSON.parse(event.data)
        if (data.type === "signal_update") {
          setSignals(data.signals)
          setNySessionActive(data.ny_session_active)
        }
      } catch (e) {
        console.error("Failed to parse WS message:", e)
      }
    }

    ws.onclose = () => {
      setWsStatus("disconnected")
      wsRef.current = null
      if (retriesRef.current < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000)
        retriesRef.current += 1
        setTimeout(() => connectRef.current?.(), delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [token])

  useEffect(() => {
    connectRef.current = connect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  return { signals, nySessionActive, wsStatus }
}
