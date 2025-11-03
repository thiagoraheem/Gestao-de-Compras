import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';

interface ClientConnection {
  id: string;
  userId: number;
  subscriptions: Set<string>;
  lastActivity: Date;
  socket: WebSocket;
  userAgent?: string;
  ipAddress?: string;
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'heartbeat';
  resource?: string;
  resources?: string[];
  timestamp?: string;
}

interface NotificationMessage {
  type: 'notification';
  resource: string;
  event: string;
  data: any;
  timestamp: string;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 segundos
  private readonly CONNECTION_TIMEOUT = 60000; // 60 segundos

  constructor(server: Server) {
    super();
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 6,
          chunkSize: 1024,
        },
        threshold: 1024,
        concurrencyLimit: 10,
        clientMaxWindowBits: 15,
        serverMaxWindowBits: 15,
        serverMaxNoContextTakeover: false,
        clientMaxNoContextTakeover: false,
      }
    });
    
    this.setupWebSocketServer();
    this.startHeartbeat();
    this.startCleanup();
  }

  private setupWebSocketServer() {
    console.log('🔧 Setting up WebSocket server...');
    
    this.wss.on('connection', async (ws: WebSocket, req) => {
      const clientId = nanoid();
      const userId = await this.extractUserIdFromRequest(req);
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.socket.remoteAddress;
      
      console.log(`🔌 New WebSocket connection attempt - ClientId: ${clientId}, UserId: ${userId}, IP: ${ipAddress}`);
      
      if (!userId) {
        console.log(`❌ Authentication failed for client ${clientId} - closing connection`);
        ws.close(1008, 'Authentication required');
        return;
      }

      const client: ClientConnection = {
        id: clientId,
        userId,
        subscriptions: new Set(),
        lastActivity: new Date(),
        socket: ws,
        userAgent,
        ipAddress
      };

      this.clients.set(clientId, client);
      
      console.log(`✅ WebSocket client connected: ${clientId} (User: ${userId}) - Total clients: ${this.clients.size}`);
      this.emit('clientConnected', { clientId, userId });

      ws.on('message', (data) => {
        this.handleMessage(clientId, data);
      });

      ws.on('close', (code, reason) => {
        console.log(`WebSocket client disconnected: ${clientId} (Code: ${code}, Reason: ${reason})`);
        this.clients.delete(clientId);
        this.emit('clientDisconnected', { clientId, userId });
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastActivity = new Date();
        }
      });

      // Enviar mensagem de boas-vindas
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket Server error:', error);
      this.emit('serverError', error);
    });
  }

  private handleMessage(clientId: string, data: Buffer) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          if (message.resource) {
            this.handleSubscription(clientId, message.resource);
          } else if (message.resources) {
            message.resources.forEach(resource => {
              this.handleSubscription(clientId, resource);
            });
          }
          break;
          
        case 'unsubscribe':
          if (message.resource) {
            this.handleUnsubscription(clientId, message.resource);
          } else if (message.resources) {
            message.resources.forEach(resource => {
              this.handleUnsubscription(clientId, resource);
            });
          }
          break;
          
        case 'ping':
          this.sendToClient(clientId, { 
            type: 'pong', 
            timestamp: new Date().toISOString() 
          });
          break;
          
        case 'heartbeat':
          // Responder ao heartbeat do cliente
          this.sendToClient(clientId, { 
            type: 'heartbeat', 
            timestamp: new Date().toISOString() 
          });
          // console.log(`💓 Heartbeat received from client ${clientId}`); // Comentado para evitar spam no console
          break;
      }
      
      client.lastActivity = new Date();
    } catch (error) {
      console.error(`Error handling WebSocket message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  private handleSubscription(clientId: string, resource: string) {
    console.log(`📝 Handling subscription for client ${clientId} to resource: ${resource}`);
    
    const client = this.clients.get(clientId);
    if (!client) {
      console.log(`❌ Client ${clientId} not found for subscription`);
      return;
    }

    // Validar se o usuário tem permissão para o recurso
    if (!this.hasPermissionForResource(client.userId, resource)) {
      console.log(`❌ Permission denied for user ${client.userId} to resource: ${resource}`);
      this.sendToClient(clientId, {
        type: 'error',
        message: `Permission denied for resource: ${resource}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    client.subscriptions.add(resource);
    
    this.sendToClient(clientId, {
      type: 'subscribed',
      resource,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Client ${clientId} (User: ${client.userId}) subscribed to ${resource}. Total subscriptions: ${client.subscriptions.size}`);
    this.emit('subscription', { clientId, userId: client.userId, resource, action: 'subscribe' });
  }

  private handleUnsubscription(clientId: string, resource: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(resource);
    
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      resource,
      timestamp: new Date().toISOString()
    });

    console.log(`Client ${clientId} unsubscribed from ${resource}`);
    this.emit('subscription', { clientId, userId: client.userId, resource, action: 'unsubscribe' });
  }

  private async extractUserIdFromRequest(req: any): Promise<number | null> {
    try {
      console.log('🔍 Extracting userId from WebSocket request...');
      console.log('🔍 Request headers:', {
        cookie: req.headers.cookie ? 'Present' : 'Missing',
        userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
        origin: req.headers.origin,
        host: req.headers.host
      });

      // Extrair sessionId do cookie
      const cookieHeader = req.headers.cookie;
      if (!cookieHeader) {
        console.log('❌ WebSocket: No cookie header found');
        return null;
      }

      // Procurar por sessionId ou connect.sid
      const sessionMatch = cookieHeader.match(/(?:sessionId|connect\.sid)=([^;]+)/);
      if (!sessionMatch) {
        console.log('❌ WebSocket: No session cookie found in:', cookieHeader);
        return null;
      }

      let sessionId = decodeURIComponent(sessionMatch[1]);
      console.log('✅ WebSocket: Session ID extracted:', sessionId.substring(0, 20) + '...');
      
      // CORREÇÃO: Processar sessionId da mesma forma que o Express Session
      // O Express Session usa signed cookies, então precisamos processar corretamente
      if (sessionId.startsWith('s:')) {
        // Remove o prefixo 's:' e extrai apenas a parte antes do ponto (signature)
        const unsignedSession = sessionId.substring(2);
        const dotIndex = unsignedSession.indexOf('.');
        if (dotIndex !== -1) {
          sessionId = unsignedSession.substring(0, dotIndex);
        } else {
          sessionId = unsignedSession;
        }
        console.log('🔧 WebSocket: Processed signed session ID:', sessionId.substring(0, 20) + '...');
      }
      
      // Validar sessão no banco de dados usando o sessionId processado
      const { validateSession } = await import('./db');
      const session = await validateSession(sessionId);
      
      if (!session) {
        console.log('❌ WebSocket: Invalid or expired session');
        return null;
      }
      
      console.log('✅ WebSocket: Valid session found for userId:', session.userId);
      return session.userId;
      
    } catch (error) {
      console.error('❌ WebSocket: Error extracting userId:', error);
      return null;
    }
  }

  private hasPermissionForResource(userId: number, resource: string): boolean {
    // Implementar validação de permissões baseada no usuário e recurso
    // Por enquanto, permitindo todos os recursos para usuários autenticados
    return true; // TODO: Implementar validação real de permissões
  }

  public notifyClients(resource: string, event: string, data: any, filters?: any) {
    console.log(`📢 Starting notification process for ${resource}:${event}`);
    console.log(`📢 Total connected clients: ${this.clients.size}`);
    
    const message: NotificationMessage = {
      type: 'notification',
      resource,
      event,
      data,
      timestamp: new Date().toISOString()
    };

    const messageStr = JSON.stringify(message);
    let notifiedCount = 0;
    let eligibleCount = 0;

    this.clients.forEach((client) => {
      const hasSubscription = client.subscriptions.has(resource) || client.subscriptions.has('purchase-requests');
      const isOpen = client.socket.readyState === WebSocket.OPEN;
      const matchesFilters = this.matchesFilters(client, filters);
      
      console.log(`📢 Client ${client.id} (User: ${client.userId}): subscription=${hasSubscription}, open=${isOpen}, filters=${matchesFilters}`);
      
      if (hasSubscription && isOpen && matchesFilters) {
        eligibleCount++;
        try {
          client.socket.send(messageStr);
          notifiedCount++;
          console.log(`✅ Notification sent to client ${client.id}`);
        } catch (error) {
          console.error(`❌ Error sending message to client ${client.id}:`, error);
        }
      }
    });

    console.log(`📢 Notification complete: ${notifiedCount}/${eligibleCount} clients notified for ${resource}:${event}`);
    this.emit('notification', { resource, event, data, notifiedCount });
  }

  // Método específico para notificar atualizações de purchase requests
  public notifyPurchaseRequestUpdate(requestId: number, action: string, data: any) {
    const enhancedData = {
      ...data,
      requestId,
      action,
      requestNumber: data.requestNumber || `REQ-${requestId}`,
      currentPhase: data.currentPhase,
      timestamp: new Date().toISOString()
    };

    // Notificar todos os clientes subscritos
    this.notifyClients('purchase_requests', action, enhancedData);
    
    // Também notificar com o evento específico para compatibilidade
    this.notifyClients('purchase-requests', action, enhancedData);
  }

  // Método para broadcast de mudanças de fase
  public notifyPhaseChange(requestId: number, oldPhase: string, newPhase: string, data: any) {
    const phaseChangeData = {
      ...data,
      requestId,
      action: 'phase_changed',
      previousPhase: oldPhase,
      currentPhase: newPhase,
      requestNumber: data.requestNumber || `REQ-${requestId}`,
      timestamp: new Date().toISOString()
    };

    this.notifyClients('purchase_requests', 'phase_changed', phaseChangeData);
    this.notifyClients('purchase-requests', 'phase_changed', phaseChangeData);
  }

  // Método para notificar aprovações
  public notifyApproval(requestId: number, approvalLevel: string, status: string, data: any) {
    const approvalData = {
      ...data,
      requestId,
      action: status === 'approved' ? 'approved' : 'rejected',
      approvalLevel,
      status,
      requestNumber: data.requestNumber || `REQ-${requestId}`,
      timestamp: new Date().toISOString()
    };

    this.notifyClients('purchase_requests', approvalData.action, approvalData);
    this.notifyClients('purchase-requests', approvalData.action, approvalData);
  }

  public sendToUser(userId: number, data: any) {
    const messageStr = JSON.stringify(data);
    let sentCount = 0;

    this.clients.forEach((client) => {
      if (client.userId === userId && client.socket.readyState === WebSocket.OPEN) {
        try {
          client.socket.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error(`Error sending message to user ${userId}:`, error);
        }
      }
    });

    console.log(`Sent message to ${sentCount} connections for user ${userId}`);
  }

  private sendToClient(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(data));
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
      }
    }
  }

  private matchesFilters(client: ClientConnection, filters?: any): boolean {
    if (!filters) return true;
    
    // Implementar lógica de filtros baseada em permissões, departamento, etc.
    if (filters.userId && client.userId !== filters.userId) {
      return false;
    }
    
    return true;
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      console.log(`💓 Server heartbeat check - ${this.clients.size} active clients`);
      this.clients.forEach((client, clientId) => {
        if (client.socket.readyState === WebSocket.OPEN) {
          try {
            client.socket.ping();
            console.log(`💓 Ping sent to client ${clientId} (User: ${client.userId})`);
          } catch (error) {
            console.error(`❌ Error pinging client ${clientId}:`, error);
            this.clients.delete(clientId);
          }
        } else {
          console.log(`🔌 Removing disconnected client ${clientId}`);
          this.clients.delete(clientId);
        }
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const expiredClients: string[] = [];

      this.clients.forEach((client, clientId) => {
        const timeSinceLastActivity = now.getTime() - client.lastActivity.getTime();
        
        if (timeSinceLastActivity > this.CONNECTION_TIMEOUT) {
          expiredClients.push(clientId);
        }
      });

      expiredClients.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client) {
          console.log(`Cleaning up expired client: ${clientId}`);
          client.socket.terminate();
          this.clients.delete(clientId);
        }
      });

      if (expiredClients.length > 0) {
        console.log(`Cleaned up ${expiredClients.length} expired connections`);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  public getActiveConnections(): number {
    return this.clients.size;
  }

  public getConnectionsByUser(): Map<number, number> {
    const userConnections = new Map<number, number>();
    
    this.clients.forEach(client => {
      const count = userConnections.get(client.userId) || 0;
      userConnections.set(client.userId, count + 1);
    });
    
    return userConnections;
  }

  public getSubscriptionStats(): Map<string, number> {
    const subscriptionStats = new Map<string, number>();
    
    this.clients.forEach(client => {
      client.subscriptions.forEach(resource => {
        const count = subscriptionStats.get(resource) || 0;
        subscriptionStats.set(resource, count + 1);
      });
    });
    
    return subscriptionStats;
  }

  public getHealthStatus() {
    return {
      activeConnections: this.getActiveConnections(),
      connectionsByUser: Object.fromEntries(this.getConnectionsByUser()),
      subscriptionStats: Object.fromEntries(this.getSubscriptionStats()),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.clients.forEach(client => {
      client.socket.close(1001, 'Server shutting down');
    });
    
    this.wss.close();
    console.log('WebSocket Manager closed');
  }
}