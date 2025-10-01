import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import debug from '@/lib/debug';
import { handleWebSocketNotification } from '@/lib/queryClient';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'error' | 'notification';
  channel?: string;
  data?: any;
  timestamp?: number;
  id?: string;
}

export interface NotificationPayload {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'CACHE';
  data: any;
  oldData?: any;
  timestamp: number;
}

export interface WebSocketConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  enableLogging?: boolean;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastMessage: WebSocketMessage | null;
}

export interface UseWebSocketReturn {
  state: WebSocketState;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  send: (message: WebSocketMessage) => void;
  connect: () => void;
  disconnect: () => void;
  subscriptions: Set<string>;
}

const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  url: `ws://${window.location.hostname}:5201/ws`,
  reconnectInterval: 5000,
  maxReconnectAttempts: 3,
  heartbeatInterval: 60000,
  enableLogging: process.env.NODE_ENV === 'development'
};

export function useWebSocket(
  config: WebSocketConfig = {},
  onMessage?: (message: WebSocketMessage) => void,
  onNotification?: (payload: NotificationPayload) => void
): UseWebSocketReturn {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { toast } = useToast();
  
  // WebSocket state
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
    lastMessage: null
  });

  // Refs for stable references
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);
  const isManualDisconnectRef = useRef(false);

  // Logging utility
  const log = useCallback((message: string, ...args: any[]) => {
    if (finalConfig.enableLogging) {
      console.log(`[WebSocket] ${message}`, ...args);
    }
  }, [finalConfig.enableLogging]);

  // Clear timeouts
  const clearTimeouts = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Send message to WebSocket
  const send = useCallback((message: WebSocketMessage) => {
    const ws = wsRef.current;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        log('Sent message:', message);
      } catch (error) {
        console.error('[WebSocket] Error sending message:', error);
        setState(prev => ({ ...prev, error: 'Failed to send message' }));
      }
    } else {
      // Queue message for when connection is established
      messageQueueRef.current.push(message);
      log('Queued message (not connected):', message);
    }
  }, [log]);

  // Process queued messages
  const processMessageQueue = useCallback(() => {
    const queue = messageQueueRef.current;
    messageQueueRef.current = [];
    
    queue.forEach(message => {
      send(message);
    });
    
    if (queue.length > 0) {
      log(`Processed ${queue.length} queued messages`);
    }
  }, [send, log]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    clearInterval(heartbeatIntervalRef.current!);
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        send({ type: 'ping', timestamp: Date.now() });
      }
    }, finalConfig.heartbeatInterval);
  }, [send, finalConfig.heartbeatInterval]);

  // Handle WebSocket connection
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      log('Connection already in progress');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected');
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      error: null 
    }));

    isManualDisconnectRef.current = false;
    clearTimeouts();

    try {
      const ws = new WebSocket(finalConfig.url);
      wsRef.current = ws;

      ws.onopen = () => {
        log('Connected successfully');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
          reconnectAttempts: 0
        }));

        startHeartbeat();
        processMessageQueue();

        // Re-subscribe to all channels
        subscriptionsRef.current.forEach(channel => {
          send({ type: 'subscribe', channel });
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          log('Received message:', message);

          setState(prev => ({ ...prev, lastMessage: message }));

          // Handle different message types
          switch (message.type) {
            case 'notification':
              if (message.data && onNotification) {
                onNotification(message.data as NotificationPayload);
              }
              break;
            case 'error':
              console.error('[WebSocket] Server error:', message.data);
              setState(prev => ({ 
                ...prev, 
                error: message.data?.message || 'Server error' 
              }));
              break;
            case 'pong':
              // Heartbeat response - connection is alive
              break;
          }

          // Call custom message handler
          if (onMessage) {
            onMessage(message);
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        log('Connection closed:', event.code, event.reason);
        
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }));

        clearTimeouts();

        // Attempt reconnection if not manually disconnected
        if (!isManualDisconnectRef.current && 
            state.reconnectAttempts < finalConfig.maxReconnectAttempts) {
          
          const delay = Math.min(
            finalConfig.reconnectInterval * Math.pow(2, state.reconnectAttempts),
            30000 // Max 30 seconds
          );

          log(`Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts + 1})`);
          
          setState(prev => ({
            ...prev,
            reconnectAttempts: prev.reconnectAttempts + 1
          }));

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (state.reconnectAttempts >= finalConfig.maxReconnectAttempts) {
          setState(prev => ({
            ...prev,
            error: 'Max reconnection attempts reached'
          }));
          
          toast({
            title: "Conexão perdida",
            description: "Não foi possível reconectar ao servidor. Recarregue a página.",
            variant: "destructive",
          });
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        setState(prev => ({
          ...prev,
          error: 'Connection failed',
          isConnecting: false
        }));
      };

    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to create connection',
        isConnecting: false
      }));
    }
  }, [
    finalConfig.url,
    finalConfig.maxReconnectAttempts,
    finalConfig.reconnectInterval,
    state.reconnectAttempts,
    log,
    startHeartbeat,
    processMessageQueue,
    send,
    onMessage,
    onNotification,
    toast,
    clearTimeouts
  ]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    log('Disconnecting...');
    isManualDisconnectRef.current = true;
    clearTimeouts();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0
    }));
  }, [log, clearTimeouts]);

  // Subscribe to channel
  const subscribe = useCallback((channel: string) => {
    if (!channel) return;

    subscriptionsRef.current.add(channel);
    log(`Subscribing to channel: ${channel}`);
    
    send({ type: 'subscribe', channel });
  }, [send, log]);

  // Unsubscribe from channel
  const unsubscribe = useCallback((channel: string) => {
    if (!channel) return;

    subscriptionsRef.current.delete(channel);
    log(`Unsubscribing from channel: ${channel}`);
    
    send({ type: 'unsubscribe', channel });
  }, [send, log]);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []); // Empty dependency array for mount/unmount only

  // Handle visibility change (reconnect when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          !state.isConnected && 
          !state.isConnecting &&
          !isManualDisconnectRef.current) {
        log('Tab became visible, attempting to reconnect...');
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isConnected, state.isConnecting, connect, log]);

  return {
    state,
    subscribe,
    unsubscribe,
    send,
    connect,
    disconnect,
    subscriptions: subscriptionsRef.current
  };
}

