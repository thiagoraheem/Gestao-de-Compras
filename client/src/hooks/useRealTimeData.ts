import { useEffect, useState, useCallback, useRef } from 'react';
import { useOptimizedQuery } from './useOptimizedQuery';
import { WebSocketClient } from '../lib/websocket-client';
import { SmartPollingService } from '../lib/smart-polling';
import { LocalCacheManager } from '../lib/cache-manager';

export interface RealTimeDataOptions {
  // Query configuration
  queryKey: string[];
  queryFn: () => Promise<any>;
  
  // Real-time configuration
  enableWebSocket?: boolean;
  enablePolling?: boolean;
  enableCache?: boolean;
  
  // WebSocket options
  subscribeToResource?: string;
  subscribeToEvents?: string[];
  
  // Polling options
  pollingInterval?: number;
  adaptivePolling?: boolean;
  
  // Cache options
  cacheTTL?: number;
  cacheKey?: string;
  
  // Optimization options
  enableDeltaUpdates?: boolean;
  enableCompression?: boolean;
  enableETagValidation?: boolean;
  
  // Callbacks
  onDataUpdate?: (data: any, source: 'websocket' | 'polling' | 'cache') => void;
  onError?: (error: Error, source: string) => void;
  onConnectionChange?: (connected: boolean, source: 'websocket' | 'polling') => void;
}

export interface RealTimeDataResult<T = any> {
  // Data
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  
  // Connection status
  isWebSocketConnected: boolean;
  isPollingActive: boolean;
  isCacheHit: boolean;
  
  // Data source info
  lastUpdateSource: 'websocket' | 'polling' | 'cache' | null;
  lastUpdateTime: Date | null;
  
  // Statistics
  cacheHitRate: number;
  totalUpdates: number;
  websocketMessages: number;
  pollingRequests: number;
  
  // Manual controls
  refetch: () => Promise<void>;
  invalidateCache: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  
  // Connection controls
  reconnectWebSocket: () => void;
  pausePolling: () => void;
  resumePolling: () => void;
}

