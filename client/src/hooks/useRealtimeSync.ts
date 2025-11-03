import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface RealtimeSyncConfig {
  pollingInterval: number;
  maxRetries: number;
  reconnectDelay: number;
  enableAnimations: boolean;
}

interface RealtimeSyncState {
  isConnected: boolean;
  lastSync: Date;
  error: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  connectionType: 'websocket' | 'polling' | 'offline';
}

export const useRealtimeSync = (config: RealtimeSyncConfig): RealtimeSyncState => {
  const [state, setState] = useState<RealtimeSyncState>({
    isConnected: false,
    lastSync: new Date(),
    error: null,
    syncStatus: 'idle',
    connectionType: 'offline'
  });

  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    try {
      // Use the same port as the server
      const wsUrl = `ws://localhost:5201/ws`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('🔌 WebSocket connected for realtime sync');
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null,
          connectionType: 'websocket'
        }));
        retryCountRef.current = 0;
        
        // Stop polling when WebSocket connects
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealtimeUpdate(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('🔌 WebSocket disconnected - switching to polling');
        setState(prev => ({
          ...prev,
          isConnected: false,
          connectionType: 'offline'
        }));
        
        // Start polling fallback
        startPolling();
        
        // Attempt reconnection with exponential backoff
        if (retryCountRef.current < config.maxRetries) {
          const delay = config.reconnectDelay * Math.pow(2, retryCountRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            retryCountRef.current++;
            connectWebSocket();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection failed',
          connectionType: 'offline'
        }));
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      startPolling();
    }
  }, [config.maxRetries, config.reconnectDelay]);

  // Polling fallback
  const startPolling = useCallback(() => {
    if (pollingRef.current) return; // Already polling

    console.log('📡 Starting polling fallback every', config.pollingInterval, 'ms');
    setState(prev => ({ ...prev, connectionType: 'polling' }));

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/purchase-requests', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          handleRealtimeUpdate({ 
            type: 'purchase_requests_updated', 
            data,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to fetch updates via polling'
        }));
      }
    }, config.pollingInterval);
  }, [config.pollingInterval]);

  // Handle realtime updates
  const handleRealtimeUpdate = useCallback((data: any) => {
    setState(prev => ({ ...prev, syncStatus: 'syncing' }));

    // Invalidate React Query cache to trigger refetch
    queryClient.invalidateQueries({ queryKey: ['/api/purchase-requests'] });

    // Update sync status after a brief delay
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        syncStatus: 'idle',
        lastSync: new Date(),
        error: null // Clear any previous errors on successful sync
      }));
    }, 100);

    console.log('🔄 Realtime update processed:', data.type || 'unknown');
  }, [queryClient]);

  // Initialize connection
  useEffect(() => {
    connectWebSocket();

    return () => {
      // Cleanup
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  // Heartbeat to detect connection issues
  useEffect(() => {
    if (state.connectionType !== 'websocket') return;

    const heartbeatInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Send ping every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [state.connectionType]);

  return state;
};

// Default configuration
export const defaultRealtimeSyncConfig: RealtimeSyncConfig = {
  pollingInterval: 3000,
  maxRetries: 3,
  reconnectDelay: 1000,
  enableAnimations: true
};