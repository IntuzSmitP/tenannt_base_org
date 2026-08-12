import { useEffect, useRef, useState, useCallback } from "react";

export function useWebSocket(slug: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  // Using a ref to store listeners so we don't have to rebind on every render
  const listeners = useRef<((event: any) => void)[]>([]);

  const connect = useCallback(() => {
    if (!slug) return;
    
    // Don't connect if already connected or connecting
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    // Use dynamic hostname like api.ts to support mobile devices testing
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    const wsBaseUrl = `${protocol}//${hostname}:8000/api/v1`;
    
    const wsUrl = `${wsBaseUrl}/ws?token=${token}&tenant=${slug}`;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        listeners.current.forEach((listener) => listener(data));
      } catch (err) {
        console.error("[WebSocket] Failed to parse message", err);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      ws.current = null;
      
      // Attempt to reconnect after 3 seconds
      if (!reconnectTimeout.current) {
        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };
    
    ws.current.onerror = (err) => {
      // In React Strict Mode, the component might unmount while connecting, throwing an abort error.
      // We only care about errors if we actually established a connection.
      if (ws.current?.readyState === WebSocket.OPEN) {
        console.error("[WebSocket] Error", err);
      }
      ws.current?.close();
    };
  }, [slug]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  const addListener = useCallback((listener: (event: any) => void) => {
    listeners.current.push(listener);
    return () => {
      listeners.current = listeners.current.filter((l) => l !== listener);
    };
  }, []);

  return { isConnected, addListener };
}