export function useRealTimeData<T = any>(
  options: RealTimeDataOptions
): RealTimeDataResult<T> {
  const {
    queryKey,
    queryFn,
    enableWebSocket = true,
    enablePolling = true,
    enableCache = true,
    subscribeToResource,
    subscribeToEvents = [],
    pollingInterval = 30000,
    adaptivePolling = true,
    cacheTTL = 300000, // 5 minutes
    cacheKey,
    enableDeltaUpdates = true,
    enableCompression = true,
    enableETagValidation = true,
    onDataUpdate,
    onError,
    onConnectionChange
  } = options;

  // State
  const [lastUpdateSource, setLastUpdateSource] = useState<'websocket' | 'polling' | 'cache' | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [totalUpdates, setTotalUpdates] = useState(0);
  const [websocketMessages, setWebsocketMessages] = useState(0);
  const [pollingRequests, setPollingRequests] = useState(0);
  const [isPollingPaused, setIsPollingPaused] = useState(false);

  // Refs for stable references
  const onDataUpdateRef = useRef(onDataUpdate);
  const onErrorRef = useRef(onError);
  const onConnectionChangeRef = useRef(onConnectionChange);

  // Update refs when callbacks change
  useEffect(() => {
    onDataUpdateRef.current = onDataUpdate;
    onErrorRef.current = onError;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onDataUpdate, onError, onConnectionChange]);

  // Use optimized query hook
  const optimizedQuery = useOptimizedQuery<T>({
    queryKey,
    queryFn,
    enabled: true,
    
    // WebSocket configuration
    websocket: enableWebSocket ? {
      enabled: true,
      subscribeToResource,
      subscribeToEvents,
      onMessage: (data, type) => {
        if (type === 'notification' || type === 'update') {
          setLastUpdateSource('websocket');
          setLastUpdateTime(new Date());
          setTotalUpdates(prev => prev + 1);
          setWebsocketMessages(prev => prev + 1);
          onDataUpdateRef.current?.(data, 'websocket');
        }
      },
      onConnectionChange: (connected) => {
        onConnectionChangeRef.current?.(connected, 'websocket');
      },
      onError: (error) => {
        onErrorRef.current?.(error, 'websocket');
      }
    } : { enabled: false },
    
    // Polling configuration
    polling: enablePolling ? {
      enabled: !isPollingPaused,
      interval: pollingInterval,
      adaptive: adaptivePolling,
      onSuccess: (data) => {
        setLastUpdateSource('polling');
        setLastUpdateTime(new Date());
        setTotalUpdates(prev => prev + 1);
        setPollingRequests(prev => prev + 1);
        onDataUpdateRef.current?.(data, 'polling');
      },
      onError: (error) => {
        onErrorRef.current?.(error, 'polling');
      }
    } : { enabled: false },
    
    // Cache configuration
    cache: enableCache ? {
      enabled: true,
      ttl: cacheTTL,
      key: cacheKey || queryKey.join(':'),
      onCacheHit: (data) => {
        setLastUpdateSource('cache');
        setLastUpdateTime(new Date());
        onDataUpdateRef.current?.(data, 'cache');
      }
    } : { enabled: false },
    
    // Optimization options
    enableDeltaUpdates,
    enableCompression,
    enableETagValidation,
    
    // Throttling and debouncing
    throttleMs: 100,
    debounceMs: 50
  });

  // Manual controls
  const refetch = useCallback(async () => {
    await optimizedQuery.refetch();
    setPollingRequests(prev => prev + 1);
  }, [optimizedQuery]);

  const invalidateCache = useCallback(async () => {
    await optimizedQuery.invalidateCache();
  }, [optimizedQuery]);

  const forceRefresh = useCallback(async () => {
    await optimizedQuery.clearCache();
    await optimizedQuery.refetch();
    setTotalUpdates(prev => prev + 1);
  }, [optimizedQuery]);

  const reconnectWebSocket = useCallback(() => {
    const wsClient = WebSocketClient.getInstance();
    wsClient.reconnect();
  }, []);

  const pausePolling = useCallback(() => {
    setIsPollingPaused(true);
    const pollingService = SmartPollingService.getInstance();
    pollingService.pauseTask(queryKey.join(':'));
  }, [queryKey]);

  const resumePolling = useCallback(() => {
    setIsPollingPaused(false);
    const pollingService = SmartPollingService.getInstance();
    pollingService.resumeTask(queryKey.join(':'));
  }, [queryKey]);

  // Connection status
  const isWebSocketConnected = optimizedQuery.websocketConnected;
  const isPollingActive = optimizedQuery.pollingActive && !isPollingPaused;
  const isCacheHit = optimizedQuery.lastDataSource === 'cache';

  return {
    // Data
    data: optimizedQuery.data,
    error: optimizedQuery.error,
    isLoading: optimizedQuery.isLoading,
    isValidating: optimizedQuery.isFetching,
    
    // Connection status
    isWebSocketConnected,
    isPollingActive,
    isCacheHit,
    
    // Data source info
    lastUpdateSource,
    lastUpdateTime,
    
    // Statistics
    cacheHitRate: optimizedQuery.cacheHitRate,
    totalUpdates,
    websocketMessages,
    pollingRequests,
    
    // Manual controls
    refetch,
    invalidateCache,
    forceRefresh,
    
    // Connection controls
    reconnectWebSocket,
    pausePolling,
    resumePolling
  };
}

// Specialized hooks for common use cases
export function useRealTimeList<T = any>(
  resource: string,
  queryFn: () => Promise<T[]>,
  options: Partial<RealTimeDataOptions> = {}
) {
  return useRealTimeData<T[]>({
    queryKey: ['list', resource],
    queryFn,
    subscribeToResource: resource,
    subscribeToEvents: [`${resource}:created`, `${resource}:updated`, `${resource}:deleted`],
    pollingInterval: 60000, // 1 minute for lists
    ...options
  });
}

export function useRealTimeItem<T = any>(
  resource: string,
  id: string | number,
  queryFn: () => Promise<T>,
  options: Partial<RealTimeDataOptions> = {}
) {
  return useRealTimeData<T>({
    queryKey: ['item', resource, String(id)],
    queryFn,
    subscribeToResource: `${resource}:${id}`,
    subscribeToEvents: [`${resource}:${id}:updated`, `${resource}:${id}:deleted`],
    pollingInterval: 120000, // 2 minutes for individual items
    ...options
  });
}

export function useRealTimeStats(
  resource: string,
  queryFn: () => Promise<any>,
  options: Partial<RealTimeDataOptions> = {}
) {
  return useRealTimeData({
    queryKey: ['stats', resource],
    queryFn,
    subscribeToResource: `${resource}:stats`,
    subscribeToEvents: [`${resource}:stats:updated`],
    pollingInterval: 30000, // 30 seconds for stats
    enableDeltaUpdates: true,
    ...options
  });
}