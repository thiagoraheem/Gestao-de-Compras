import { EventEmitter } from 'events';

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  debug: boolean;
}

export interface SubscriptionOptions {
  resourceType: string;
  resourceId?: string;
  filters?: Record<string, any>;
}

export interface WebSocketMessage {
  type: 'notification' | 'heartbeat' | 'subscribe' | 'unsubscribe' | 'auth' | 'error';
  data?: any;
  subscription?: SubscriptionOptions;
  timestamp?: number;
  id?: string;
}

export interface NotificationData {
  type: string;
  resourceType: string;
  resourceId: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  userId?: string;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
  private subscriptions = new Map<string, SubscriptionOptions>();
  private isConnecting = false;
  private isAuthenticated = false;
  private lastHeartbeat = 0;
  private connectionId: string | null = null;

  constructor(config: Partial<WebSocketConfig> = {}) {
    super();
    
    // Get the correct WebSocket URL based on current location
    const getWebSocketUrl = () => {
      if (config.url) return config.url;
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      
      // Get the correct port - use window.location.port if available, otherwise use default port
      let port = window.location.port;
      if (!port || port === '' || port === '0') {
        // If no port in URL, use the default server port (5201 for development)
        port = '5201';
      }
      
      // Ensure port is a valid string and not undefined
      const portStr = String(port || '5201');
      const wsUrl = `${protocol}//${host}:${portStr}/ws`;
      console.log('WebSocket URL constructed:', wsUrl, { protocol, host, port: portStr, originalPort: window.location.port });
      return wsUrl;
    };
    
    this.config = {
      url: getWebSocketUrl(),
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      heartbeatTimeout: config.heartbeatTimeout || 15000, // Aumentado de 5s para 15s
      debug: config.debug || false
    };

    this.log('WebSocket Client initialized', this.config);
  }

  private log(message: string, data?: any) {
    if (this.config.debug) {
      console.log(`[WebSocket Client] ${message}`, data || '');
    }
  }

  private error(message: string, error?: any) {
    console.error(`[WebSocket Client] ${message}`, error || '');
    this.emit('error', { message, error });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        this.once('connected', resolve);
        this.once('error', reject);
        return;
      }

      this.isConnecting = true;
      this.log('Connecting to WebSocket server...');

