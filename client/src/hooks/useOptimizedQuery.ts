import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';
import { getWebSocketClient, type WebSocketClient, type NotificationData } from '../lib/websocket-client';
import { getPollingService, type SmartPollingService } from '../lib/smart-polling';
import { getCacheManager, type LocalCacheManager } from '../lib/cache-manager';

export interface OptimizedQueryOptions<TData = unknown, TError = Error> extends Omit<UseQueryOptions<TData, TError>, 'queryFn'> {
  // Required
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  
  // WebSocket options
  enableWebSocket?: boolean;
  websocketSubscription?: {
    resourceType: string;
    resourceId?: string;
    filters?: Record<string, any>;
  };
  
  // Polling options
  enablePolling?: boolean;
  pollingInterval?: number;
  pollingPriority?: 'high' | 'medium' | 'low';
  pollingDependencies?: string[];
  
  // Cache options
  enableCache?: boolean;
  cacheTTL?: number;
  cacheKey?: string;
  
  // Optimization options
  enableDeltaUpdates?: boolean;
  enableCompression?: boolean;
  enableETagValidation?: boolean;
  
  // Callbacks
  onWebSocketNotification?: (notification: NotificationData) => void;
  onCacheHit?: (data: TData) => void;
  onCacheMiss?: () => void;
  onPollingSuccess?: (data: TData) => void;
  onPollingError?: (error: TError) => void;
  
  // Advanced options
  shouldInvalidateOnNotification?: (notification: NotificationData) => boolean;
  shouldUpdateFromNotification?: (notification: NotificationData, currentData: TData | undefined) => boolean;
  transformNotificationData?: (notification: NotificationData) => Partial<TData>;
  
  // Performance options
  debounceMs?: number;
  throttleMs?: number;
}

export interface OptimizedQueryResult<TData = unknown, TError = Error> {
  // Standard React Query result
  data: TData | undefined;
  error: TError | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isFetching: boolean;
  isStale: boolean;
  
  // Extended information
  dataSource: 'cache' | 'websocket' | 'polling' | 'query' | 'none';
  lastUpdated: number | null;
  cacheHitRate: number;
  
  // Connection status
  websocketConnected: boolean;
  pollingActive: boolean;
  cacheEnabled: boolean;
  
  // Manual controls
  refetch: () => Promise<TData>;
  invalidate: () => void;
  clearCache: () => Promise<void>;
  
  // Statistics
  stats: {
    totalFetches: number;
    cacheHits: number;
    cacheMisses: number;
    websocketUpdates: number;
    pollingUpdates: number;
    lastFetchDuration: number;
  };
}

