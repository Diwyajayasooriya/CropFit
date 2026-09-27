// ============================================================
// CropFit — useWebSocket Hook
// React hook wrapper around CropFitWebSocket for component use.
// ============================================================

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { CropFitWebSocket, createWebSocket, type WSOptions } from '@/lib/websocket';
import type { WSMessage, WSMessageType } from '@/types';

interface UseWebSocketOptions {
  /** WebSocket path, e.g. "/dashboard/" */
  path: string;
  /** JWT access token */
  token?: string;
  /** Whether to connect automatically (default: true) */
  enabled?: boolean;
  /** Message handler */
  onMessage?: (msg: WSMessage) => void;
  /** Connection status change handler */
  onConnectionChange?: (connected: boolean) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { path, token, enabled = true, onMessage, onConnectionChange } = options;
  const wsRef = useRef<CropFitWebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !token) return;

    const ws = createWebSocket({
      path,
      token,
      onOpen: () => onConnectionChange?.(true),
      onClose: () => onConnectionChange?.(false),
      onMessage,
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, token, enabled]);

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(data);
  }, []);

  const on = useCallback(<T = unknown>(type: WSMessageType, cb: (payload: T) => void) => {
    return wsRef.current?.on(type, cb);
  }, []);

  return { send, on, ws: wsRef.current };
}
