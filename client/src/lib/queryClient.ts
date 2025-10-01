import { QueryClient } from '@tanstack/react-query';
import debug from './debug';

// Global WebSocket connection status
declare global {
  interface Window {
    __websocketConnected?: boolean;
  }
}

// WebSocket notification handler for React Query integration
export const handleWebSocketNotification = (notification: any) => {
  const queryClient = getQueryClient();
  
  try {
    debug.log('🔄 Processing WebSocket notification for React Query:', notification);
    
    // Handle different notification types
    switch (notification.type) {
      case 'notification':
        handleDataNotification(queryClient, notification);
        break;
      case 'cache_update':
        handleCacheUpdate(queryClient, notification);
        break;
      case 'invalidate':
        handleInvalidation(queryClient, notification);
        break;
      default:
        debug.log('🤷 Unknown notification type:', notification.type);
    }
  } catch (error) {
    debug.error('❌ Error handling WebSocket notification:', error);
  }
};

// Handle data change notifications
const handleDataNotification = (queryClient: QueryClient, notification: any) => {
  const { table, operation, data } = notification;
  
  if (!table || !operation) {
    debug.warn('⚠️ Invalid notification format:', notification);
    return;
  }
  
  debug.log(`📊 Data notification: ${operation} on ${table}`, data);
  
  // Map table names to query keys
  const queryKeyMappings: Record<string, string[]> = {
    purchase_requests: ['purchase-requests', 'kanban-data'],
    quotations: ['quotations', 'kanban-data'],
    supplier_quotations: ['supplier-quotations', 'kanban-data'],
    purchase_orders: ['purchase-orders', 'kanban-data'],
    receipts: ['receipts', 'kanban-data'],
    companies: ['companies'],
    departments: ['departments'],
    users: ['users']
  };
  
  const queryKeys = queryKeyMappings[table] || [table];
  
  // Invalidate related queries based on operation
  switch (operation) {
    case 'INSERT':
    case 'UPDATE':
    case 'DELETE':
      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
        debug.log(`🔄 Invalidated queries for key: ${key}`);
      });
      break;
    default:
      debug.log(`🤷 Unknown operation: ${operation}`);
  }
  
  // Special handling for kanban data
  if (queryKeys.includes('kanban-data')) {
    // Invalidate kanban statistics
    queryClient.invalidateQueries({ queryKey: ['kanban-stats'] });
    
    // Invalidate department-specific queries if data includes department info
    if (data?.department_id) {
      queryClient.invalidateQueries({ 
        queryKey: ['purchase-requests', { department: data.department_id }] 
      });
    }
    
    // Invalidate user-specific queries if data includes user info
    if (data?.requester_id) {
      queryClient.invalidateQueries({ 
        queryKey: ['purchase-requests', { requester: data.requester_id }] 
      });
    }
  }
};

// Handle cache update notifications
const handleCacheUpdate = (queryClient: QueryClient, notification: any) => {
  const { queryKey, data } = notification;
  
  if (!queryKey) {
    debug.warn('⚠️ Cache update without query key:', notification);
    return;
  }
  
  debug.log('💾 Cache update notification:', queryKey, data);
  
  // Update query data directly
  queryClient.setQueryData(queryKey, data);
};

// Handle invalidation notifications
const handleInvalidation = (queryClient: QueryClient, notification: any) => {
  const { queryKey, pattern } = notification;
  
  debug.log('🗑️ Invalidation notification:', queryKey, pattern);
  
  if (queryKey) {
    queryClient.invalidateQueries({ queryKey });
  } else if (pattern) {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0] as string;
        return key.includes(pattern);
      }
    });
  }
};

// Enhanced query client with WebSocket integration
let _queryClient: QueryClient | null = null;

export const getQueryClient = () => {
  if (!_queryClient) {
    _queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Reduce stale time when WebSocket is connected for real-time updates
          staleTime: () => {
            return window.__websocketConnected ? 30000 : 0; // 30s with WebSocket, immediate without
          },
          // Reduce cache time for more responsive updates
          gcTime: 5 * 60 * 1000, // 5 minutes
          // Disable refetch on window focus when WebSocket is connected
          refetchOnWindowFocus: () => !window.__websocketConnected,
          // Reduce refetch interval when WebSocket is connected
          refetchInterval: () => {
            return window.__websocketConnected ? false : 30000; // No polling with WebSocket, 30s without
          },
          // Single retry for better performance
          retry: 1,
        },
        mutations: {
          retry: false,
        },
      },
    });
  }
  
  return _queryClient;
};

// Enhanced API request function with WebSocket awareness
interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  throwOnAuthError?: boolean;
}

export async function apiRequest(url: string): Promise<any>;
export async function apiRequest(url: string, options: ApiRequestOptions): Promise<any>;
export async function apiRequest(url: string, options?: ApiRequestOptions): Promise<any> {
  const config: RequestInit = {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  };

  // Handle FormData
  if (options?.body instanceof FormData) {
    delete config.headers!['Content-Type'];
    config.body = options.body;
  } else if (options?.body) {
    config.body = JSON.stringify(options.body);
  }

  // Add WebSocket connection status header for server optimization
  if (window.__websocketConnected) {
    config.headers = {
      ...config.headers,
      'X-WebSocket-Connected': 'true'
    };
  }

  // Ensure we don't double-prefix with /api
  const apiUrl = url.startsWith('/api') ? url : `/api${url}`;
  const response = await fetch(apiUrl, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    if (response.status === 401) {
      if (options?.throwOnAuthError !== false) {
        throw new Error('Unauthorized');
      }
      return null;
    }
    
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const queryClient = getQueryClient();
export default queryClient;