import { randomUUID } from "crypto";
import type { Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { REALTIME_CHANNELS } from "@shared/realtime-events";

type ClientConnection = {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  isAlive: boolean;
};

type IncomingMessage =
  | { type: "subscribe"; channel: string }
  | { type: "unsubscribe"; channel: string }
  | { type: "ping" }
  | { type: string; [key: string]: unknown };

export type RealtimeEventPayload<TPayload = unknown> = {
  event: string;
  payload?: TPayload;
};

class RealtimeService {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, ClientConnection>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  attach(server: HttpServer) {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (socket) => {
      const clientId = randomUUID();
      const connection: ClientConnection = {
        id: clientId,
        socket,
        subscriptions: new Set(),
        isAlive: true,
      };

      this.clients.set(clientId, connection);

      socket.on("message", (raw) => {
        this.handleMessage(connection, raw.toString());
      });

      socket.on("close", () => {
        this.clients.delete(clientId);
      });

      socket.on("pong", () => {
        connection.isAlive = true;
      });

      this.safeSend(socket, {
        type: "connected",
        clientId,
        availableChannels: Object.values(REALTIME_CHANNELS),
      });
    });

    this.startHeartbeat();

    this.wss.on("close", () => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
      this.clients.clear();
      this.wss = null;
    });
  }

  publish<TPayload = unknown>(channel: string, event: RealtimeEventPayload<TPayload>) {
    if (!this.wss) {
      return;
    }

    const message = JSON.stringify({
      type: "event",
      channel,
      event: event.event,
      payload: event.payload,
      timestamp: new Date().toISOString(),
    });

    this.clients.forEach((client) => {
      if (
        client.socket.readyState === WebSocket.OPEN &&
        client.subscriptions.has(channel)
      ) {
        client.socket.send(message);
      }
    });
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.socket.readyState !== WebSocket.OPEN) {
          this.clients.delete(clientId);
          return;
        }

        if (!client.isAlive) {
          client.socket.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        try {
          client.socket.ping();
        } catch (error) {
          client.socket.terminate();
          this.clients.delete(clientId);
        }
      });
    }, 30000);
  }

  private handleMessage(client: ClientConnection, raw: string) {
    let message: IncomingMessage;
    try {
      message = JSON.parse(raw) as IncomingMessage;
    } catch (error) {
      this.safeSend(client.socket, {
        type: "error",
        message: "Invalid message format",
      });
      return;
    }

    switch (message.type) {
      case "subscribe":
        if (typeof message.channel === "string") {
          client.subscriptions.add(message.channel);
          this.safeSend(client.socket, {
            type: "subscribed",
            channel: message.channel,
          });
        }
        break;
      case "unsubscribe":
        if (typeof message.channel === "string") {
          client.subscriptions.delete(message.channel);
          this.safeSend(client.socket, {
            type: "unsubscribed",
            channel: message.channel,
          });
        }
        break;
      case "ping":
        this.safeSend(client.socket, { type: "pong" });
        break;
      default:
        this.safeSend(client.socket, {
          type: "error",
          message: `Unsupported message type: ${message.type}`,
        });
    }
  }

  private safeSend(socket: WebSocket, data: Record<string, unknown>) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }
}

export const realtime = new RealtimeService();

export function initRealtime(server: HttpServer) {
  realtime.attach(server);
}