export interface WebSocketNotification {
  type: string;
  table?: string;
  operation?: string;
  data?: any;
  timestamp?: string;
}

export interface WebSocketHookOptions {
  onNotification?: (notification: WebSocketNotification) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
}

export interface WebSocketHookReturn {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastMessage: WebSocketNotification | null;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  sendMessage: (message: any) => void;
  reconnect: () => void;
  disconnect: () => void;
}

export const useWebSocketHook = (options: WebSocketHookOptions = {}): WebSocketHookReturn => {
  const {
    onNotification,
    onError,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    maxReconnectAttempts = 3,
    reconnectInterval = 5000,
  } = options;

  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const messageQueueRef = useRef<any[]>([]);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketNotification | null>(null);

  // Update global WebSocket connection status for React Query integration
  useEffect(() => {
    (window as any).__websocketConnected = isConnected;
  }, [isConnected]);

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5201/ws`;
  }, []);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        lastHeartbeatRef.current = Date.now();
      }
    }, 30000); // Send ping every 30 seconds
  }, [clearHeartbeat]);

  const processMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      const message = messageQueueRef.current.shift();
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const resubscribeToChannels = useCallback(() => {
    subscriptionsRef.current.forEach(channel => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'subscribe',
          channel
        }));
        debug.log(`🔄 Resubscribed to channel: ${channel}`);
      }
    });
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    debug.log('🔌 Connecting to WebSocket...');

    try {
      const wsUrl = getWebSocketUrl();
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        debug.log('✅ WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        clearReconnectTimeout();
        
        // Start heartbeat
        startHeartbeat();
        
        // Process queued messages
        processMessageQueue();
        
        // Resubscribe to channels
        resubscribeToChannels();
        
        // Subscribe to default channels
        const defaultChannels = [
          'global',
          'purchase_requests',
          'quotations',
          'supplier_quotations',
          'purchase_orders',
          'receipts'
        ];
        
        defaultChannels.forEach(channel => {
          subscribe(channel);
        });

        onConnect?.();

        toast({
          title: "Conexão Estabelecida",
          description: "Atualizações em tempo real ativadas",
          variant: "default",
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const notification: WebSocketNotification = JSON.parse(event.data);
          
          // Handle pong responses
          if (notification.type === 'pong') {
            lastHeartbeatRef.current = Date.now();
            return;
          }

          debug.log('📨 WebSocket message received:', notification);
          setLastMessage(notification);

          // Integrate with React Query
          handleWebSocketNotification(notification);

          // Call custom notification handler
          onNotification?.(notification);

        } catch (error) {
          debug.error('❌ Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        debug.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        clearHeartbeat();
        
        onDisconnect?.();

        // Auto-reconnect if enabled and not a normal closure
        if (autoReconnect && event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttemptsRef.current), 30000);
          debug.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          debug.error('❌ Max reconnection attempts reached');
          setConnectionStatus('error');
          // Only show toast once when max attempts reached, not repeatedly
          if (reconnectAttemptsRef.current === maxReconnectAttempts) {
            toast({
              title: "Conexão em tempo real indisponível",
              description: "Usando modo de fallback com atualizações periódicas.",
              variant: "default",
            });
          }
        }
      };

      wsRef.current.onerror = (error) => {
        debug.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        onError?.(error);
      };

    } catch (error) {
      debug.error('❌ Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [getWebSocketUrl, onConnect, onDisconnect, onError, onNotification, autoReconnect, maxReconnectAttempts, reconnectInterval, startHeartbeat, processMessageQueue, resubscribeToChannels, toast]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    clearHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    subscriptionsRef.current.clear();
    messageQueueRef.current = [];
  }, [clearReconnectTimeout, clearHeartbeat]);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 1000);
  }, [disconnect, connect]);

  const subscribe = useCallback((channel: string) => {
    subscriptionsRef.current.add(channel);
    
    const message = {
      type: 'subscribe',
      channel
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      debug.log(`📡 Subscribed to channel: ${channel}`);
    } else {
      messageQueueRef.current.push(message);
      debug.log(`📋 Queued subscription to channel: ${channel}`);
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    subscriptionsRef.current.delete(channel);
    
    const message = {
      type: 'unsubscribe',
      channel
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      debug.log(`📡 Unsubscribed from channel: ${channel}`);
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      messageQueueRef.current.push(message);
      debug.log('📋 Message queued (WebSocket not connected)');
    }
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    // Handle visibility change for reconnection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        debug.log('🔄 Page became visible, attempting to reconnect...');
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnect();
    };
  }, [connect, disconnect, reconnect, isConnected]);

  // Monitor connection health
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      if (isConnected && Date.now() - lastHeartbeatRef.current > 60000) {
        debug.warn('⚠️ WebSocket connection appears unhealthy, reconnecting...');
        reconnect();
      }
    }, 30000);

    return () => clearInterval(healthCheckInterval);
  }, [isConnected, reconnect]);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    subscribe,
    unsubscribe,
    sendMessage,
    reconnect,
    disconnect,
  };
};