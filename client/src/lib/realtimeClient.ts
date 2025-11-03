import { REALTIME_CHANNELS, PURCHASE_REQUEST_EVENTS } from "@shared/realtime-events";

export type RealtimeStatus = "offline" | "connecting" | "connected" | "reconnecting";

export interface RealtimeEventMessage<TPayload = unknown> {
  channel: string;
  event: string;
  payload?: TPayload;
  timestamp?: string;
}

type EventListener = (event: RealtimeEventMessage) => void;
type StatusListener = (status: RealtimeStatus) => void;

const MAX_RECONNECT_DELAY = 10000;

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private readonly channelListeners = new Map<string, Set<EventListener>>();
  private readonly statusListeners = new Set<StatusListener>();
  private status: RealtimeStatus = "offline";

  subscribe(channel: string, listener: EventListener): () => void {
    const listeners = this.channelListeners.get(channel) ?? new Set<EventListener>();
    listeners.add(listener);
    this.channelListeners.set(channel, listeners);

    this.ensureConnection();

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: "subscribe", channel });
    }

    return () => {
      const channelListeners = this.channelListeners.get(channel);
      if (!channelListeners) {
        return;
      }

      channelListeners.delete(listener);
      if (channelListeners.size === 0) {
        this.channelListeners.delete(channel);
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.send({ type: "unsubscribe", channel });
        }
      }

      this.evaluateConnectionState();
    };
  }

  connect() {
    if (!this.shouldRemainConnected()) {
      this.updateStatus("offline");
      return;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/ws`;

    try {
      this.socket = new WebSocket(url);
    } catch (error) {
      this.scheduleReconnect();
      return;
    }

    this.updateStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    this.socket.addEventListener("open", () => {
      if (this.reconnectTimer) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.reconnectAttempts = 0;
      this.updateStatus("connected");
      this.resubscribeAll();
    });

    this.socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    this.socket.addEventListener("close", () => {
      this.socket = null;
      if (this.shouldRemainConnected()) {
        this.scheduleReconnect();
      } else {
        this.updateStatus("offline");
      }
    });

    this.socket.addEventListener("error", () => {
      this.updateStatus("reconnecting");
      this.socket?.close();
    });
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    this.ensureConnection();

    return () => {
      this.statusListeners.delete(listener);
      this.evaluateConnectionState();
    };
  }

  getStatus(): RealtimeStatus {
    return this.status;
  }

  private ensureConnection() {
    if (typeof window === "undefined") {
      return;
    }
    this.connect();
  }

  private shouldRemainConnected(): boolean {
    return this.channelListeners.size > 0 || this.statusListeners.size > 0;
  }

  private evaluateConnectionState() {
    if (!this.shouldRemainConnected()) {
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      if (this.reconnectTimer) {
        window.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.updateStatus("offline");
      return;
    }

    this.ensureConnection();
  }

  private resubscribeAll() {
    this.channelListeners.forEach((_listeners, channel) => {
      this.send({ type: "subscribe", channel });
    });
  }

  private handleMessage(raw: any) {
    try {
      const message = JSON.parse(raw);
      if (message.type !== "event") {
        return;
      }

      const listeners = this.channelListeners.get(message.channel);
      if (!listeners || listeners.size === 0) {
        return;
      }

      const event: RealtimeEventMessage = {
        channel: message.channel,
        event: message.event,
        payload: message.payload,
        timestamp: message.timestamp,
      };

      listeners.forEach((listener) => listener(event));
    } catch (error) {
      // Ignore malformed messages
    }
  }

  private scheduleReconnect() {
    if (!this.shouldRemainConnected()) {
      return;
    }

    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** Math.min(this.reconnectAttempts, 6), MAX_RECONNECT_DELAY);

    this.updateStatus("reconnecting");

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(payload: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  private updateStatus(status: RealtimeStatus) {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}

export const realtimeClient = new RealtimeClient();

export const REALTIME_CONSTANTS = {
  CHANNELS: REALTIME_CHANNELS,
  EVENTS: PURCHASE_REQUEST_EVENTS,
};
