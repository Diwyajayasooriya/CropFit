// ============================================================
// CropFit — WebSocket Helper for Django Channels
// Handles connection, reconnection with exponential backoff,
// message parsing, and typed event callbacks.
// ============================================================

import type { WSMessage, WSMessageType } from '@/types';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws';

export interface WSOptions {
  /** Path appended to WS_BASE, e.g. "/dashboard/" */
  path: string;
  /** JWT token to send in query string for Django Channels auth */
  token?: string;
  /** Called when connection opens */
  onOpen?: () => void;
  /** Called on every parsed message */
  onMessage?: (msg: WSMessage) => void;
  /** Called when connection closes (before reconnect attempt) */
  onClose?: (event: CloseEvent) => void;
  /** Called on error */
  onError?: (event: Event) => void;
  /** Max reconnection attempts (default 10) */
  maxRetries?: number;
  /** Whether to attempt reconnection (default true) */
  autoReconnect?: boolean;
}

export class CropFitWebSocket {
  private ws: WebSocket | null = null;
  private options: Required<WSOptions>;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Map<WSMessageType, Set<(payload: unknown) => void>> = new Map();
  private _isConnected = false;
  private _isManualClose = false;

  constructor(options: WSOptions) {
    this.options = {
      token: '',
      onOpen: () => {},
      onMessage: () => {},
      onClose: () => {},
      onError: () => {},
      maxRetries: 10,
      autoReconnect: true,
      ...options,
    };
  }

  /** Whether the socket is currently open */
  get isConnected() {
    return this._isConnected;
  }

  /** Connect to the WebSocket server */
  connect() {
    this._isManualClose = false;
    this.retryCount = 0;
    this._connect();
  }

  private _connect() {
    // Clean up any existing connection
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    }

    // Build URL with token auth (Django Channels pattern)
    let url = `${WS_BASE}${this.options.path}`;
    if (this.options.token) {
      url += `?token=${encodeURIComponent(this.options.token)}`;
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._isConnected = true;
      this.retryCount = 0;
      this.options.onOpen();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        this.options.onMessage(msg);

        // Dispatch to type-specific listeners
        const typeListeners = this.listeners.get(msg.type);
        if (typeListeners) {
          typeListeners.forEach((cb) => cb(msg.payload));
        }
      } catch (err) {
        console.error('[CropFit WS] Failed to parse message:', err);
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this._isConnected = false;
      this.options.onClose(event);

      if (!this._isManualClose && this.options.autoReconnect) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = (event: Event) => {
      this.options.onError(event);
    };
  }

  /** Exponential backoff reconnect: 1s, 2s, 4s, 8s, … capped at 30s */
  private _scheduleReconnect() {
    if (this.retryCount >= this.options.maxRetries) {
      console.warn('[CropFit WS] Max retries reached. Giving up.');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30_000);
    this.retryCount++;

    console.log(`[CropFit WS] Reconnecting in ${delay}ms (attempt ${this.retryCount}/${this.options.maxRetries})`);

    this.retryTimer = setTimeout(() => {
      this._connect();
    }, delay);
  }

  /** Subscribe to a specific message type */
  on<T = unknown>(type: WSMessageType, callback: (payload: T) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback as (payload: unknown) => void);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(callback as (payload: unknown) => void);
    };
  }

  /** Send a message to the server */
  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[CropFit WS] Cannot send — socket not open');
    }
  }

  /** Gracefully close the connection (no reconnect) */
  disconnect() {
    this._isManualClose = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
    this.listeners.clear();
  }

  /** Reset retry counter and force a new connection */
  reconnect() {
    this.disconnect();
    this.connect();
  }
}

// --------------- Factory ---------------

/**
 * Create a WebSocket connection to a Django Channels consumer.
 *
 * @example
 * const ws = createWebSocket({
 *   path: '/dashboard/',
 *   token: accessToken,
 *   onMessage: (msg) => console.log(msg),
 * });
 * ws.connect();
 *
 * // Listen for specific message types
 * ws.on<SensorReading>('sensor_update', (reading) => {
 *   updateTile(reading);
 * });
 *
 * // Cleanup
 * ws.disconnect();
 */
export function createWebSocket(options: WSOptions): CropFitWebSocket {
  return new CropFitWebSocket(options);
}
