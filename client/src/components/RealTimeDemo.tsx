import React, { useState, useEffect } from 'react';
import { useRealTimeData, useRealTimeList, useRealTimeStats } from '../hooks/useRealTimeData';
import { Activity, Wifi, WifiOff, Database, Clock, TrendingUp, AlertCircle, CheckCircle, Zap } from 'lucide-react';

// Mock API functions for demonstration
const fetchProducts = async () => {
  const response = await fetch('/api/products');
  if (!response.ok) throw new Error('Failed to fetch products');
  return response.json();
};

const fetchSystemStats = async () => {
  const response = await fetch('/api/metrics');
  if (!response.ok) throw new Error('Failed to fetch system stats');
  return response.json();
};

const fetchUserActivity = async () => {
  const response = await fetch('/api/user-activity');
  if (!response.ok) throw new Error('Failed to fetch user activity');
  return response.json();
};

interface ConnectionStatusProps {
  isWebSocketConnected: boolean;
  isPollingActive: boolean;
  isCacheHit: boolean;
  lastUpdateSource: string | null;
  lastUpdateTime: Date | null;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isWebSocketConnected,
  isPollingActive,
  isCacheHit,
  lastUpdateSource,
  lastUpdateTime
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Activity className="mr-2 h-5 w-5" />
        Connection Status
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* WebSocket Status */}
        <div className="flex items-center space-x-2">
          {isWebSocketConnected ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
          <span className={`font-medium ${isWebSocketConnected ? 'text-green-700' : 'text-red-700'}`}>
            WebSocket: {isWebSocketConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Polling Status */}
        <div className="flex items-center space-x-2">
          {isPollingActive ? (
            <CheckCircle className="h-5 w-5 text-blue-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          )}
          <span className={`font-medium ${isPollingActive ? 'text-blue-700' : 'text-yellow-700'}`}>
            Polling: {isPollingActive ? 'Active' : 'Paused'}
          </span>
        </div>

        {/* Cache Status */}
        <div className="flex items-center space-x-2">
          <Database className={`h-5 w-5 ${isCacheHit ? 'text-purple-500' : 'text-gray-400'}`} />
          <span className={`font-medium ${isCacheHit ? 'text-purple-700' : 'text-gray-600'}`}>
            Cache: {isCacheHit ? 'Hit' : 'Miss'}
          </span>
        </div>
      </div>

      {/* Last Update Info */}
      {lastUpdateSource && lastUpdateTime && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>
              Last update: {lastUpdateTime.toLocaleTimeString()} via {lastUpdateSource}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

interface MetricsCardProps {
  title: string;
  value: number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const MetricsCard: React.FC<MetricsCardProps> = ({ 
  title, 
  value, 
  unit = '', 
  trend = 'stable',
  color = 'blue' 
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200'
  };

  const trendIcons = {
    up: <TrendingUp className="h-4 w-4 text-green-500" />,
    down: <TrendingUp className="h-4 w-4 text-red-500 transform rotate-180" />,
    stable: <div className="h-4 w-4" />
  };

  return (
    <div className={`rounded-lg border-2 p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold">
            {typeof value === 'number' ? value.toLocaleString() : value}
            {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
          </p>
        </div>
        {trendIcons[trend]}
      </div>
    </div>
  );
};

export const RealTimeDemo: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'products' | 'stats' | 'activity'>('products');

  // Real-time data hooks
  const productsQuery = useRealTimeList('products', fetchProducts, {
    pollingInterval: 30000,
    enableDeltaUpdates: true,
    onDataUpdate: (data, source) => {
      console.log(`Products updated via ${source}:`, data);
    }
  });

  const statsQuery = useRealTimeStats('system', fetchSystemStats, {
    pollingInterval: 10000,
    enableCompression: true,
    onDataUpdate: (data, source) => {
      console.log(`Stats updated via ${source}:`, data);
    }
  });

  const activityQuery = useRealTimeData({
    queryKey: ['user-activity'],
    queryFn: fetchUserActivity,
    subscribeToResource: 'user-activity',
    subscribeToEvents: ['user:login', 'user:logout', 'user:action'],
    pollingInterval: 60000,
    onDataUpdate: (data, source) => {
      console.log(`Activity updated via ${source}:`, data);
    }
  });

  // Auto-refresh demonstration
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedTab === 'stats') {
        statsQuery.refetch();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedTab, statsQuery]);

  const tabs = [
    { id: 'products', label: 'Products', icon: Database },
    { id: 'stats', label: 'System Stats', icon: TrendingUp },
    { id: 'activity', label: 'User Activity', icon: Activity }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Real-Time System Demo
        </h1>
        <p className="text-gray-600">
          Demonstração do sistema de atualizações em tempo real com WebSocket, polling inteligente e cache local.
        </p>
      </div>

      {/* Connection Status */}
      <ConnectionStatus
        isWebSocketConnected={productsQuery.isWebSocketConnected}
        isPollingActive={productsQuery.isPollingActive}
        isCacheHit={productsQuery.isCacheHit}
        lastUpdateSource={productsQuery.lastUpdateSource}
        lastUpdateTime={productsQuery.lastUpdateTime}
      />

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricsCard
          title="Cache Hit Rate"
          value={Math.round(productsQuery.cacheHitRate * 100)}
          unit="%"
          color="purple"
          trend={productsQuery.cacheHitRate > 0.8 ? 'up' : productsQuery.cacheHitRate > 0.5 ? 'stable' : 'down'}
        />
        <MetricsCard
          title="Total Updates"
          value={productsQuery.totalUpdates}
          color="blue"
        />
        <MetricsCard
          title="WebSocket Messages"
          value={productsQuery.websocketMessages}
          color="green"
        />
        <MetricsCard
          title="Polling Requests"
          value={productsQuery.pollingRequests}
          color="yellow"
        />
      </div>

      {/* Control Panel */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Zap className="mr-2 h-5 w-5" />
          Controls
        </h3>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => productsQuery.refetch()}
            disabled={productsQuery.isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {productsQuery.isLoading ? 'Loading...' : 'Manual Refresh'}
          </button>
          
          <button
            onClick={() => productsQuery.invalidateCache()}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Clear Cache
          </button>
          
          <button
            onClick={() => productsQuery.forceRefresh()}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Force Refresh
          </button>
          
          <button
            onClick={() => productsQuery.reconnectWebSocket()}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Reconnect WebSocket
          </button>
          
          {productsQuery.isPollingActive ? (
            <button
              onClick={() => productsQuery.pausePolling()}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Pause Polling
            </button>
          ) : (
            <button
              onClick={() => productsQuery.resumePolling()}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Resume Polling
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    selectedTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Products Tab */}
          {selectedTab === 'products' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Products Data</h3>
              {productsQuery.isLoading && !productsQuery.data ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-2">Loading products...</span>
                </div>
              ) : productsQuery.error ? (
                <div className="text-red-600 py-4">
                  Error: {productsQuery.error.message}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Showing {productsQuery.data?.length || 0} products
                    {productsQuery.isValidating && (
                      <span className="ml-2 text-blue-600">(Updating...)</span>
                    )}
                  </p>
                  <div className="bg-gray-50 rounded p-4 max-h-64 overflow-y-auto">
                    <pre className="text-sm">
                      {JSON.stringify(productsQuery.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stats Tab */}
          {selectedTab === 'stats' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">System Statistics</h3>
              {statsQuery.isLoading && !statsQuery.data ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-2">Loading stats...</span>
                </div>
              ) : statsQuery.error ? (
                <div className="text-red-600 py-4">
                  Error: {statsQuery.error.message}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    System metrics
                    {statsQuery.isValidating && (
                      <span className="ml-2 text-blue-600">(Updating...)</span>
                    )}
                  </p>
                  <div className="bg-gray-50 rounded p-4 max-h-64 overflow-y-auto">
                    <pre className="text-sm">
                      {JSON.stringify(statsQuery.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {selectedTab === 'activity' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">User Activity</h3>
              {activityQuery.isLoading && !activityQuery.data ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-2">Loading activity...</span>
                </div>
              ) : activityQuery.error ? (
                <div className="text-red-600 py-4">
                  Error: {activityQuery.error.message}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Recent user activity
                    {activityQuery.isValidating && (
                      <span className="ml-2 text-blue-600">(Updating...)</span>
                    )}
                  </p>
                  <div className="bg-gray-50 rounded p-4 max-h-64 overflow-y-auto">
                    <pre className="text-sm">
                      {JSON.stringify(activityQuery.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeDemo;