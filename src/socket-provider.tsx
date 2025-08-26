// src/context/SocketContext.tsx
import { createContext, useContext, useEffect, useRef, useState } from "react";

export const SocketContext = createContext<WebSocket | null>(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const baseURL = `${import.meta.env.VITE_API_URL}/ws/audio`;
  const wsRef = useRef<WebSocket | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);

  useEffect(() => {
    const connectSocket = () => {
      const ws = new WebSocket(baseURL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ Socket connected");
        reconnectAttempts.current = 0;
        setSocket(ws);

        // Heartbeat ping
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000); // every 30s

        ws.onclose = () => {
          clearInterval(pingInterval);
          handleReconnect();
        };
      };

      ws.onerror = (event) => {
        console.error("❌ WebSocket error:", event);
        handleReconnect();
      };
    };

    const handleReconnect = () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectAttempts.current += 1;
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000); // exponential backoff
      console.warn(`⚠️ Reconnecting in ${delay / 1000}s...`);

      reconnectTimeout.current = setTimeout(connectSocket, delay);
    };

    connectSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [baseURL]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
