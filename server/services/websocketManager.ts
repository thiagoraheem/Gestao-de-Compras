import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';
import { IntelligentCacheManager } from './cacheManager';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'error' | 'notification';
  channel?: string;
  data?: any;
  timestamp?: number;
  id?: string;
}

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
  isAlive: boolean;
  metadata?: {
    userId?: string;
    companyId?: string;
    userAgent?: string;
    ip?: string;
  };
}

export interface NotificationPayload {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: any;
  oldData?: any;
  timestamp: number;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // channel -> client IDs
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cacheManager: IntelligentCacheManager;
  private isShuttingDown = false;

  // Rate limiting
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100;

  // Statistics
  private stats = {
    totalConnections: 0,
    activeConnections: 0,
    messagesReceived: 0,
    messagesSent: 0,
    subscriptions: 0,
    errors: 0,
    startTime: Date.now()
  };

  constructor(cacheManager: IntelligentCacheManager) {
    super();
    this.cacheManager = cacheManager;
    this.setupEventListeners();
  }

  /**
   * Initialize WebSocket server
   */
  public initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 3,
          chunkSize: 1024,
        },
        threshold: 1024,
        concurrencyLimit: 10,
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();

    console.log('✅ WebSocket Manager initialized');
    this.emit('initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      lastPing: Date.now(),
      isAlive: true,
      metadata: {
        userAgent: request.headers['user-agent'],
        ip: request.socket.remoteAddress
      }
    };

    this.clients.set(clientId, client);
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    console.log(`🔗 New WebSocket connection: ${clientId} (Total: ${this.stats.activeConnections})`);

    // Setup client event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleDisconnection(clientId));
    ws.on('error', (error) => this.handleError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'notification',
      data: { 
        message: 'Connected to Kanban Real-time Updates',
        clientId,
        timestamp: Date.now()
      }
    });

    this.emit('connection', { clientId, client });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Rate limiting check
    if (!this.checkRateLimit(clientId)) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Rate limit exceeded', code: 'RATE_LIMIT' }
      });
      return;
    }

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      this.stats.messagesReceived++;

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message);
          break;
        case 'ping':
          this.handlePing(clientId);
          break;
        default:
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: 'Unknown message type', code: 'UNKNOWN_TYPE' }
          });
      }
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Error parsing message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid message format', code: 'INVALID_FORMAT' }
      });
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscribe(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || !message.channel) return;

    const channel = message.channel;
    
    // Validate channel format
    if (!this.isValidChannel(channel)) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid channel format', code: 'INVALID_CHANNEL' }
      });
      return;
    }

    // Add subscription
    client.subscriptions.add(channel);
    
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(clientId);
    this.stats.subscriptions++;

    console.log(`📡 Client ${clientId} subscribed to ${channel}`);

    // Send confirmation
    this.sendToClient(clientId, {
      type: 'notification',
      data: { 
        message: `Subscribed to ${channel}`,
        channel,
        timestamp: Date.now()
      }
    });

    // Send cached data if available
    this.sendCachedData(clientId, channel);

    this.emit('subscribe', { clientId, channel });
  }

  /**
   * Handle unsubscription requests
   */
  private handleUnsubscribe(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || !message.channel) return;

    const channel = message.channel;
    
    client.subscriptions.delete(channel);
    
    const channelSubscriptions = this.subscriptions.get(channel);
    if (channelSubscriptions) {
      channelSubscriptions.delete(clientId);
      if (channelSubscriptions.size === 0) {
        this.subscriptions.delete(channel);
      }
    }

    console.log(`📡 Client ${clientId} unsubscribed from ${channel}`);

    this.sendToClient(clientId, {
      type: 'notification',
      data: { 
        message: `Unsubscribed from ${channel}`,
        channel,
        timestamp: Date.now()
      }
    });

    this.emit('unsubscribe', { clientId, channel });
  }

  /**
   * Handle ping messages
   */
  private handlePing(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastPing = Date.now();
    client.isAlive = true;

    this.sendToClient(clientId, {
      type: 'pong',
      timestamp: Date.now()
    });
  }

  /**
   * Handle pong responses
   */
  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      client.lastPing = Date.now();
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all subscriptions
    for (const channel of client.subscriptions) {
      const channelSubscriptions = this.subscriptions.get(channel);
      if (channelSubscriptions) {
        channelSubscriptions.delete(clientId);
        if (channelSubscriptions.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    }

    this.clients.delete(clientId);
    this.stats.activeConnections--;

    console.log(`🔌 Client ${clientId} disconnected (Active: ${this.stats.activeConnections})`);
    this.emit('disconnection', { clientId });
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(clientId: string, error: Error): void {
    this.stats.errors++;
    console.error(`❌ WebSocket error for client ${clientId}:`, error);
    this.emit('error', { clientId, error });
  }

  /**
   * Broadcast notification to subscribed clients
   */
  public broadcastNotification(payload: NotificationPayload): void {
    if (this.isShuttingDown) return;

    const channels = this.getChannelsForPayload(payload);
    
    for (const channel of channels) {
      const subscribers = this.subscriptions.get(channel);
      if (!subscribers || subscribers.size === 0) continue;

      const message: WebSocketMessage = {
        type: 'notification',
        channel,
        data: payload,
        timestamp: Date.now()
      };

      for (const clientId of subscribers) {
        this.sendToClient(clientId, message);
      }

      console.log(`📢 Broadcasted to ${subscribers.size} clients on ${channel}`);
    }

    this.emit('broadcast', { payload, channels });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
    } catch (error) {
      console.error(`❌ Error sending message to ${clientId}:`, error);
      this.handleDisconnection(clientId);
    }
  }

  /**
   * Send cached data to newly subscribed client
   */
  private sendCachedData(clientId: string, channel: string): void {
    const cacheKey = this.getCacheKeyFromChannel(channel);
    if (!cacheKey) return;

    const cachedData = this.cacheManager.get(cacheKey);
    if (cachedData) {
      this.sendToClient(clientId, {
        type: 'notification',
        channel,
        data: {
          table: cacheKey.split(':')[0],
          operation: 'CACHE',
          data: cachedData,
          timestamp: Date.now()
        }
      });
    }
  }

  /**
   * Get channels that should receive the payload
   */
  private getChannelsForPayload(payload: NotificationPayload): string[] {
    const channels: string[] = [];
    
    // Global channel for all updates
    channels.push('kanban:all');
    
    // Table-specific channel
    channels.push(`kanban:${payload.table}`);
    
    // Operation-specific channel
    channels.push(`kanban:${payload.table}:${payload.operation.toLowerCase()}`);
    
    // Company-specific channels if data has companyId
    if (payload.data?.companyId) {
      channels.push(`kanban:company:${payload.data.companyId}`);
      channels.push(`kanban:${payload.table}:company:${payload.data.companyId}`);
    }

    return channels;
  }

  /**
   * Validate channel format
   */
  private isValidChannel(channel: string): boolean {
    const validPatterns = [
      /^kanban:all$/,
      /^kanban:(purchase_requests|quotations|supplier_quotations|purchase_orders|receipts)$/,
      /^kanban:(purchase_requests|quotations|supplier_quotations|purchase_orders|receipts):(insert|update|delete)$/,
      /^kanban:company:\d+$/,
      /^kanban:(purchase_requests|quotations|supplier_quotations|purchase_orders|receipts):company:\d+$/
    ];

    return validPatterns.some(pattern => pattern.test(channel));
  }

  /**
   * Get cache key from channel
   */
  private getCacheKeyFromChannel(channel: string): string | null {
    const match = channel.match(/^kanban:(\w+)/);
    return match ? match[1] : null;
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(clientId);

    if (!limit || now > limit.resetTime) {
      this.rateLimits.set(clientId, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return true;
    }

    if (limit.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      const now = Date.now();
      const deadClients: string[] = [];

      for (const [clientId, client] of this.clients) {
        if (now - client.lastPing > 30000) { // 30 seconds timeout
          if (client.isAlive === false) {
            deadClients.push(clientId);
          } else {
            client.isAlive = false;
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.ping();
            }
          }
        }
      }

      // Remove dead clients
      for (const clientId of deadClients) {
        console.log(`💀 Removing dead client: ${clientId}`);
        this.handleDisconnection(clientId);
      }
    }, 15000); // Check every 15 seconds
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to cache events
    this.cacheManager.on('update', (data) => {
      this.broadcastNotification({
        table: data.key.split(':')[0],
        operation: 'UPDATE',
        data: data.value,
        timestamp: Date.now()
      });
    });

    this.cacheManager.on('invalidate', (data) => {
      this.broadcastNotification({
        table: data.key.split(':')[0],
        operation: 'DELETE',
        data: { id: data.key.split(':')[1] },
        timestamp: Date.now()
      });
    });
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current statistics
   */
  public getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      activeConnections: this.clients.size,
      totalSubscriptions: Array.from(this.subscriptions.values())
        .reduce((sum, set) => sum + set.size, 0)
    };
  }

  /**
   * Get connected clients info
   */
  public getClients(): Array<{ id: string; subscriptions: string[]; metadata?: any }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      subscriptions: Array.from(client.subscriptions),
      metadata: client.metadata
    }));
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down WebSocket Manager...');
    this.isShuttingDown = true;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1001, 'Server shutting down');
      }
    }

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          console.log('✅ WebSocket Manager shut down');
          resolve();
        });
      });
    }

    this.emit('shutdown');
  }
}