export function useOptimizedQuery<TData = unknown, TError = Error>(
  options: OptimizedQueryOptions<TData, TError>
): OptimizedQueryResult<TData, TError> {
  const queryClient = useQueryClient();
  
  // Services
  const wsClient = useRef<WebSocketClient | null>(null);
  const pollingService = useRef<SmartPollingService | null>(null);
  const cacheManager = useRef<LocalCacheManager | null>(null);
  
  // State
  const [dataSource, setDataSource] = useState<'cache' | 'websocket' | 'polling' | 'query' | 'none'>('none');
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [cacheEnabled, setCacheEnabled] = useState(false);
  
  // Statistics
  const [stats, setStats] = useState({
    totalFetches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    websocketUpdates: 0,
    pollingUpdates: 0,
    lastFetchDuration: 0
  });
  
  // Refs for debouncing/throttling
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const throttleTimer = useRef<NodeJS.Timeout | null>(null);
  const lastThrottleTime = useRef<number>(0);
  
  // Generate cache key
  const cacheKey = useMemo(() => {
    return options.cacheKey || `query:${JSON.stringify(options.queryKey)}`;
  }, [options.cacheKey, options.queryKey]);
  
  // Enhanced query function with caching and ETag support
  const enhancedQueryFn = useCallback(async (): Promise<TData> => {
    const startTime = Date.now();
    
    try {
      // Try cache first if enabled
      if (options.enableCache && cacheManager.current) {
        const cachedResult = await cacheManager.current.getWithMetadata(cacheKey);
        
        if (cachedResult) {
          setStats(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
          setDataSource('cache');
          setLastUpdated(cachedResult.metadata.timestamp);
          
          if (options.onCacheHit) {
            options.onCacheHit(cachedResult.data);
          }
          
          return cachedResult.data;
        } else {
          setStats(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }));
          
          if (options.onCacheMiss) {
            options.onCacheMiss();
          }
        }
      }
      
      // Fetch from API
      const result = await options.queryFn();
      const duration = Date.now() - startTime;
      
      // Update statistics
      setStats(prev => ({
        ...prev,
        totalFetches: prev.totalFetches + 1,
        lastFetchDuration: duration
      }));
      
      // Cache the result if enabled
      if (options.enableCache && cacheManager.current) {
        await cacheManager.current.set(cacheKey, result, {
          ttl: options.cacheTTL
        });
      }
      
      setDataSource('query');
      setLastUpdated(Date.now());
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      setStats(prev => ({
        ...prev,
        totalFetches: prev.totalFetches + 1,
        lastFetchDuration: duration
      }));
      
      throw error;
    }
  }, [options.queryFn, options.enableCache, cacheKey, options.cacheTTL, options.onCacheHit, options.onCacheMiss]);
  
  // Standard React Query
  const queryResult = useQuery({
    ...options,
    queryFn: enhancedQueryFn,
    staleTime: options.staleTime || 0,
    gcTime: options.gcTime || 5 * 60 * 1000, // 5 minutes
  });
  
  // Initialize services
  useEffect(() => {
    const initServices = async () => {
      // Initialize WebSocket if enabled
      if (options.enableWebSocket) {
        wsClient.current = getWebSocketClient({ debug: false });
        
        try {
          await wsClient.current.connect();
          setWebsocketConnected(true);
          
          // Subscribe to notifications
          if (options.websocketSubscription) {
            wsClient.current.subscribe(options.websocketSubscription);
          }
          
        } catch (error) {
          console.error('Failed to connect WebSocket:', error);
          setWebsocketConnected(false);
        }
      }
      
      // Initialize polling if enabled
      if (options.enablePolling) {
        pollingService.current = getPollingService({ debug: false });
        
        const pollingKey = `query:${JSON.stringify(options.queryKey)}`;
        
        pollingService.current.addTask({
          key: pollingKey,
          fetcher: async () => {
            const result = await options.queryFn();
            
            setStats(prev => ({ ...prev, pollingUpdates: prev.pollingUpdates + 1 }));
            setDataSource('polling');
            setLastUpdated(Date.now());
            
            if (options.onPollingSuccess) {
              options.onPollingSuccess(result);
            }
            
            // Update React Query cache
            queryClient.setQueryData(options.queryKey, result);
            
            return result;
          },
          interval: options.pollingInterval,
          priority: options.pollingPriority,
          dependencies: options.pollingDependencies,
          onError: options.onPollingError
        });
        
        setPollingActive(true);
      }
      
      // Initialize cache if enabled
      if (options.enableCache) {
        cacheManager.current = getCacheManager({
          defaultTTL: options.cacheTTL,
          debug: false
        });
        
        await cacheManager.current.initialize();
        setCacheEnabled(true);
      }
    };
    
    initServices();
    
    return () => {
      // Cleanup
      if (wsClient.current && options.websocketSubscription) {
        const key = `${options.websocketSubscription.resourceType}:${options.websocketSubscription.resourceId || 'all'}`;
        wsClient.current.unsubscribe(key);
      }
      
      if (pollingService.current && options.enablePolling) {
        const pollingKey = `query:${JSON.stringify(options.queryKey)}`;
        pollingService.current.removeTask(pollingKey);
      }
    };
  }, [options.enableWebSocket, options.enablePolling, options.enableCache]);
  
  // Handle WebSocket notifications
  useEffect(() => {
    if (!wsClient.current || !options.enableWebSocket) return;
    
    const handleNotification = (notification: NotificationData) => {
      // Apply debouncing if configured
      if (options.debounceMs) {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        
        debounceTimer.current = setTimeout(() => {
          processNotification(notification);
        }, options.debounceMs);
        
        return;
      }
      
      // Apply throttling if configured
      if (options.throttleMs) {
        const now = Date.now();
        
        if (now - lastThrottleTime.current < options.throttleMs) {
          return;
        }
        
        lastThrottleTime.current = now;
      }
      
      processNotification(notification);
    };
    
    const processNotification = (notification: NotificationData) => {
      setStats(prev => ({ ...prev, websocketUpdates: prev.websocketUpdates + 1 }));
      
      if (options.onWebSocketNotification) {
        options.onWebSocketNotification(notification);
      }
      
      // Check if we should invalidate the query
      if (options.shouldInvalidateOnNotification) {
        if (options.shouldInvalidateOnNotification(notification)) {
          queryClient.invalidateQueries({ queryKey: options.queryKey });
          return;
        }
      }
      
      // Check if we should update from notification data
      if (options.shouldUpdateFromNotification && options.transformNotificationData) {
        const currentData = queryClient.getQueryData<TData>(options.queryKey);
        
        if (options.shouldUpdateFromNotification(notification, currentData)) {
          const updatedData = options.transformNotificationData(notification);
          
          if (currentData && typeof currentData === 'object') {
            const mergedData = { ...currentData, ...updatedData };
            queryClient.setQueryData(options.queryKey, mergedData);
            setDataSource('websocket');
            setLastUpdated(Date.now());
          }
        }
      } else {
        // Default behavior: invalidate query
        queryClient.invalidateQueries({ queryKey: options.queryKey });
      }
    };
    
    wsClient.current.on('notification', handleNotification);
    
    // Listen for specific resource type notifications
    if (options.websocketSubscription) {
      const eventName = `notification:${options.websocketSubscription.resourceType}`;
      wsClient.current.on(eventName, handleNotification);
    }
    
    return () => {
      if (wsClient.current) {
        wsClient.current.off('notification', handleNotification);
        
        if (options.websocketSubscription) {
          const eventName = `notification:${options.websocketSubscription.resourceType}`;
          wsClient.current.off(eventName, handleNotification);
        }
      }
      
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [options.enableWebSocket, options.websocketSubscription, options.debounceMs, options.throttleMs]);
  
  // Calculate cache hit rate
  const cacheHitRate = useMemo(() => {
    const total = stats.cacheHits + stats.cacheMisses;
    return total > 0 ? (stats.cacheHits / total) * 100 : 0;
  }, [stats.cacheHits, stats.cacheMisses]);
  
  // Manual controls
  const clearCache = useCallback(async () => {
    if (cacheManager.current) {
      await cacheManager.current.delete(cacheKey);
    }
  }, [cacheKey]);
  
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: options.queryKey });
  }, [queryClient, options.queryKey]);
  
  return {
    // Standard React Query results
    data: queryResult.data,
    error: queryResult.error,
    isLoading: queryResult.isLoading,
    isError: queryResult.isError,
    isSuccess: queryResult.isSuccess,
    isFetching: queryResult.isFetching,
    isStale: queryResult.isStale,
    
    // Extended information
    dataSource,
    lastUpdated,
    cacheHitRate,
    
    // Connection status
    websocketConnected,
    pollingActive,
    cacheEnabled,
    
    // Manual controls
    refetch: queryResult.refetch,
    invalidate,
    clearCache,
    
    // Statistics
    stats
  };
}