      try {
        this.ws = new WebSocket(this.config.url);
        
        this.ws.onopen = () => {
          this.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.authenticate();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.log('WebSocket closed', { code: event.code, reason: event.reason });
          this.isConnecting = false;
          this.isAuthenticated = false;
          this.connectionId = null;
          this.stopHeartbeat();
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          if (!event.wasClean && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.error('WebSocket error', error);
          this.isConnecting = false;
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        this.error('Failed to create WebSocket connection', error);
        reject(error);
      }
    });
  }

  private authenticate() {
    // Para desenvolvimento, conectar como autenticado automaticamente
    // TODO: Implementar autenticação real baseada em sessão
    this.log('Connecting as authenticated user (development mode)');
    this.isAuthenticated = true;
    this.emit('authenticated');
    this.resubscribeAll();
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message: any = JSON.parse(event.data);
      this.log('Received message', message);

      switch (message.type) {
        case 'heartbeat':
        case 'pong':
          this.handleHeartbeat();
          break;
          
        case 'notification':
          this.handleNotification(message);
          break;
          
        case 'connected':
          this.log('Connection confirmed by server', message);
          break;
          
        case 'subscribed':
          this.log('Subscription confirmed', message);
          break;
          
        case 'unsubscribed':
          this.log('Unsubscription confirmed', message);
          break;
          
        case 'auth':
          this.handleAuthResponse(message.data);
          break;
          
        case 'error':
          this.error('Server error', message.message || message.data);
          break;
          
        default:
          this.log('Unknown message type', message);
      }
    } catch (error) {
      this.error('Failed to parse message', error);
    }
  }

  private handleHeartbeat() {
    // Clear the timeout since we received a response
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
    
    this.lastHeartbeat = Date.now();
    this.log('💓 Heartbeat response received from server');
    
    // Send heartbeat response
    this.send({ type: 'heartbeat', timestamp: Date.now() });
  }

  private handleNotification(notification: any) {
    this.log('Received notification', notification);
    
    // Handle server notification format: { type: 'notification', resource: 'purchase_requests', event: 'updated', data: {...} }
    if (notification.resource && notification.event && notification.data) {
      const adaptedNotification = {
        type: notification.event,
        resourceType: notification.resource,
        resourceId: notification.data.id,
        action: notification.event,
        data: notification.data,
        timestamp: Date.now(),
        ...notification.data // Include all data fields directly
      };
      
      this.emit('notification', adaptedNotification);
      
      // Emit specific events for different resource types
      this.emit(`notification:${notification.resource}`, adaptedNotification);
      this.emit(`notification:${notification.resource}:${notification.event}`, adaptedNotification);
      
      if (notification.data.id) {
        this.emit(`notification:${notification.resource}:${notification.data.id}`, adaptedNotification);
      }
    } else {
      // Fallback for old format
      this.emit('notification', notification);
    }
  }

  private handleAuthResponse(data: any) {
    if (data.success) {
      this.log('Authentication successful');
      this.isAuthenticated = true;
      this.connectionId = data.connectionId;
      this.emit('authenticated', data);
      this.resubscribeAll();
    } else {
      this.error('Authentication failed', data.error);
      this.emit('authError', data.error);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.log('💓 Sending heartbeat to server');
        this.send({ type: 'heartbeat', timestamp: Date.now() });
        this.lastHeartbeat = Date.now();
        
        // Set timeout to detect heartbeat failure
        this.heartbeatTimeoutTimer = setTimeout(() => {
          this.error(`[WebSocket Client] Heartbeat timeout after ${this.config.heartbeatTimeout}ms - connection may be lost`);
          this.log('Attempting automatic reconnection due to heartbeat timeout');
          this.disconnect();
          // Trigger automatic reconnection
          this.scheduleReconnect();
        }, this.config.heartbeatTimeout);
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    this.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Error already handled in connect method
      });
    }, delay);
  }

  private resubscribeAll() {
    if (!this.isAuthenticated) {
      return;
    }

    this.log('Resubscribing to all subscriptions', Array.from(this.subscriptions.keys()));
    
    for (const [key, subscription] of this.subscriptions) {
      // Send in the format the server expects
      this.send({
        type: 'subscribe',
        resource: subscription.resourceType
      });
    }
  }

  public subscribe(options: SubscriptionOptions): string {
    const key = this.getSubscriptionKey(options);
    this.subscriptions.set(key, options);
    
    this.log('Subscribing to', options);
    
    if (this.isConnected() && this.isAuthenticated) {
      // Send in the format the server expects
      this.send({
        type: 'subscribe',
        resource: options.resourceType
      });
    }
    
    return key;
  }

  public unsubscribe(key: string) {
    const subscription = this.subscriptions.get(key);
    
    if (subscription) {
      this.subscriptions.delete(key);
      this.log('Unsubscribing from', subscription);
      
      if (this.isConnected() && this.isAuthenticated) {
        // Send in the format the server expects
        this.send({
          type: 'unsubscribe',
          resource: subscription.resourceType
        });
      }
    }
  }

  public unsubscribeAll() {
    this.log('Unsubscribing from all subscriptions');
    this.subscriptions.clear();
  }

  private getSubscriptionKey(options: SubscriptionOptions): string {
    return `${options.resourceType}:${options.resourceId || 'all'}:${JSON.stringify(options.filters || {})}`;
  }

  private send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.log('Sent message', message);
    } else {
      this.log('Cannot send message - WebSocket not connected', message);
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public getConnectionStatus() {
    return {
      connected: this.isConnected(),
      authenticated: this.isAuthenticated,
      connectionId: this.connectionId,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions.keys()),
      lastHeartbeat: this.lastHeartbeat
    };
  }

  public disconnect() {
    this.log('Disconnecting WebSocket');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    this.unsubscribeAll();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isAuthenticated = false;
    this.connectionId = null;
    this.reconnectAttempts = 0;
  }

  public destroy() {
    this.disconnect();
    this.removeAllListeners();
  }
}

// Singleton instance for global use
let globalWebSocketClient: WebSocketClient | null = null;

export function getWebSocketClient(config?: Partial<WebSocketConfig>): WebSocketClient {
  if (!globalWebSocketClient) {
    globalWebSocketClient = new WebSocketClient(config);
  }
  return globalWebSocketClient;
}

export function destroyWebSocketClient() {
  if (globalWebSocketClient) {
    globalWebSocketClient.destroy();
    globalWebSocketClient = null;
  }
}