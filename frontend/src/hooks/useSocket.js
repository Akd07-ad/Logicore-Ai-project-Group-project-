import { useCallback, useEffect, useRef, useState } from 'react';

const RECONNECT_DELAY_MS = 1500;

export default function useSocket(url, { onMessage, enabled = true } = {}) {
  const socketRef = useRef(null);
  const connectRef = useRef(() => {});
  const onMessageRef = useRef(onMessage);
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [readyState, setReadyState] = useState(WebSocket.CLOSED);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const clearReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !url) return;
    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;
      setReadyState(socket.readyState);

      socket.onopen = () => {
        setConnectionError(null);
        setIsConnected(true);
        setReadyState(WebSocket.OPEN);
      };

      socket.onmessage = (event) => {
        let payload = event.data;
        try {
          payload = JSON.parse(event.data);
        } catch {
          payload = event.data;
        }
        if (onMessageRef.current) {
          onMessageRef.current(payload);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        setReadyState(WebSocket.CLOSED);
        if (shouldReconnectRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connectRef.current();
          }, RECONNECT_DELAY_MS);
        }
      };

      socket.onerror = (error) => {
        setConnectionError(error || new Error('WebSocket connection failed'));
        setReadyState(WebSocket.CLOSING);
        socket.close();
      };
    } catch (error) {
      setConnectionError(error);
      setIsConnected(false);
      setReadyState(WebSocket.CLOSED);
    }
  }, [enabled, url]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!enabled || !url) return undefined;
    shouldReconnectRef.current = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearReconnect();
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [clearReconnect, connect, enabled, url]);

  const sendMessage = useCallback((message) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return false;
    socketRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
    return true;
  }, []);

  return { isConnected, sendMessage, readyState, connectionError };
}
